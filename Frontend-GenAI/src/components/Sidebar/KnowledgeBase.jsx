import { useState, useEffect } from 'react';
import { uploadArticle, listArticles, deleteArticle, viewArticle } from '../../api';

const KnowledgeBase = () => {
    const [articles, setArticles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedUploadCategory, setSelectedUploadCategory] = useState('policies');
    const [isPrivateUpload, setIsPrivateUpload] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [viewedArticle, setViewedArticle] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    const categories = [
        { id: 'all', name: 'All Topics', icon: 'quiz' },
        { id: 'policies', name: 'Company Policies', icon: 'policy' },
        { id: 'procedures', name: 'Procedures', icon: 'list_alt' },
        { id: 'technical', name: 'Technical Docs', icon: 'engineering' },
        { id: 'hr', name: 'HR Guidelines', icon: 'people' }
    ];

    useEffect(() => {
        fetchArticles();
    }, [selectedCategory]);

    const fetchArticles = async () => {
        try {
            setIsLoading(true);
            const data = await listArticles(selectedCategory === 'all' ? '' : selectedCategory);
            setArticles(data);
        } catch (error) {
            console.error('Failed to fetch articles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadSubmit = async () => {
        if (!selectedFile) {
            setUploadError('Please select a file');
            return;
        }

        try {
            setUploadError('');
            setIsUploading(true);
            setUploadProgress(0);

            // Simulate progress
            let progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 100);

            await uploadArticle(selectedFile, selectedUploadCategory, isPrivateUpload);

            clearInterval(progressInterval);
            setUploadProgress(100);
            
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                setShowUploadModal(false);
                setSelectedFile(null);
                setIsPrivateUpload(false);
                fetchArticles();
            }, 500);
        } catch (error) {
            console.error('Upload failed:', error);
            setUploadError(error.response?.data?.error || 'Upload failed. Please try again.');
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteArticle = async (articleId) => {
        if (window.confirm('Are you sure you want to delete this article?')) {
            try {
                await deleteArticle(articleId);
                fetchArticles();
            } catch (error) {
                console.error('Delete failed:', error);
                alert('Failed to delete article');
            }
        }
    };

    const handleViewArticle = async (article) => {
        try {
            const { viewUrl } = await viewArticle(article._id || article.id);
            setViewedArticle({ ...article, url: viewUrl });
            setShowViewModal(true);
        } catch (error) {
            console.error('View failed:', error);
            alert('Failed to load article preview');
        }
    };

    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
        // Category matching
        const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });

    const getViewerSrc = (doc) => {
        if (!doc || !doc.url) return '';
        const isPdf = doc.type === 'PDF' || doc.name?.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            const encoded = encodeURIComponent(doc.url);
            return `https://docs.google.com/gview?url=${encoded}&embedded=true`;
        }
        return doc.url;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[#00796b] text-3xl">psychology</span>
                            <div>
                                <h1 className="text-3xl font-bold text-[#004d40] font-verdana">Knowledge Base</h1>
                                <p className="text-gray-600">Find answers and learn about company processes</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowUploadModal(true)}
                            className="bg-[#00796b] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#004d40] transition-colors duration-200 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Add Article
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search articles by name or tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00796b] focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Categories Sidebar */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-[#004d40] mb-4">Categories</h3>
                        <div className="space-y-2">
                            {categories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors duration-200 ${
                                        selectedCategory === category.id 
                                            ? 'bg-[#00796b] text-white' 
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-xl">{category.icon}</span>
                                        <span className="font-medium">{category.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">QUICK STATS</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Total Articles</span>
                                    <span className="font-semibold text-[#00796b]">{articles.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Private Articles</span>
                                    <span className="font-semibold text-[#00796b]">{articles.filter(a => a.is_private).length}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Articles List */}
                    <div className="lg:col-span-3 space-y-6">
                        {isLoading ? (
                             <div className="text-center py-12">
                                <span className="material-symbols-outlined text-4xl text-[#00796b] animate-spin">sync</span>
                                <p className="mt-2 text-gray-600">Loading articles...</p>
                            </div>
                        ) : filteredArticles.map(article => (
                            <div key={article._id || article.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-semibold text-[#004d40] cursor-pointer" onClick={() => handleViewArticle(article)}>
                                                {article.name}
                                            </h3>
                                            {article.is_private && (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">lock</span>
                                                    Private
                                                </span>
                                            )}
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                                                {article.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">schedule</span>
                                                <span>{new Date(article.uploadDate).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">category</span>
                                                <span>{categories.find(c => c.id === article.category)?.name || article.category}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">storage</span>
                                                <span>{article.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button 
                                            onClick={() => handleViewArticle(article)}
                                            className="p-2 text-gray-500 hover:text-[#00796b] hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                            title="View"
                                        >
                                            <span className="material-symbols-outlined">visibility</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteArticle(article._id || article.id)}
                                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                            title="Delete"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Tags */}
                                {article.tags && article.tags.length > 0 && (
                                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-xs">label</span>
                                            Tags:
                                        </span>
                                        {article.tags.map((tag, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 bg-[#e0f2f1] text-[#00796b] text-xs rounded-full cursor-pointer hover:bg-[#00796b] hover:text-white transition-colors duration-200"
                                                onClick={() => setSearchTerm(tag)}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => handleViewArticle(article)}
                                        className="bg-[#00796b] text-white px-4 py-2 rounded-lg hover:bg-[#004d40] transition-colors duration-200 text-sm"
                                    >
                                        Read Article
                                    </button>
                                </div>
                            </div>
                        ))}

                        {!isLoading && filteredArticles.length === 0 && (
                            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search_off</span>
                                <h3 className="text-xl font-semibold text-gray-600 mb-2">No articles found</h3>
                                <p className="text-gray-500 mb-4">Try adjusting your search terms or browse different categories.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                        <div className="bg-[#00796b] text-white p-6 rounded-t-lg flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined">upload_file</span>
                                Upload Article
                            </h2>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFile(null);
                                    setUploadError('');
                                }}
                                className="text-white hover:bg-[#004d40] p-1 rounded transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {uploadError && (
                                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                                    <p className="text-sm">{uploadError}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Category
                                </label>
                                <select
                                    value={selectedUploadCategory}
                                    onChange={(e) => setSelectedUploadCategory(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00796b] focus:border-transparent bg-white"
                                >
                                    {categories.filter(cat => cat.id !== 'all').map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Privacy Toggle */}
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out">
                                    <input
                                        type="checkbox"
                                        id="privacy-toggle"
                                        className="peer absolute opacity-0 w-0 h-0"
                                        checked={isPrivateUpload}
                                        onChange={(e) => setIsPrivateUpload(e.target.checked)}
                                    />
                                    <label
                                        htmlFor="privacy-toggle"
                                        className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ${
                                            isPrivateUpload ? 'bg-[#00796b]' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span className={`block h-4 w-4 ml-1 mt-1 bg-white rounded-full shadow transform transition-transform duration-200 ${
                                            isPrivateUpload ? 'translate-x-4' : 'translate-x-0'
                                        }`} />
                                    </label>
                                </div>
                                <div>
                                    <label htmlFor="privacy-toggle" className="block text-sm font-semibold text-gray-700 cursor-pointer">
                                        Private Article
                                    </label>
                                    <p className="text-xs text-gray-500">Only visible to you</p>
                                </div>
                            </div>

                            {selectedFile && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm font-medium text-gray-700 mb-1">Selected File:</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-600">description</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-600 truncate">{selectedFile.name}</p>
                                            <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor="modalFileInput"
                                    className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#00796b] hover:bg-[#f5f7fa] transition-colors"
                                >
                                    <span className="material-symbols-outlined text-4xl text-gray-400 block mb-2">cloud_upload</span>
                                    <p className="text-sm font-medium text-gray-700">Choose a file</p>
                                    <p className="text-xs text-gray-500 mt-1">PDF, DOCX, TXT up to 50MB</p>
                                </label>
                                <input
                                    type="file"
                                    id="modalFileInput"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={(e) => {
                                        const files = e.target.files;
                                        if (files && files.length > 0) {
                                            setSelectedFile(files[0]);
                                            setUploadError('');
                                        }
                                    }}
                                    className="hidden"
                                />
                            </div>

                            {isUploading && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="material-symbols-outlined text-[#00796b] animate-spin">sync</span>
                                        <p className="text-sm font-medium text-gray-700">Uploading...</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-[#00796b] h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setSelectedFile(null);
                                    setUploadError('');
                                }}
                                disabled={isUploading}
                                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadSubmit}
                                disabled={isUploading || !selectedFile}
                                className="px-6 py-2 bg-[#00796b] text-white rounded-lg hover:bg-[#004d40] transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">upload</span>
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {showViewModal && viewedArticle && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col">
                        <div className="bg-[#00796b] text-white p-4 rounded-t-lg flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2 truncate">
                                <span className="material-symbols-outlined">visibility</span>
                                {viewedArticle.name}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowViewModal(false);
                                    setViewedArticle(null);
                                }}
                                className="text-white hover:bg-[#004d40] p-2 rounded transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden bg-gray-100">
                             <iframe
                                src={getViewerSrc(viewedArticle)}
                                className="w-full h-full border-0"
                                title="Article viewer"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
