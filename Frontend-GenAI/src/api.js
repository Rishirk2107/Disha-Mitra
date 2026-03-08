
import axios from 'axios';

console.log("MODE:", import.meta.env.MODE);
console.log("BACKEND:", import.meta.env.VITE_BACKEND_URL);


// Load URLs from .env (Vite exposes variables as import.meta.env)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("VITE_BACKEND_URL missing in environment");
}


// Get JWT token from localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem('jwtToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Get company ID from user_details
export const getCompanyId = () => {
    const userDetails = localStorage.getItem('user_details');
    if (userDetails) {
        const user = JSON.parse(userDetails);
        return user.companyId || 1;
    }
    return 1;
};

// Get user details from localStorage
export const getUserDetails = () => {
    const userDetails = localStorage.getItem('user_details');
    if (userDetails) {
        return JSON.parse(userDetails);
    }
    return null;
};

// Team Chat API - Get chat history
export const getTeamChatHistory = async () => {
    try {
        const response = await axios.get(`${BACKEND_URL}/team-chat/history`, {
            headers: getAuthHeaders()
        });
        return response.data.messages;
    } catch (error) {
        console.error('Error fetching team chat history:', error);
        throw error;
    }
};

// Private Chat API - Get chat history with another user
export const getPrivateChatHistory = async (otherUserId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/team-chat/private/history/${otherUserId}`, {
            headers: getAuthHeaders()
        });
        return response.data.messages;
    } catch (error) {
        console.error('Error fetching private chat history:', error);
        throw error;
    }
};

export const sendPrompt = async (prompt) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/issue/chat`, {
            userMessage: prompt
        }, {
            headers: getAuthHeaders()
        });
        return response.data.botResponse;
    } catch (error) {
        console.error('Error sending prompt:', error);
        throw error;
    }
};

// Chat API - calls backend endpoint which stores history and calls Python API
export const sendChat = async (userMessage, sessionId) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/issue/chat`, {
            userMessage,
            sessionId
        }, {
            headers: getAuthHeaders()
        });
        return response.data.botResponse;
    } catch (error) {
        console.error('Error sending chat message:', error);
        throw error;
    }
};

// Authentication APIs
export const loginUser = async (email, password) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/auth/login`, {
            email,
            password
        });
        return response.data;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
};

export const companySignup = async (companyData) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/auth/company-signup`, companyData);
        return response.data;
    } catch (error) {
        console.error('Error during company signup:', error);
        throw error;
    }
};

// Document Upload API
export const uploadDocument = async (file, category) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('uploadedBy', localStorage.getItem('username') || 'Admin');
        
        const response = await axios.post(`${BACKEND_URL}/document/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...getAuthHeaders()
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
};

