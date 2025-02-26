// 微信授权配置
const wxConfig = {
    // appId: 'wx65a32d3a0d58bd92', // 替换为实际的微信AppID
    appId: 'wxe302662c9cb50b09',
    scope: 'snsapi_userinfo',
    state: 'wxLogin',
    redirectUri: encodeURIComponent('your_redirect_uri') // 替换为实际的回调地址
};

// 云开发配置
const cloudConfig = {
    // env: 'chat-nbt-0gynup7v274d685f'
    env: 'chatnbt-0g1p6voscb752ba5',
    dataBse :'chatHistory'
};

// 后端API配置
const apiConfig = {
    endpoints: {
        login: 'login',
        upload: 'uploadFile',
        chat: 'chat',
        history: 'getHistory'
    }
};

// 文件上传配置
const uploadConfig = {
    maxSize: 100 * 1024 * 1024, // 最大文件大小（100MB）
    maxFiles: 1000, // 最大文件数量
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

module.exports = {
    wxConfig,
    cloudConfig,
    apiConfig,
    uploadConfig
};