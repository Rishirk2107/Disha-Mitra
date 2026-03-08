const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const axios = require('axios');
const { articleSchema } = require('../model/schema');
const { recordActivity } = require('../utils/auditLogger');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Article model
const Article = mongoose.model('Article', articleSchema);

// Python microservice URLs
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';
const PYTHON_PROCESS_ARTICLE_URL = `${PYTHON_API_URL}/process-article`;
const PYTHON_DELETE_URL = `${PYTHON_API_URL}/delete-document`; // Reusing delete endpoint for vectors

// Upload Article
const uploadArticle = async (req, res) => {
    try {
        const { category, is_private } = req.body;
        const userId = (req.user?.id) || null;
        const companyId = (req.user?.company_id) || req.company_id;
        
        // Convert is_private to boolean
        const isPrivate = is_private === 'true' || is_private === true;

        if (!req.file) {
            await recordActivity(req, { action: 'ARTICLE_UPLOAD', resource: '/knowledgebase/upload', result: 400, metadata: { reason: 'no_file' } });
            return res.status(400).json({ error: 'No file provided' });
        }

        if (!category) {
            await recordActivity(req, { action: 'ARTICLE_UPLOAD', resource: '/knowledgebase/upload', result: 400, metadata: { reason: 'missing_category' } });
            return res.status(400).json({ error: 'Category is required' });
        }

        if (!companyId) {
            await recordActivity(req, { action: 'ARTICLE_UPLOAD', resource: '/knowledgebase/upload', result: 401, metadata: { reason: 'missing_company' } });
            return res.status(401).json({ error: 'Company ID not provided' });
        }

        // Upload file to Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                folder: 'knowledgebase',
                public_id: `art_${Date.now()}`,
                type: 'upload',
            },
            async (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return res.status(500).json({ error: 'File upload failed' });
                }

                try {
                    // Create article record
                    const article = new Article({
                        company_id: companyId,
                        name: req.file.originalname,
                        category: category,
                        type: req.file.originalname.split('.').pop().toUpperCase(),
                        size: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
                        url: result.secure_url,
                        cloudinaryId: result.public_id,
                        uploaded_by: userId || undefined,
                        status: 'active',
                        is_private: isPrivate,
                        tags: [] 
                    });

                    const savedArticle = await article.save();
                    
                    // Process for Pinecone and get tags
                    processArticleForPinecone(
                        result.secure_url,
                        companyId,
                        userId,
                        savedArticle.id,
                        req.file.originalname,
                        category,
                        isPrivate
                    ).then(async (data) => {
                        console.log('Received data from Python service:', data); // Add logging
                        if (data.tags && data.tags.length > 0) {
                            savedArticle.tags = data.tags;
                            await savedArticle.save();
                            console.log(`Updated article ${savedArticle.id} with tags: ${data.tags}`);
                        } else {
                            console.log(`No tags returned for article ${savedArticle.id}`);
                        }
                    }).catch(err => {
                        console.error('Error processing article for Pinecone:', err);
                    });
                    
                    await recordActivity(req, {
                        action: 'ARTICLE_UPLOAD',
                        resource: savedArticle.name,
                        result: 201,
                        metadata: { articleId: savedArticle.id, path: '/knowledgebase/upload', name: savedArticle.name, category, isPrivate }
                    });

                    res.status(201).json({
                        message: 'Article uploaded successfully',
                        article: savedArticle,
                    });
                } catch (dbError) {
                    console.error('Database error:', dbError);
                    await recordActivity(req, { action: 'ARTICLE_UPLOAD', resource: '/knowledgebase/upload', result: 500, metadata: { error: dbError.message } });
                    res.status(500).json({ error: 'Failed to save article to database' });
                }
            }
        );

        uploadStream.end(req.file.buffer);
    } catch (error) {
        console.error('Error uploading article:', error);
        await recordActivity(req, { action: 'ARTICLE_UPLOAD', resource: '/knowledgebase/upload', result: 500, metadata: { error: error.message } });
        res.status(500).json({ error: 'Internal server error' });
    }
};

const processArticleForPinecone = async (articleUrl, companyId, userId, articleId, source, category, isPrivate) => {
    try {
        const formData = new URLSearchParams();
        formData.append('companyId', companyId);
        if (userId) formData.append('userId', userId);
        formData.append('articleId', articleId);
        formData.append('source', source);
        formData.append('url', articleUrl);
        if (category) formData.append('category', category);
        formData.append('isPrivate', isPrivate);

        const response = await axios.post(
            PYTHON_PROCESS_ARTICLE_URL,
            formData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 120000 
            }
        );

        console.log('Article processed and indexed in Pinecone:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error calling Python microservice:', error.message);
        throw error;
    }
};

const listArticles = async (req, res) => {
    try {
        const { category, search } = req.query;
        const companyId = req.user.company_id;
        const userId = req.user.id;

        if (!companyId) {
            return res.status(401).json({ error: 'Company ID not found in token' });
        }

        let query = { 
            status: 'active', 
            company_id: companyId,
            $or: [
                { is_private: false },
                // If is_private is true, uploaded_by must be userId
                { is_private: true, uploaded_by: userId }
            ]
        };

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const articles = await Article.find(query).sort({ uploadDate: -1 });

        res.status(200).json({
            message: 'Articles retrieved successfully',
            articles: articles,
            count: articles.length,
        });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
};

const deleteArticle = async (req, res) => {
    try {
        const { articleId } = req.params;
        const companyId = req.user?.company_id || req.company_id;
        const userId = req.user?.id;

        if (!companyId) {
            return res.status(401).json({ error: 'Company ID not found' });
        }

        const article = await Article.findById(articleId);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        if (article.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // If private, only uploader can delete? (Assuming yes)
        if (article.is_private && article.uploaded_by !== userId) {
             return res.status(403).json({ error: 'Access denied: Private article' });
        }

        if (article.cloudinaryId) {
            await cloudinary.uploader.destroy(article.cloudinaryId, { resource_type: 'raw' });
        }

        await Article.findByIdAndDelete(articleId);
        await recordActivity(req, { action: 'ARTICLE_DELETE', resource: article.name, result: 200, metadata: { articleId, path: `/knowledgebase/${articleId}`, name: article.name } });

        // Delete vectors from Pinecone
        try {
            await axios.post(PYTHON_DELETE_URL, {
                pdfId: article._id?.toString?.() || article.id,
                companyId: companyId,
                namespace: undefined
            });
        } catch (err) {
            console.error('Error deleting article vectors:', err?.response?.data || err.message);
        }

        res.status(200).json({ message: 'Article deleted successfully' });
    } catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json({ error: 'Failed to delete article' });
    }
};

// Reuse document view/download logic or implement simplified version
const viewArticle = async (req, res) => {
    try {
        const { articleId } = req.params;
        const companyId = req.user.company_id;
        const userId = req.user.id;

        const article = await Article.findById(articleId);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        if (article.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (article.is_private && article.uploaded_by !== userId) {
            return res.status(403).json({ error: 'Access denied: Private article' });
        }

        const viewUrl = cloudinary.url(article.cloudinaryId, {
            resource_type: 'raw',
            secure: true
        });

        res.status(200).json({
            message: 'View URL retrieved',
            viewUrl: viewUrl,
            fileName: article.name,
            fileType: article.type,
        });
    } catch (error) {
        console.error('Error getting view URL:', error);
        res.status(500).json({ error: 'Failed to get view URL' });
    }
};

module.exports = {
    uploadArticle,
    listArticles,
    deleteArticle,
    viewArticle
};
