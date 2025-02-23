// 导入配置
import { wxConfig, apiConfig, uploadConfig, cloudConfig } from './config.js';

// 初始化应用
App({
    onLaunch: function() {
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        } else {
            wx.cloud.init({
                env: cloudConfig.env,
                traceUser: true
            });
            console.log('云开发环境初始化成功');
        }
        
        this.globalData = {};
    },
    globalData: {}
});