// List Documents API
export const listDocuments = async (category = 'all', search = '') => {
    try {
        const params = new URLSearchParams();
        if (category && category !== 'all') {
            params.append('category', category);
        }
        if (search) {
            params.append('search', search);
        }
        
        const response = await axios.get(`${BACKEND_URL}/document/list?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return response.data.documents || [];
    } catch (error) {
        console.error('Error listing documents:', error);
        throw error;
    }
};

// Download Document API
export const downloadDocument = async (documentId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/document/download/${documentId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error downloading document:', error);
        throw error;
    }
};

// View Document API (for inline viewing)
export const viewDocument = async (documentId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/document/view/${documentId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error viewing document:', error);
        throw error;
    }
};

// Delete Document API
export const deleteDocument = async (documentId) => {
    try {
        const response = await axios.delete(`${BACKEND_URL}/document/${documentId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
};

// Knowledge Base API
export const uploadArticle = async (file, category, isPrivate) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('is_private', isPrivate);
        formData.append('uploadedBy', localStorage.getItem('username') || 'User');
        
        const response = await axios.post(`${BACKEND_URL}/knowledgebase/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...getAuthHeaders()
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading article:', error);
        throw error;
    }
};

export const listArticles = async (category = 'all', search = '') => {
    try {
        const params = new URLSearchParams();
        if (category && category !== 'all') {
            params.append('category', category);
        }
        if (search) {
            params.append('search', search);
        }
        
        const response = await axios.get(`${BACKEND_URL}/knowledgebase/list?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return response.data.articles || [];
    } catch (error) {
        console.error('Error listing articles:', error);
        throw error;
    }
};

export const deleteArticle = async (articleId) => {
    try {
        const response = await axios.delete(`${BACKEND_URL}/knowledgebase/${articleId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting article:', error);
        throw error;
    }
};

export const viewArticle = async (articleId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/knowledgebase/view/${articleId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error viewing article:', error);
        throw error;
    }
};

// Audit Logs
export const getAuditLogs = async ({ search = '', result = 'all', action = '', start = '', end = '', page = 1, limit = 50 } = {}) => {
    try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (result) params.append('result', result);
        if (action) params.append('action', action);
        if (start) params.append('start', start);
        if (end) params.append('end', end);
        params.append('page', page);
        params.append('limit', limit);

        const response = await axios.get(`${BACKEND_URL}/audit/logs?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
    }
};
// User Management APIs
export const createUser = async (companyId, name, email, password, role) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/auth/create-user`, {
            companyId,
            name,
            email,
            password,
            role
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

export const listUsersByCompany = async (companyId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/auth/users/${companyId}`, {
            headers: getAuthHeaders()
        });
        return response.data.users || [];
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

// Role Management APIs
export const createRole = async (companyId, name, description, permissions, color) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/role/create`, {
            company_id: companyId,
            name,
            description,
            permissions,
            color
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating role:', error);
        throw error;
    }
};

export const listRolesByCompany = async (companyId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/role/list/${companyId}`, {
            headers: getAuthHeaders()
        });
        return response.data.roles || [];
    } catch (error) {
        console.error('Error fetching roles:', error);
        throw error;
    }
};

// PDF Upload API (Admin)
export const uploadPDF = async (file) => {
    try {
        const formData = new FormData();
        formData.append('pdf', file);
        
        const response = await axios.post(`${BACKEND_URL}/upload-pdf`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading PDF:', error);
        throw error;
    }
};

// API Key Management APIs
export const createAPIKey = async (name, permissions, expiresInDays) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/api-keys/generate`, {
            name,
            permissions,
            expiresInDays
        }, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating API key:', error);
        throw error;
    }
};

export const listAPIKeys = async () => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api-keys/list`, {
            headers: getAuthHeaders()
        });
        return response.data.apiKeys || [];
    } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
    }
};

export const revokeAPIKey = async (id) => {
    try {
        const response = await axios.delete(`${BACKEND_URL}/api-keys/${id}/revoke`, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error revoking API key:', error);
        throw error;
    }
};

export const regenerateAPIKey = async (id) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/api-keys/${id}/regenerate`, {}, {
            headers: getAuthHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error regenerating API key:', error);
        throw error;
    }
};

// API Usage Analytics
export const getAPIUsageAnalytics = async (period = '24h', keyId = null) => {
    try {
        const params = new URLSearchParams();
        params.append('period', period);
        if (keyId) params.append('keyId', keyId);
        const response = await axios.get(`${BACKEND_URL}/api-keys/analytics/usage?${params.toString()}`, {
            headers: getAuthHeaders()
        });
        return response.data.data;
    } catch (error) {
        console.error('Error fetching API usage analytics:', error);
        throw error;
    }
};

// Chat Sessions APIs
export const startChatSession = async (title = 'New Session') => {
    try {
        const response = await axios.post(`${BACKEND_URL}/issue/chat/session/start`, { title }, {
            headers: getAuthHeaders()
        });
        return response.data; // { success, sessionId, title }
    } catch (error) {
        console.error('Error starting chat session:', error);
        throw error;
    }
};

export const getChatSessions = async () => {
    try {
        const response = await axios.get(`${BACKEND_URL}/issue/chat/sessions`, {
            headers: getAuthHeaders()
        });
        return response.data.sessions || [];
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        throw error;
    }
};

export const getSessionMessages = async (sessionId) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/issue/chat/session/${sessionId}`, {
            headers: getAuthHeaders()
        });
        return response.data.messages || [];
    } catch (error) {
        console.error('Error fetching session messages:', error);
        throw error;
    }
};