// 导入配置
const { wxConfig, apiConfig, uploadConfig, cloudConfig } = require('./config.js');

// 初始化小程序
App({
    globalData: {
        userInfo: null,
        isLoggedIn: false,
        user_openid: '',
        phoneNumber: '',
        token: ''
    },

    onLaunch: function() {
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
            return;
        }
        try {
            wx.cloud.init({
                env: cloudConfig.env,
                traceUser: true
            });
            console.log('云开发环境初始化成功');
            
            // 检查本地存储的登录状态
            const token = wx.getStorageSync('token');
            const userInfo = wx.getStorageSync('userInfo');
            if (token && userInfo) {
                this.globalData.token = token;
                this.globalData.userInfo = userInfo;
                this.globalData.isLoggedIn = true;
                this.globalData.user_openid = userInfo.openid;
                console.log('已从本地存储恢复登录状态');
            }
        } catch (error) {
            console.error('云开发环境初始化失败:', error);
        }
    },

    // 处理用户登录
    handleLogin: async function(code, phoneNumber) {
        try {
            if (!code) {
                throw new Error('登录code获取失败');
            }

            // 调用登录接口
            const loginResult = await wx.cloud.callFunction({
                name: 'login',
                data: {
                    code: code,
                    phoneNumber: phoneNumber
                }
            });

            if (!loginResult.result || !loginResult.result.openid) {
                throw new Error('登录失败，请重试');
            }

            const userInfo = {
                openid: loginResult.result.openid,
                phoneNumber: phoneNumber,
                updateTime: new Date()
            };

            // 更新数据库中的用户信息
            const db = wx.cloud.database();
            const { data } = await db.collection('userInfo').where({
                _openid: loginResult.result.openid
            }).get();

            if (data && data.length > 0) {
                await db.collection('userInfo').doc(data[0]._id).update({
                    data: userInfo
                });
            } else {
                await db.collection('userInfo').add({
                    data: userInfo
                });
            }

            // 更新全局状态
            this.globalData.userInfo = userInfo;
            this.globalData.isLoggedIn = true;
            this.globalData.user_openid = loginResult.result.openid;
            this.globalData.phoneNumber = phoneNumber;

            // 保存到本地存储
            wx.setStorageSync('userInfo', userInfo);
            if (loginResult.result.token) {
                this.globalData.token = loginResult.result.token;
                wx.setStorageSync('token', loginResult.result.token);
            }

            wx.showToast({
                title: '登录成功',
                icon: 'success'
            });

            return userInfo;
        } catch (error) {
            console.error('登录失败:', error);
            wx.showToast({
                title: error.message || '登录失败，请重试',
                icon: 'none'
            });
            return null;
        }
    },

    // 处理退出登录
    handleLogout: function() {
        this.globalData.userInfo = null;
        this.globalData.isLoggedIn = false;
        this.globalData.user_openid = '';
        this.globalData.phoneNumber = '';
        this.globalData.token = '';
        
        // 清除本地存储
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('token');
        
        wx.showToast({
            title: '已退出登录',
            icon: 'success'
        });
    },

    // 处理文件上传
    handleFileUpload: async function(tempFilePath, type = 'file') {
        if (!this.globalData.isLoggedIn) {
            wx.showToast({
                title: '请先登录',
                icon: 'none'
            });
            return null;
        }

        try {
            // 检查文件类型
            const fileExtension = tempFilePath.split('.').pop().toLowerCase();
            const mimeType = `${type}/${fileExtension}`;
            if (!uploadConfig.allowedTypes.includes(`.${fileExtension}`) && 
                !uploadConfig.allowedTypes.includes(mimeType)) {
                wx.showToast({
                    title: '不支持的文件类型',
                    icon: 'none'
                });
                return null;
            }

            // 获取文件信息并验证大小
            const fileInfo = await wx.getFileInfo({
                filePath: tempFilePath
            }).catch(err => {
                console.error('获取文件信息失败:', err);
                throw new Error('文件读取失败');
            });

            if (fileInfo.size > uploadConfig.maxSize) {
                wx.showToast({
                    title: '文件大小超过限制',
                    icon: 'none'
                });
                return null;
            }

            // 上传文件到云存储，添加超时处理
            const cloudPath = `${this.globalData.user_openid}/${Date.now()}-${tempFilePath.split('/').pop()}`;
            const uploadPromise = wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath,
                timeout: 60000  // 设置60秒超时
            });

            // 创建超时Promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('上传超时，请检查网络后重试'));
                }, 60000);
            });

            // 使用Promise.race进行超时控制
            const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

            if (!uploadResult || !uploadResult.fileID) {
                throw new Error('文件上传失败，请重试');
            }

            // 调用processFile云函数处理文件
            const processResult = await wx.cloud.callFunction({
                name: 'processFile',
                data: {
                    fileID: uploadResult.fileID,
                    fileType: fileExtension
                }
            });

            if (processResult.result.code !== 0) {
                throw new Error(processResult.result.message || '文件处理失败');
            }

            wx.showToast({
                title: '处理成功',
                icon: 'success'
            });

            return processResult.result.data;
        } catch (error) {
            console.error('上传失败:', error);
            let errorMessage = '上传失败，请重试';
            
            if (error.message.includes('timeout') || error.message.includes('超时')) {
                errorMessage = '上传超时，请检查网络';
            } else if (error.errMsg && error.errMsg.includes('exceed')) {
                errorMessage = '文件大小超过限制';
            }

            wx.showToast({
                title: errorMessage,
                icon: 'none',
                duration: 2000
            });
            return null;
        }
    },

    // 保存聊天记录
    saveToHistory: async function(userMessage, botReply) {
        if (!this.globalData.isLoggedIn) return;

        try {
            await wx.cloud.database().collection('chatHistory').add({
                data: {
                    userMessage,
                    botReply,
                    timestamp: new Date(),
                    _openid: this.globalData.user_openid
                }
            });
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    },

    // 加载历史记录
    loadHistory: async function() {
        if (!this.globalData.isLoggedIn) return [];

        try {
            const { data } = await wx.cloud.database()
                .collection('chatHistory')
                .where({
                    _openid: this.globalData.user_openid
                })
                .orderBy('timestamp', 'desc')
                .get();

            return data;
        } catch (error) {
            console.error('加载历史记录失败:', error);
            return [];
        }
    }
});