import { apiConfig, wxConfig, uploadConfig, kimiConfig } from '../../js/config.js';

Page({
  data: {
    messages: [],
    inputValue: '',
    recording: false,
    sidebarOpen: false,
    recorderManager: null
  },

  onLoad() {
    // 检查云环境初始化
    if (!wx.cloud) {
      wx.showToast({
        title: '请使用 2.2.3 或以上的基础库',
        icon: 'none'
      });
      return;
    }
    
    // 确保云环境已初始化
    wx.cloud.init({
      env: 'chat-nbt-0gynup7v274d685f',
      traceUser: true
    });
    
    this.checkLogin();
    this.initData();
    // 初始化录音管理器
    this.setData({
      recorderManager: wx.getRecorderManager()
    });
    this.initRecorderManager();
  },

  initData() {
    const messages = [
      {
        type: 'system',
        content: '欢迎使用Chat NBT',
        avatar: '/img/system-avatar.png'
      }
    ];
    this.setData({ messages });
  },

  initRecorderManager() {
    const recorderManager = this.data.recorderManager;
    
    recorderManager.onStart(() => {
      console.log('录音开始');
    });

    recorderManager.onStop((res) => {
      const { tempFilePath } = res;
      console.log('录音结束，文件路径：', tempFilePath);
      
      // 上传语音文件
      wx.uploadFile({
        url: 'https://api.moonshot.cn/upload/voice',
        filePath: tempFilePath,
        name: 'file',
        header: {
          'Authorization': wx.getStorageSync('token')
        },
        formData: {
          type: 'voice'
        },
        success: (uploadRes) => {
          try {
            const result = JSON.parse(uploadRes.data);
            const voiceUrl = result.url;
            const voiceMessage = {
              type: 'user',
              content: '[语音]',
              avatar: '/img/user-avatar.png',
              voiceUrl: voiceUrl
            };
            this.setData({
              messages: [...this.data.messages, voiceMessage]
            });
            // 发送语音消息到服务器
            this.sendToServer(`[语音消息]${voiceUrl}`);
          } catch (error) {
            console.error('上传语音失败:', error);
            wx.showToast({
              title: '上传失败',
              icon: 'none'
            });
          }
        },
        fail: (error) => {
          console.error('语音上传失败:', error);
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
        }
      });
    });

    recorderManager.onError((res) => {
      console.error('录音错误：', res);
      this.setData({ recording: false });
      wx.showToast({
        title: '录音出错',
        icon: 'none'
      });
    });
  },

  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  sendMessage() {
    const { inputValue, messages } = this.data;
    if (!inputValue.trim()) return;

    const userMessage = {
      type: 'user',
      content: inputValue,
      avatar: '/img/user-avatar.png'
    };

    this.setData({
      messages: [...messages, userMessage],
      inputValue: ''
    });

    this.sendToServer(inputValue);
  },

  chooseDocument() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['txt', 'doc', 'docx', 'pdf'],
      success: async (res) => {
        // 添加安全检查
        if (!res || !res.tempFiles || !res.tempFiles[0]) {
          console.error('未获取到文件信息');
          return;
        }

        const tempFile = res.tempFiles[0];
        // 确保文件名存在
        const fileName = tempFile.name || `file-${Date.now()}`;
        const fileSize = tempFile.size || 0;
        const tempFilePath = tempFile.path;
        
        // 检查文件大小
        if (fileSize > uploadConfig.maxSize) {
          wx.showToast({
            title: `文件大小超过${uploadConfig.maxSize / 1024 / 1024}MB限制`,
            icon: 'none',
            duration: 2000
          });
          return;
        }
    
        // 显示文件消息
        const fileMessage = {
          type: 'user',
          content: `[文件] ${fileName}`,
          avatar: '/img/user-avatar.png'
        };
    
        this.setData({
          messages: [...this.data.messages, fileMessage]
        });
    
        try {
          // 上传文件到云存储
          const cloudPath = `files/${Date.now()}-${fileName}`;
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath,
            filePath: tempFilePath,
            timeout: 60000
          });
    
          if (!uploadResult || !uploadResult.fileID) {
            throw new Error('文件上传失败');
          }
    
          // 调用processFile云函数处理文件
          const processResult = await wx.cloud.callFunction({
            name: 'processFile',
            data: {
              fileID: uploadResult.fileID,
              fileType: fileName.split('.').pop().toLowerCase(),
              fileName: fileName,
              fileSize: fileSize
            }
          });
    
          wx.hideLoading();
    
          if (!processResult.result || processResult.result.code !== 0) {
            throw new Error(processResult.result?.message || '文件处理失败');
          }
    
          // 调用Kimi API
          const kimiResponse = await this.callKimiAPI(processResult.result.data.content, fileName);
          
          // 添加Kimi的响应消息
          const kimiMessage = {
            type: 'system',
            content: kimiResponse,
            avatar: '/img/system-avatar.png'
          };
          
          this.setData({
            messages: [...this.data.messages, kimiMessage]
          });
        } catch (error) {
          console.error('处理文件失败:', error);
          wx.hideLoading();
          wx.showToast({
            title: error.message || '处理文件失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  async uploadFileToKimi(filePath, fileType) {
    try {
      let fileContent;
      const fs = wx.getFileSystemManager();
      
      // 根据文件类型进行不同处理
      if (fileType.startsWith('text/') || fileType.includes('document')) {
        // 文本文件直接读取内容
        fileContent = fs.readFileSync(filePath, 'utf8');
      } else if (fileType.startsWith('image/')) {
        // 图片文件转为base64
        const base64 = fs.readFileSync(filePath, 'base64');
        fileContent = `data:${fileType};base64,${base64}`;
      } else {
        throw new Error('不支持的文件类型');
      }

      // 直接发送文件内容到Kimi API
      const response = await wx.request({
        url: `${kimiConfig.baseUrl}/chat/completions`,
        method: 'POST',
        data: {
          model: kimiConfig.model,
          messages: [
            {
              role: 'system',
              content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手...'
            },
            {
              role: 'system',
              content: `文件内容：${fileContent}`
            }
          ],
          temperature: kimiConfig.temperature
        },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kimiConfig.apiKey}`
        }
      });

      if (response.statusCode === 200 && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('调用Kimi API失败：' + (response.data.error || '未知错误'));
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      throw error;
    }
  },

  async callKimiAPI(content, fileType, fileId) {
    try {
      let messages = [
        {
          role: 'system',
          content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手...'
        }
      ];

      // 根据文件类型选择合适的模型
      const model = fileType && fileType.startsWith('image/') ? 
        kimiConfig.models.image : kimiConfig.models.text;

      if (fileId) {
        const fileContent = await this.getFileContent(fileId);
        if (fileType && fileType.startsWith('image/')) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: content
              },
              {
                type: 'image_url',
                image_url: {
                  url: fileContent
                }
              }
            ]
          });
        } else {
          messages.push({
            role: 'system',
            content: `文件内容：${fileContent}`
          });
          messages.push({
            role: 'user',
            content: content
          });
        }
      } else {
        messages.push({
          role: 'user',
          content: content
        });
      }

      const response = await wx.request({
        url: `${kimiConfig.baseUrl}/chat/completions`,
        method: 'POST',
        data: {
          model: model,
          messages: messages,
          temperature: kimiConfig.temperature
        },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kimiConfig.apiKey}`
        }
      });

      if (response.statusCode === 200 && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('调用Kimi API失败：' + (response.data.error || '未知错误'));
      }
    } catch (error) {
      console.error('Kimi API错误:', error);
      throw error;
    }
  },

  async getFileContent(fileId) {
    try {
      const response = await wx.request({
        url: `${kimiConfig.baseUrl}/files/${fileId}/content`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${kimiConfig.apiKey}`
        }
      });

      if (response.statusCode === 200) {
        return response.data.content;
      } else {
        throw new Error('获取文件内容失败');
      }
    } catch (error) {
      console.error('获取文件内容错误:', error);
      throw error;
    }
  },

  chooseImage() {
    // 检查网络状态
    wx.getNetworkType({
      success: async (networkRes) => {
        if (networkRes.networkType === 'none') {
          wx.showToast({
            title: '请检查网络连接',
            icon: 'none'
          });
          return;
        }

        try {
          const res = await wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera']
          });

          const tempFilePath = res.tempFilePaths[0];
          
          // 获取图片信息
          const imageInfo = await wx.getImageInfo({
            src: tempFilePath
          });

          // 检查文件大小是否超过10MB
          const fileInfo = await wx.getFileInfo({
            filePath: tempFilePath
          });

          let finalFilePath = tempFilePath;
          
          // 如果图片大于2MB，进行压缩
          if (fileInfo.size > 2 * 1024 * 1024) {
            const compressRes = await wx.compressImage({
              src: tempFilePath,
              quality: 80
            });
            finalFilePath = compressRes.tempFilePath;
          }
          
          // 上传图片到云存储，添加超时处理
          const fileName = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;  // 使用固定长度随机字符串
          const cloudPath = `images/${fileName}.jpg`;  // 统一使用jpg格式，确保路径合法
          
          const uploadPromise = wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: finalFilePath,
            timeout: 30000 // 设置30秒超时
          });

          // 创建超时Promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('上传超时，请重试'));
            }, 30000);
          });

          // 使用Promise.race进行超时控制
          const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

          if (!uploadResult || !uploadResult.fileID) {
            throw new Error('文件上传失败');
          }

          // 获取图片临时链接
          const tempUrlRes = await wx.cloud.getTempFileURL({
            fileList: [uploadResult.fileID]
          });

          if (!tempUrlRes.fileList || !tempUrlRes.fileList[0].tempFileURL) {
            throw new Error('获取图片链接失败');
          }

          const imageUrl = tempUrlRes.fileList[0].tempFileURL;
ndex
          // 调用processFile云函数处理图片
          const processResult = await wx.cloud.callFunction({
            name: 'processFile',
            data: {
              fileID: uploadResult.fileID,
              fileType: 'jpg',
              fileName: `${fileName}.jpg`,
              fileSize: fileInfo.size
            }
          });

          if (!processResult.result || !processResult.result.success) {
            throw new Error(processResult.result?.error || '图片处理失败');
          }

          const imageMessage = {
            type: 'user',
            content: '[图片]',
            avatar: '/img/user-avatar.png',
            imageUrl: imageUrl,
            fileID: uploadResult.fileID
          };

          this.setData({
            messages: [...this.data.messages, imageMessage]
          });

          this.sendToServer(`请分析这张图片：${imageUrl}`);
          console.log('图片处理完成，fileID:', uploadResult.fileID);
        } catch (error) {
          console.error('图片处理失败:', error);
          let errorMessage = '上传失败，请重试';
          
          if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '上传超时，请检查网络';
          } else if (error.errMsg && error.errMsg.includes('chooseImage:fail')) {
            errorMessage = '选择图片失败';
          }

          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络状态获取失败',
          icon: 'none'
        });
      }
    });
  },

  startRecord() {
    if (this.data.recording) {
      this.data.recorderManager.stop();
      this.setData({ recording: false });
      return;
    }

    // 获取录音权限
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ recording: true });
        this.data.recorderManager.start({
          duration: 60000, // 最长录音时间，单位ms
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'mp3'
        });
      },
      fail: () => {
        wx.showToast({
          title: '请授权录音权限',
          icon: 'none'
        });
      }
    });
  },

  toggleSidebar() {
    this.setData({
      sidebarOpen: !this.data.sidebarOpen
    });
  },

  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '复制成功',
          icon: 'success'
        });
      }
    });
  },

  checkLogin() {
    wx.getStorage({
      key: 'userInfo',
      success: (res) => {
        this.setData({
          userInfo: res.data,
          isLoggedIn: true
        });
      }
    });
  },

  async login() {
    // 检查是否已经登录
    if (this.data.isLoggedIn) {
      wx.showToast({
        title: '您已经登录',
        icon: 'success'
      });
      return;
    }

    // 检查云环境是否初始化
    if (!wx.cloud) {
      wx.showToast({
        title: '请使用 2.2.3 或以上的基础库',
        icon: 'none'
      });
      return;
    }

    try {
      // 先获取用户信息
      const userProfileRes = await wx.getUserProfile({
        desc: '用于完善会员资料',
        lang: 'zh_CN'
      });

      // 获取登录凭证
      const loginRes = await wx.login();
      
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 调用云函数进行登录
      const cloudLoginRes = await wx.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code,
          userInfo: userProfileRes.userInfo,
          appId: wxConfig.appId
        }
      });

      if (!cloudLoginRes.result || !cloudLoginRes.result.openid) {
        throw new Error('登录失败');
      }

      // 保存用户信息和登录态
      const userInfo = userProfileRes.userInfo;
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('openid', cloudLoginRes.result.openid);
      
      this.setData({
        userInfo: userInfo,
        isLoggedIn: true
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('登录失败:', error);
      let errorMessage = '登录失败，请重试';
      
      if (error.errMsg && error.errMsg.includes('getUserProfile:fail auth deny')) {
        errorMessage = '您已拒绝授权，部分功能可能无法使用';
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      });
    }
  },
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  openPDF(e) {
    const url = e.currentTarget.dataset.url;
    wx.downloadFile({
      url: url,
      success: (res) => {
        const filePath = res.tempFilePath;
        wx.openDocument({
          filePath: filePath,
          success: () => {
            console.log('打开PDF成功');
          },
          fail: () => {
            wx.showToast({
              title: '打开PDF失败',
              icon: 'none'
            });
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '下载PDF失败',
          icon: 'none'
        });
      }
    });
  },

  sendToServer(content) {
    const botMessage = {
      type: 'bot',
      content: '',
      avatar: '/img/system-avatar.png'
    };

    this.setData({
      messages: [...this.data.messages, botMessage]
    });

    const messages = this.data.messages;
    const messageIndex = messages.length - 1;

    // 添加请求延迟和重试机制
    const makeRequest = (retryCount = 0, delay = 1000) => {
      setTimeout(() => {
        wx.request({
          url: 'https://api.moonshot.cn/v1/chat/completions',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98',
            'Accept': 'text/event-stream'
          },
          responseType: 'text',
          data: {
            model: 'moonshot-v1-8k',
            messages: [
              {
                role: 'system',
                content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。'
              },
              {
                role: 'user',
                content: content
              }
            ],
            stream: true
          },
          success: (res) => {
            if (res.statusCode === 200) {
              try {
                // 处理流式响应数据
                const lines = res.data.split('\n');
                let botResponse = '';
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const jsonData = line.slice(6); // 移除 'data: ' 前缀
                    if (jsonData.trim() === '[DONE]') continue;
                    
                    try {
                      const result = JSON.parse(jsonData);
                      if (result.choices && result.choices[0]) {
                        const content = result.choices[0].delta?.content || '';
                        botResponse += content;
                        messages[messageIndex].content = botResponse;
                        this.setData({ messages });
                      }
                    } catch (e) {
                      console.warn('解析数据行失败:', e);
                      continue;
                    }
                  }
                }
                
                if (!botResponse) {
                  throw new Error('未收到有效响应');
                }
              } catch (error) {
                console.error('处理响应失败:', error);
                messages[messageIndex].content = '抱歉，我遇到了一些问题，请稍后再试。';
                this.setData({ messages });
              }
            } else if (res.statusCode === 429 && retryCount < 3) {
              // 处理频率限制，使用指数退避算法
              const nextDelay = delay * 2;
              console.log(`请求频率限制，${delay/1000}秒后重试(${retryCount + 1}/3)...`);
              makeRequest(retryCount + 1, nextDelay);
            } else {
              messages[messageIndex].content = res.statusCode === 429 ? 
                '抱歉，当前请求较多，请稍后再试。' : 
                '抱歉，服务暂时不可用，请稍后再试。';
              this.setData({ messages });
            }
          },
          fail: (error) => {
            console.error('请求失败:', error);
            messages[messageIndex].content = '网络错误，请检查网络连接。';
            this.setData({ messages });
          }
        });
      }, delay);
    };

    makeRequest();
  }
})