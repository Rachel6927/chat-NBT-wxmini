// 导入配置
import { wxConfig, apiConfig, uploadConfig, cloudConfig } from './js/config';

// 初始化应用
App({
    globalData: {
      openid: '', 
    },

    data: {
      canIUse: wx.canIUse('button.open-type.getUserInfo')
    },

    onLaunch: function() {      
        if (!wx.cloud) {
            console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        } else {
            wx.cloud.init({
                env: cloudConfig.env,
                traceUser: true
            });
            console.log('云开发环境初始化成功');
        };

        //授权登录
        wx.cloud.callFunction({
          name: 'cloudbase_module',
          data: {
            name: 'wx_user_get_open_id',
          },
          //获取openid
          success: (res) => {
            const openId = res.result?.openId;
            const db = wx.cloud.database();
            //判断用户是否授权过
            db.collection('userInfo').where({
              _openid:openId
            }).get({
              success:res => {
                //用户未授权过
                if(res.data.length==0){
                  wx.showModal({
                    title: '请登录',
                    content: '是否微信授权登录？',
                    success: (res) => {
                      if (res.confirm) {       
                        wx.getUserInfo({
                          success:(res)=>{
                            const result = db.collection('userInfo').add({
                              data: {
                                avaUrl:res.userInfo.avatarUrl,
                                nickName:res.userInfo.nickName
                              }
                            });
                          }
                        })
                      } else if (res.cancel)  {
                        wx.exitMiniProgram()
                      }
                    }
                  })
                }
              }
            })
            this.globalData.openid = openId;                 
          },
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
});