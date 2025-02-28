// 导入配置
import { wxConfig, apiConfig, uploadConfig, cloudConfig } from './config.js';

// 初始化应用
App({
    globalData: {
        userInfo: null,
        isLoggedIn: false,
        openid: '',
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
            
            // 恢复登录状态
            const token = wx.getStorageSync('token');
            const userInfo = wx.getStorageSync('userInfo');
            if (token && userInfo) {
                this.globalData.token = token;
                this.globalData.userInfo = userInfo;
                this.globalData.isLoggedIn = true;
                this.globalData.openid = userInfo.openid;
            }
        } catch (error) {
            console.error('初始化失败:', error);
        }
    },

    // 处理登录
    async handleLogin(code, phoneNumber) {
        try {
            const { result } = await wx.cloud.callFunction({
                name: 'login',
                data: { code, phoneNumber }
            });

            if (!result?.openid) {
                throw new Error('登录失败');
            }

            const userInfo = {
                openid: result.openid,
                phoneNumber,
                updateTime: new Date()
            };

            // 更新用户信息
            const db = wx.cloud.database();
            await db.collection('userInfo')
                .where({ openid: result.openid })
                .upsert({ data: userInfo });

            // 更新状态
            this.globalData.userInfo = userInfo;
            this.globalData.isLoggedIn = true;
            this.globalData.openid = result.openid;
            this.globalData.token = result.token;

            wx.setStorageSync('userInfo', userInfo);
            wx.setStorageSync('token', result.token);

            return userInfo;
        } catch (error) {
            console.error('登录失败:', error);
            wx.showToast({
                title: error.message || '登录失败',
                icon: 'none'
            });
            return null;
        }
    },

    // 处理退出登录
    handleLogout() {
        Object.assign(this.globalData, {
            userInfo: null,
            isLoggedIn: false,
            openid: '',
            token: ''
        });
        
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('token');
    },

    // 处理文件上传
    async handleFileUpload(tempFilePath, type = 'file') {
        if (!this.globalData.isLoggedIn) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return null;
        }

        try {
            // 验证文件类型和大小
            const fileInfo = await wx.getFileInfo({ filePath: tempFilePath });
            const fileExtension = tempFilePath.split('.').pop().toLowerCase();
            const mimeType = `${type}/${fileExtension}`;
            
            if (!uploadConfig.allowedFileTypes.includes(mimeType) && 
                !uploadConfig.allowedImageTypes.includes(mimeType)) {
                throw new Error('不支持的文件类型');
            }

            if (fileInfo.size > uploadConfig.maxSize) {
                throw new Error(`文件大小不能超过${uploadConfig.maxSize / 1024 / 1024}MB`);
            }

            // 上传文件
            const fileName = tempFilePath.split('/').pop().replace(/[^a-zA-Z0-9.-]/g, '_');
            const cloudPath = `${this.globalData.openid}/${Date.now()}-${fileName}`;
            
            const { fileID } = await wx.cloud.uploadFile({
                cloudPath,
                filePath: tempFilePath
            });

            // 处理文件
            const { result } = await wx.cloud.callFunction({
                name: 'processFile',
                data: {
                    fileID,
                    fileName,
                    fileType: fileExtension,
                    fileSize: fileInfo.size
                }
            });

            if (result.code !== 0) {
                throw new Error(result.message || '文件处理失败');
            }

            return result.data;
        } catch (error) {
            console.error('上传失败:', error);
            wx.showToast({
                title: error.message || '上传失败',
                icon: 'none'
            });
            return null;
        }
    }
});