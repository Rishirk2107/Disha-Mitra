import logging
import os
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import Worker_completed as worker  # Import the worker module

# Initialize FastAPI app
app = FastAPI()
server_start_time = time.time()

# Health check endpoint
@app.get("/health")
async def health():
    return JSONResponse(content={
        "status": "ok",
        "uptime_ms": int((time.time() - server_start_time) * 1000),
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }, status_code=200)

# Pydantic models
class Message(BaseModel):
    userMessage: str
    companyId: Optional[int] = None
    userId: Optional[int] = None


class DeleteRequest(BaseModel):
    pdfId: str
    companyId: Optional[int] = None
    namespace: Optional[str] = None

class QuizRequest(BaseModel):
    distribution: Dict[str, int]  # Format: {"Mathematics": 10, "Physics": 8, ...}

# Configure CORS middleware
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("FastAPI-App")

# Directory to store uploaded files
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Route for processing chat messages
@app.post("/api/chat")
async def process_message_route(message: Message):
    user_message = message.userMessage
    company_id = message.companyId
    logger.debug(f"Received user message: {user_message}")

    if not user_message:
        raise HTTPException(status_code=400, detail="Please provide a message to process.")
    if company_id is None:
        raise HTTPException(status_code=400, detail="companyId is required for processing chat messages.")

    try:
        # Process the user's message using the worker module
        bot_response = worker.process_prompt(user_message, company_id=company_id)
        logger.debug(f"Bot response: {bot_response}")
        return JSONResponse(content={"botResponse": bot_response}, status_code=200)
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail="There was an error processing your message.")

@app.post("/process-article")
async def process_article_route(
    file: UploadFile = File(None),
    companyId: Optional[int] = Form(None),
    userId: Optional[int] = Form(None),
    articleId: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    isPrivate: bool = Form(False)
):
    # Accept either file upload or URL
    document_path = None
    
    try:
        if url:
            # Process document from URL
            if not companyId:
                raise HTTPException(status_code=400, detail="companyId is required for processing documents.")
            
            logger.debug(f"Processing article from URL: {url}, isPrivate: {isPrivate}")
            metadata_source = source or "article"
            
            # Process the article from URL using the worker module
            tags = worker.process_article(
                document_path=url,
                company_id=companyId,
                user_id=userId,
                article_id=articleId or metadata_source,
                source=metadata_source,
                category=category,
                is_private=isPrivate
            )
        elif file:
             # Process uploaded file
            if not file.filename:
                raise HTTPException(status_code=400, detail="No file selected. Please try again.")
            
            if not companyId:
                raise HTTPException(status_code=400, detail="companyId is required for processing documents.")

            # Save the uploaded file to the uploads directory
            document_path = os.path.join(UPLOAD_FOLDER, file.filename)
            logger.debug(f"Saving uploaded article to {document_path}")
            with open(document_path, "wb") as buffer:
                buffer.write(await file.read())
            logger.debug(f"File successfully saved to {document_path}")

            # Determine metadata defaults
            metadata_source = source or file.filename

            # Process the uploaded article using the worker module
            tags = worker.process_article(
                document_path=document_path,
                company_id=companyId,
                user_id=userId,
                article_id=articleId or file.filename,
                source=metadata_source,
                category=category,
                is_private=isPrivate
            )
        else:
            raise HTTPException(status_code=400, detail="Either file or url is required.")

        return JSONResponse(content={ 
            "message": "Article processed successfully",
            "tags": tags
        }, status_code=200)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving or processing article: {e}")
        raise HTTPException(status_code=500, detail=f"There was an error processing your article: {str(e)}")


# Route for processing document uploads
@app.post("/process-document")
async def process_document_route(
    file: UploadFile = File(None),
    companyId: Optional[int] = Form(None),
    userId: Optional[int] = Form(None),
    pdfId: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    category: Optional[str] = Form(None)
):
    # Accept either file upload or URL
    document_path = None
    
    try:
        if url:
            # Process document from URL
            if not companyId:
                raise HTTPException(status_code=400, detail="companyId is required for processing documents.")
            
            logger.debug(f"Processing document from URL: {url}")
            metadata_source = source or "document"
            
            # Process the document from URL using the worker module
            worker.process_document(
                document_path=url,
                company_id=companyId,
                user_id=userId,
                pdf_id=pdfId or metadata_source,
                source=metadata_source,
                category=category
            )
        elif file:
            # Process uploaded file
            if not file.filename:
                raise HTTPException(status_code=400, detail="No file selected. Please try again.")
            
            if not companyId:
                raise HTTPException(status_code=400, detail="companyId is required for processing documents.")

            # Save the uploaded file to the uploads directory
            document_path = os.path.join(UPLOAD_FOLDER, file.filename)
            logger.debug(f"Saving uploaded file to {document_path}")
            with open(document_path, "wb") as buffer:
                buffer.write(await file.read())
            logger.debug(f"File successfully saved to {document_path}")

            # Determine metadata defaults
            metadata_source = source or file.filename

            # Process the uploaded document using the worker module
            worker.process_document(
                document_path=document_path,
                company_id=companyId,
                user_id=userId,
                pdf_id=pdfId or file.filename,
                source=metadata_source,
                category=category
            )
        else:
            raise HTTPException(status_code=400, detail="Either file or url is required.")

        return JSONResponse(content={ 
            "botResponse": "Thank you for providing your PDF document. I have analyzed it and indexed it in Pinecone. Now you can ask me any questions regarding it!"
        }, status_code=200)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving or processing document: {e}")
        raise HTTPException(status_code=500, detail=f"There was an error processing your document: {str(e)}")


# Delete document vectors from Pinecone
@app.post("/delete-document")
async def delete_document_vectors(payload: DeleteRequest):
    try:
        logger.debug(f"Deleting vectors for pdfId={payload.pdfId}, companyId={payload.companyId}, namespace={payload.namespace}")
        resp = worker.delete_pdf_vectors(
            pdf_id=payload.pdfId,
            namespace=payload.namespace,
            company_id=payload.companyId
        )
        return JSONResponse(content={"deleted": True, "response": resp}, status_code=200)
    except Exception as e:
        logger.error(f"Error deleting document vectors: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document vectors: {str(e)}")
if __name__ == "__main__":
    #worker.process_document() #Perists directory
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")