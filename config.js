// 数据库表结构配置
const dbConfig = {
  collections: {
    chatHistory: {
      name: 'chatHistory',
      fields: {
        _id: 'string',           // 记录ID
        _openid: 'string',       // 用户openid
        messages: 'array',       // 消息记录数组
        title: 'string',         // 对话标题
        createTime: 'timestamp', // 创建时间
        updateTime: 'timestamp'  // 更新时间
      }
    }
  }
};

// 微信小程序配置
const wxConfig = {
  appId: 'wx65a32d3a0d58bd92',
  appSecret: 'your_app_secret'
};

// 云开发环境配置
const cloudConfig = {
    env: 'chat-nbt-0gynup7v274d685f',
    dataBse :'chatHistory'
};

// 文件上传配置
const uploadConfig = {
  maxSize: 10 * 1024 * 1024, // 最大10MB
  allowedTypes: [
    '.jpg',
    '.jpeg',
    '.png',
    '.pdf',
    '.txt',
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain'
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
    apiKey: 'sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98',
    baseUrl: 'https://api.moonshot.cn/v1',  // 修改 baseURL 为 baseUrl
    model: 'moonshot-v1-8k',
    temperature: 0.7,
    systemPrompt: '你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。',
    headers: {
      'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98',
      'Content-Type': 'application/json'
    },
    timeout: 30000,  // 减少超时时间为30秒
    retries: 3,      // 减少重试次数为3
    retryDelay: 1000 // 减少重试间隔为1秒
  };

// 环境配置
const env = {
  development: true,  // 默认为开发环境
  apiBaseUrl: 'http://localhost:3000',  // 默认API基础URL
  wsBaseUrl: 'ws://localhost:3000'  // 默认WebSocket基础URL
};

// 使用 ES Module 导出
export {
  dbConfig,
  wxConfig,
  cloudConfig,
  uploadConfig,
  apiConfig,
  kimiConfig,
  env
};