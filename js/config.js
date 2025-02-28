// 环境配置
const env = {
    development: true,
    production: false
};

// 数据库配置
const dbConfig = {
    collections: {
      chatHistory: 'chatHistory'
    }
};

// 微信配置
const wxConfig = {
    appId: 'wx65a32d3a0d58bd92',
    scope: 'snsapi_userinfo',
    state: 'wxLogin',
    redirectUri: encodeURIComponent('your_redirect_uri')
};

// 云开发配置
const cloudConfig = {
    env: 'chat-nbt-0gynup7v274d685f',
    dataBse: 'chatHistory'
};

// 文件上传配置
const uploadConfig = {
    maxSize: 100 * 1024 * 1024, // 最大文件大小（100MB）
    maxFiles: 1000,
    totalSize: 10 * 1024 * 1024 * 1024, // 总容量限制（10GB）
    allowedImageTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp'
    ],
    allowedFileTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown'
    ]
};

// Kimi API配置
const kimiConfig = {
    apiKey: 'sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-32k',
    temperature: 0.3,
    maxTokens: 2000
};

module.exports = {
    env,
    dbConfig,
    wxConfig,
    cloudConfig,
    uploadConfig,
    kimiConfig
};