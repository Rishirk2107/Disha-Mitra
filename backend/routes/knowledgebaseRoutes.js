const express = require('express');
const multer = require('multer');
const knowledgebaseController = require('../controller/knowledgebase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
});

// Routes
router.post('/upload', verifyToken, upload.single('file'), knowledgebaseController.uploadArticle);
router.get('/list', verifyToken, knowledgebaseController.listArticles);
router.delete('/:articleId', verifyToken, knowledgebaseController.deleteArticle);
router.get('/view/:articleId', verifyToken, knowledgebaseController.viewArticle);

module.exports = router;
