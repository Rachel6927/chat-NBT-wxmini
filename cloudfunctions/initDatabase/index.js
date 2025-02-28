const cloud = require('wx-server-sdk')

cloud.init({
  env: 'chat-nbt-0gynup7v274d685f'
})

exports.main = async (event, context) => {
  const db = cloud.database()
  
  try {
    // 创建 chatHistory 集合
    await db.createCollection('chatHistory')
    console.log('chatHistory 集合创建成功')
    
    return {
      code: 0,
      message: '数据库初始化成功'
    }
  } catch (error) {
    console.error('数据库初始化失败:', error)
    return {
      code: -1,
      message: '数据库初始化失败',
      error: error
    }
  }
}