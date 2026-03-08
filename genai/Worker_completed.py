import os
import time
import numpy as np
import pdfplumber
import requests
from io import BytesIO
from dotenv import load_dotenv
from google import genai
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer

load_dotenv()

# Configuration from environment (set these in .env or environment)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CHAT_MODEL = "gemini-2.5-flash-lite"  # New Gemini chat model

# Load SentenceTransformer model for embeddings
hf_model = SentenceTransformer("intfloat/e5-base-v2")

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENV = os.getenv("PINECONE_ENV")
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "genai-index")


# Gemini API client
genai_client = None
if GEMINI_API_KEY:
    genai_client = genai.Client(api_key=GEMINI_API_KEY,  http_options={"api_version": "v1"})

models = genai_client.models.list()

for m in models:
    print(m.name)

# Pinecone client
pc = None
if PINECONE_API_KEY:
    pc = Pinecone(api_key=PINECONE_API_KEY)

chat_history = []


def init_llm():
    global genai_client, pc
    
    if not GEMINI_API_KEY:
        raise EnvironmentError("GEMINI_API_KEY not set in environment")
    if not PINECONE_API_KEY:
        raise EnvironmentError("PINECONE_API_KEY not set in environment")
    
    if genai_client is None:
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
    if pc is None:
        pc = Pinecone(api_key=PINECONE_API_KEY)


