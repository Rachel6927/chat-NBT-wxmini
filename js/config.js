// 数据库配置
const dbConfig = {
  collections: {
    chatHistory: 'chatHistory'
  }
};

// 微信小程序配置
const wxConfig = {
  // appId: 'wx65a32d3a0d58bd92',
  appId: 'wxe302662c9cb50b09',
  appSecret: 'your_app_secret',
  scope: 'snsapi_userinfo',
    state: 'wxLogin',
    redirectUri: encodeURIComponent('your_redirect_uri') // 替换为实际的回调地址
};

// 云开发环境配置
const cloudConfig = {
  // env: 'chat-nbt-0gynup7v274d685f'
  env: 'chatnbt-0g1p6voscb752ba5',
  dataBase :'chatHistory'
};

// 文件上传配置
const uploadConfig = {
  maxSize: 10 * 1024 * 1024, // 最大10MB
  maxFiles: 1000, // 最大文件数量
  totalSize: 10 * 1024 * 1024 * 1024, // 
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

// API配置
const apiConfig = {
  baseUrl: 'https://api.example.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  endpoints: {
    login: 'login',
    upload: 'uploadFile',
    chat: 'chat',
    history: 'getHistory'
}
};

// Kimi API配置
const kimiConfig = {
  apiKey: 'sk-TaERYsf2AnsmWtWtdj755LPUuBAMfzLJYtOoJPb8BcyRLa8m' || '',  // 从环境变量获取API密钥
  baseUrl: 'https://api.moonshot.cn/v1',
  // 模型配置
  models: {
    text: 'moonshot-v1-8k',          // 文本对话模型
    vision: 'moonshot-v1-8k-vision-preview'  // 视觉模型
  },
  temperature: 0.3,
  maxTokens: 2000,
  vision: {
    enabled: true,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']
  },
  // 系统提示词
  systemPrompt: '你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。',

  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  
  // 文件处理配置
  fileConfig: {
      purpose: 'file-extract',
      supportedTypes: ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg']
  }
};

// 环境配置
const env = {
  development: true,  // 默认为开发环境
  production: false,
  apiBaseUrl: 'http://localhost:3000',  // 默认API基础URL
  wsBaseUrl: 'ws://localhost:3000'  // 默认WebSocket基础URL
};

// 统一导出所有配置
module.exports = {
  dbConfig,
  wxConfig,
  cloudConfig,
  uploadConfig,
  apiConfig,
  kimiConfig,
  env
};