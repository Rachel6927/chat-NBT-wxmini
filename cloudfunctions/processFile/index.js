const cloud = require('wx-server-sdk');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 初始化数据库
const db = cloud.database();
const _ = db.command;

// 文件大小限制（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 支持的文件类型
const SUPPORTED_FILE_TYPES = {
  'txt': { type: 'text', handler: content => content.toString('utf8') },
  'pdf': { type: 'document', handler: () => '暂不支持PDF解析' },
  'png': { type: 'image', handler: (content, type) => `data:image/${type};base64,${content.toString('base64')}` },
  'jpg': { type: 'image', handler: (content, type) => `data:image/${type};base64,${content.toString('base64')}` },
  'jpeg': { type: 'image', handler: (content, type) => `data:image/${type};base64,${content.toString('base64')}` },
  'gif': { type: 'image', handler: (content, type) => `data:image/${type};base64,${content.toString('base64')}` },
  'doc': { type: 'document', handler: content => {
    try {
      return content.toString('utf8');
    } catch (e) {
      return '文档解析失败，请确保文件格式正确';
    }
  }},
  'docx': { type: 'document', handler: content => {
    try {
      return content.toString('utf8');
    } catch (e) {
      return '文档解析失败，请确保文件格式正确';
    }
  }}
};

// 下载文件并重试
async function downloadFileWithRetry(fileID) {
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1秒

  while (retryCount < maxRetries) {
    try {
      const downloadResult = await cloud.downloadFile({ fileID });
      if (downloadResult && downloadResult.fileContent) {
        return downloadResult.fileContent;
      }
      throw new Error('文件下载不完整');
    } catch (error) {
      retryCount++;
      console.log(`下载重试第${retryCount}次`);
      if (retryCount === maxRetries) {
        throw new Error(`文件下载失败: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

// 处理文件内容
async function processFileContent(fileID, fileType) {
  try {
    const fileContent = await downloadFileWithRetry(fileID);
    const handler = SUPPORTED_FILE_TYPES[fileType.toLowerCase()];

    if (!handler) {
      throw new Error('不支持的文件类型');
    }

    return handler.handler(fileContent, fileType.toLowerCase());
  } catch (error) {
    console.error('处理文件内容失败:', error);
    throw error;
  }
}

// 保存文件记录到数据库
async function saveToDatabase(fileData) {
  const { fileID, fileType, fileName, fileSize, content } = fileData;
  try {
    const result = await db.collection('processedFiles').add({
      data: {
        fileID,
        fileType: fileType.toLowerCase(),
        fileName: fileName || '',
        fileSize: fileSize || 0,
        content,
        createTime: db.serverDate(),
        status: 'processed',
        updateTime: db.serverDate(),
        openid: cloud.getWXContext().OPENID || ''
      }
    });

    if (!result._id) {
      throw new Error('数据库插入失败');
    }

    return result._id;
  } catch (error) {
    console.error('数据库操作失败:', error);
    throw new Error(`数据库操作失败: ${error.message}`);
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { fileID, fileName, fileType } = event;
    
    // 下载文件
    const downloadResult = await cloud.downloadFile({
      fileID: fileID,
    });
    
    const filePath = downloadResult.tempFilePath;
    let content = '';

    switch (fileType) {
      case 'docx':
        // 使用 mammoth 处理 docx 文件
        const result = await mammoth.extractRawText({
          path: filePath
        });
        content = result.value;
        break;

      case 'doc':
        // 可以添加处理 doc 文件的逻辑
        throw new Error('暂不支持 DOC 格式，请转换为 DOCX 后上传');

      case 'pdf':
        // 可以添加处理 PDF 文件的逻辑
        throw new Error('暂不支持 PDF 格式');

      default:
        throw new Error('不支持的文件类型');
    }

    return {
      content,
      success: true
    };

  } catch (error) {
    console.error('处理文件失败:', error);
    return {
      error: error.message,
      success: false
    };
  }
};