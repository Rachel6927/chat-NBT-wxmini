// 数据库表结构配置
const dbConfig = {
  collections: {
    chatRecords: {
      name: 'chatRecords',
      fields: {
        _id: 'string',           // 记录ID
        openid: 'string',        // 用户openid
        fileID: 'string',        // 云存储文件ID
        fileName: 'string',      // 文件名称
        fileType: 'string',      // 文件类型（image/pdf/txt）
        fileSize: 'number',      // 文件大小（字节）
        content: 'string',       // 用户输入的文本内容
        response: 'string',      // 大模型的回复内容
        status: 'number',        // 状态（0:待处理, 1:处理中, 2:已完成, -1:失败）
        createTime: 'timestamp', // 创建时间
        updateTime: 'timestamp', // 更新时间
      }
    }
  }
};

// 微信小程序配置
const wxConfig = {
  // appId: 'wx65a32d3a0d58bd92',
  appId: 'wxe302662c9cb50b09',
  appSecret: 'your_app_secret'
  
};

// 云开发环境配置
const cloudConfig = {
  // env: 'chat-nbt-0gynup7v274d685f'
  env: 'chatnbt-0g1p6voscb752ba5'
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
  }
};

// Kimi API配置
const kimiConfig = {
  apiKey: 'sk-TaERYsf2AnsmWtWtdj755LPUuBAMfzLJYtOoJPb8BcyRLa8m' || '',  // 从环境变量获取API密钥
  baseUrl: 'https://api.moonshot.cn/v1',
  model: 'moonshot-v1-32k',
  temperature: 0.3,
  maxTokens: 2000
};

// 环境配置
const env = {
  development: true,  // 默认为开发环境
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