def _extract_text(pdf_source: str) -> str:
    """
    Extract text from PDF either from file path or URL.
    """
    try:
        if pdf_source.startswith(('http://', 'https://')):
            # Add headers to avoid 401 errors from some servers like Cloudinary
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/pdf, */*',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
            }
            response = requests.get(pdf_source, headers=headers, timeout=30)
            response.raise_for_status()
            pdf_file = BytesIO(response.content)
            with pdfplumber.open(pdf_file) as pdf:
                parts = [page.extract_text() for page in pdf.pages if page.extract_text()]
        else:
            with pdfplumber.open(pdf_source) as pdf:
                parts = [page.extract_text() for page in pdf.pages if page.extract_text()]
        return "\n\n".join(parts)
    except Exception as e:
        raise ValueError(f"Error extracting text from PDF: {str(e)}")


def _chunk_text(text: str, max_chars: int = 1000):
    """Split text into chunks."""
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + max_chars, length)
        cut = text.rfind("\n", start, end)
        if cut <= start:
            cut = text.rfind(" ", start, end)
        if cut <= start:
            cut = end
        chunk = text[start:cut].strip()
        if chunk:
            chunks.append(chunk)
        start = cut
    return chunks


def _embed_texts(texts):
    """Generate embeddings for text chunks using SentenceTransformer."""
    embeddings = hf_model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True
    )
    return [np.array(e, dtype=np.float32) for e in embeddings]


def _ensure_pinecone_index(dim: int):
    """Ensure Pinecone index exists."""
    if not PINECONE_API_KEY:
        raise EnvironmentError("PINECONE_API_KEY not set in environment")
    if pc is None:
        raise EnvironmentError("Pinecone client not initialized")
    
    existing = pc.list_indexes().names()
    if PINECONE_INDEX not in existing:
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=dim,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-west-2")
        )
    return pc.Index(PINECONE_INDEX)


def delete_pdf_vectors(pdf_id: str, namespace: str = None, company_id: int = None):
    """Delete all vectors for a given pdf_id (optionally scoped by company)."""
    print(f"[DELETE] Starting delete_pdf_vectors: pdf_id={pdf_id}, company_id={company_id}, namespace={namespace}")
    if not PINECONE_API_KEY:
        raise EnvironmentError("PINECONE_API_KEY not set in environment")
    if pc is None:
        raise EnvironmentError("Pinecone client not initialized")

    idx = pc.Index(PINECONE_INDEX)
    print(f"[DELETE] Pinecone index: {PINECONE_INDEX}")

    delete_filter = {"pdf_id": str(pdf_id)}
    if company_id is not None:
        try:
            delete_filter["company_id"] = int(company_id)
        except (TypeError, ValueError):
            delete_filter["company_id"] = company_id

    delete_kwargs = {"filter": delete_filter}
    if namespace:
        delete_kwargs["namespace"] = namespace

    print(f"[DELETE] Delete filter: {delete_filter}")
    print(f"[DELETE] Delete kwargs: {delete_kwargs}")
    
    try:
        resp = idx.delete(**delete_kwargs)
        print(f"[DELETE] Delete response: {resp}")
        return resp
    except Exception as e:
        print(f"[DELETE] Delete error: {str(e)}")
        raise


def load_faiss_index():
    """Load or initialize Pinecone index."""
    if not os.path.exists("./faiss_index"):
        print("Document index not found. Please process a document first using process_document().")
    else:
        print("Index ready. Use process_prompt() to query the documents.")


def generate_tags(text: str) -> list:
    """Generate 3-4 tags for the article using Gemini."""
    if not GEMINI_API_KEY:
        raise EnvironmentError("GEMINI_API_KEY not set")
    if genai_client is None:
        raise EnvironmentError("genai_client not initialized")
    
    prompt = (
        "Generate 3 to 4 relevant tags for the following text. "
        "Return ONLY the tags separated by commas, no other text.\n\n"
        f"TEXT: {text[:2000]}..." # Limit text to avoid token limits
    )
    
    try:
        resp = genai_client.models.generate_content(
            model=CHAT_MODEL,
            contents=prompt
        )
        
        tags_text = resp.text
        # Clean up the response - remove brackets, quotes if any
        tags_text = tags_text.replace('[', '').replace(']', '').replace('"', '').replace("'", "")
        tags = [tag.strip() for tag in tags_text.split(',') if tag.strip()]
        return tags[:4]
    except Exception as e:
        print(f"[TAGS] Error generating tags: {e}")
        return []


def process_article(document_path, namespace: str = None, company_id: int = None,
                    user_id: int = None, article_id: str = None, source: str = None, 
                    category: str = None, is_private: bool = False):
    """Process article: extract text, generate tags, embed, and upsert."""
    print(f"[ARTICLE] Starting process_article: article_id={article_id}, is_private={is_private}")
    
    text = _extract_text(document_path)
    if not text:
        raise ValueError("No text found in the provided article.")
        
    # Generate tags
    tags = generate_tags(text)
    print(f"[ARTICLE] Generated tags: {tags}")
    
    chunks = _chunk_text(text, max_chars=1200)
    embeddings = _embed_texts(chunks)
    
    idx = _ensure_pinecone_index(dim=len(embeddings[0]))
    vectors = []
    ts = int(time.time())
    
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        vid = f"art-{ts}-{i}"
        metadata = {
            "text": chunk,
            "is_private": is_private,
            "tags": tags
        }
        if company_id is not None:
            try:
                metadata["company_id"] = int(company_id)
            except (TypeError, ValueError):
                metadata["company_id"] = company_id
        if user_id is not None:
            try:
                metadata["user_id"] = int(user_id)
            except (TypeError, ValueError):
                metadata["user_id"] = user_id
        if article_id is not None:
            metadata["article_id"] = str(article_id)
        if source is not None:
            metadata["source"] = str(source)
        if category is not None:
            metadata["category"] = str(category)

        vectors.append({
            "id": vid,
            "values": emb.tolist(),
            "metadata": metadata
        })
        
    upsert_kwargs = {"vectors": vectors}
    if namespace:
        upsert_kwargs["namespace"] = namespace
    idx.upsert(**upsert_kwargs)
    
    print(f"[ARTICLE] Processed and upserted {len(vectors)} chunks.")
    return tags

def process_document(document_path, namespace: str = None, company_id: int = None,
                    user_id: int = None, pdf_id: str = None, source: str = None, category: str = None):
    """Extract text from PDF, chunk it, compute embeddings, and upsert to Pinecone."""
    print(f"[UPLOAD] Starting process_document: pdf_id={pdf_id}, company_id={company_id}, source={source}, category={category}")
    text = _extract_text(document_path)
    print(f"[UPLOAD] Extracted text length: {len(text)}")
    chunks = _chunk_text(text, max_chars=1200)
    print(f"[UPLOAD] Created {len(chunks)} chunks")
    if not chunks:
        raise ValueError("No text found in the provided PDF.")
    
    embeddings = _embed_texts(chunks)
    print(f"[UPLOAD] Generated {len(embeddings)} embeddings")
    
    idx = _ensure_pinecone_index(dim=len(embeddings[0]))
    vectors = []
    ts = int(time.time())
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        vid = f"doc-{ts}-{i}"
        metadata = {"text": chunk}
        if company_id is not None:
            try:
                metadata["company_id"] = int(company_id)
            except (TypeError, ValueError):
                metadata["company_id"] = company_id
        if user_id is not None:
            try:
                metadata["user_id"] = int(user_id)
            except (TypeError, ValueError):
                metadata["user_id"] = user_id
        if pdf_id is not None:
            metadata["pdf_id"] = str(pdf_id)
        if source is not None:
            metadata["source"] = str(source)
        if category is not None:
            metadata["category"] = str(category)

        vectors.append({
            "id": vid,
            "values": emb.tolist(),
            "metadata": metadata
        })
    
    print(f"[UPLOAD] Sample metadata from first vector: {vectors[0]['metadata'] if vectors else 'no vectors'}")
    upsert_kwargs = {"vectors": vectors}
    if namespace:
        upsert_kwargs["namespace"] = namespace
    idx.upsert(**upsert_kwargs)
    
    print(f"[UPLOAD] Document processed and upserted {len(vectors)} chunks to Pinecone.")


def process_prompt(prompt: str, top_k: int = 4, namespace: str = None,
                   company_id: int = None) -> str:
    """Answer a user prompt by querying Pinecone and calling Gemini."""
    print(f"[QUERY] Starting process_prompt: company_id={company_id}, namespace={namespace}, top_k={top_k}")
    print(f"[QUERY] User prompt: {prompt[:100]}...")
    if not PINECONE_API_KEY:
        raise EnvironmentError("PINECONE_API_KEY not set in environment")
    if genai_client is None:
        raise EnvironmentError("genai_client not initialized")

    # Embed the query
    q_vec = hf_model.encode(
        prompt,
        convert_to_numpy=True,
        normalize_embeddings=True
    ).tolist()
    print(f"[QUERY] Query vector dimension: {len(q_vec)}")

    idx = pc.Index(PINECONE_INDEX)
    query_args = {"top_k": top_k, "include_metadata": True}
    if namespace:
        query_args["namespace"] = namespace
    if company_id is not None:
        try:
            query_args["filter"] = {"company_id": int(company_id)}
        except (TypeError, ValueError):
            query_args["filter"] = {"company_id": company_id}

    print(f"[QUERY] Query args: {query_args}")
    # Query Pinecone
    try:
        res = idx.query(vector=q_vec, **query_args)
    except TypeError:
        res = idx.query(queries=[q_vec], **query_args)

    matches = []
    if isinstance(res, dict):
        matches = res.get("matches", [])
    elif hasattr(res, "matches"):
        matches = res.matches
    
    print(f"[QUERY] Found {len(matches)} matches from Pinecone")

    context_chunks = []
    for m in matches[:top_k]:
        md = m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", None)
        if md and "text" in md:
            context_chunks.append(md["text"])

    context = "\n\n---\n\n".join(context_chunks) if context_chunks else ""

    # Generate response
    combined_prompt = (
        "You are Vantum AI, a helpful educational and informational assistant. "
        "Answer concisely and supportively; when relevant, indicate which part of the provided context supports your answer. "
        "Always use simple language so that high school students, parents, or non-technical people can easily understand.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION: {prompt}\n\n"
        f"Answer:"
    )

    resp = genai_client.models.generate_content(
        model=CHAT_MODEL,
        contents=combined_prompt
    )

    answer = resp.text
    print(f"[QUERY] Generated response length: {len(answer)}")

    chat_history.append((prompt, answer))
    return answer


# Initialize on module load
init_llm()
load_faiss_index()
