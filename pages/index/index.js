import { apiConfig, wxConfig, uploadConfig, kimiConfig, cloudConfig } from '../../js/config.js';

Page({
  data: {
    messages: [],
    inputValue: '',
    recording: false,
    sidebarOpen: false,
    recorderManager: null,
    selectedFile: null,
    currentChatId: null,  // 当前会话ID
    expandedFiles: {}, // 记录展开状态的文件
    uploadQueue: [],
    isUploading: false
  },


  onLoad() {
    this.checkLogin();
    this.initData();
    // 初始化录音管理器
    this.setData({
      recorderManager: wx.getRecorderManager()
    });
    this.initRecorderManager();
  },

  createNewChat() {
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
        role: 'assistant',
        content: '欢迎使用Chat NBT',
        avatar: '/img/system-avatar.png',
        segments: [{
          type: 'text',
          content: '欢迎使用Chat NBT'
        }]
      }
    ];
    this.setData({ messages });
    this.setData({
      inputValue: '',
      recording: false,
      sidebarOpen: false,
      recorderManager: null,
      selectedFile: null,
      currentChatId: null
    })
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

  async loadChatHistory(chatHistoryId) {
    try {
      const db = wx.cloud.database();

      const result = await db.collection('chatHistory')
        .doc(chatHistoryId)
        .get();
      if (result.data) {
        this.setData({
          currentChatId: chatHistoryId,
          messages: result.data.messages
        });
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  },

  async sendMessage() {
    const { inputValue, messages, selectedFile } = this.data;

    // 如果有选中的文件但没有输入文字，提示用户
    if (selectedFile && !inputValue.trim()) {
      wx.showToast({
        title: '请输入描述文字',
        icon: 'none'
      });
      return;
    }

    if (!inputValue.trim() && !selectedFile) return;

    try {
      const userMessage = {
        role: 'user',
        avatar: '/img/user-avatar.png',
        segments: []
      };

      // 添加文本内容
      if (inputValue.trim()) {
        userMessage.segments.push({
          type: 'text',
          content: inputValue.trim()
        });
      }

      // 添加文件内容
      if (selectedFile) {
        userMessage.segments.push(...selectedFile.segments);
        userMessage.content = selectedFile.content;
      } else {
        userMessage.content = inputValue.trim();
      }

      // 更新消息列表
      messages.push(userMessage);
      this.setData({
        messages,
        inputValue: '',
        selectedFile: null
      });

      // 发送到服务器
      await this.sendToServer(userMessage.content);

      // 滚动到底部
      this.scrollToBottom();

    } catch (error) {
      console.error('发送消息失败:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
  },

  async uploadFileToKimi(filePath, fileType, fileName) {
    const fs = wx.getFileSystemManager();
    let content;
    let messages = [
      {
        role: 'system',
        content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手。请帮助分析和理解用户上传的内容。'
      }
    ];

    // 根据文件类型进行不同处理
    if (fileType.endsWith('txt')) {
      try {
        content = fs.readFileSync(filePath, 'utf8');
        messages.push({
          role: 'user',
          content: `这是一个文本文件 ${fileName}，内容如下：\n${content}`
        });
      } catch (error) {
        throw new Error('读取文件失败，请重试');
      }
    }
    else if (['png', 'jpg', 'jpeg'].includes(fileType.toLowerCase())) {
      try {
        const base64 = fs.readFileSync(filePath, 'base64');
        const imageUrl = `data:image/${fileType};base64,${base64}`;
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `这是一张图片 ${fileName}，请帮我分析图片内容。`
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        });

        // 设置预览信息
        this.setData({
          selectedFile: {
            preview: imageUrl,
            name: fileName,
            formattedSize: this.formatFileSize(fs.statSync(filePath).size),
            segments: [
              {
                type: 'image',
                url: imageUrl
              }
            ],
            content: `[图片] ${fileName}`
          }
        });
      } catch (error) {
        throw new Error('读取图片失败，请重试');
      }
    }
    else if (['doc', 'docx', 'pdf'].includes(fileType)) {
      try {
        // 使用现有的 uploadFileToKimi 方法处理文件
        const response = await this.uploadFileToKimi(filePath, fileType, fileName);

        content = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `这是一个 ${fileType.toUpperCase()} 文件 ${fileName}，请帮我分析文件内容。`
            },
            {
              type: 'text',
              text: response // 文件内容
            }
          ]
        };

        segments = [
          {
            type: 'text',
            content: `发送了一个 ${fileType.toUpperCase()} 文件`
          },
          {
            type: 'file',
            name: fileName,
            size: this.formatFileSize(fs.statSync(filePath).size),
            type: fileType
          }
        ];

      } catch (error) {
        console.error('文件处理失败:', error);
        wx.showToast({
          title: error.message || '文件处理失败',
          icon: 'none'
        });
        return;
      }
    }
    else {
      throw new Error('暂不支持该文件类型，请使用文本或图片文件');
    }

    // API 请求部分
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const maxRetries = 3;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          await delay(2000);
        }

        const response = await wx.request({
          url: 'https://api.moonshot.cn/v1/chat/completions',
          method: 'POST',
          data: {
            model: 'moonshot-v1-8k',
            messages: messages.map(msg => {
              if (Array.isArray(msg.content)) {
                return msg;
              }
              return {
                role: msg.role,
                content: msg.content
              };
            }),
            temperature: 0.3,
            stream: false
          },
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
          }
        });

        if (!response.statusCode) {
          throw new Error('网络请求失败');
        }

        if (response.statusCode === 429) {
          await delay(3000);
          continue;
        }

        if (response.statusCode !== 200) {
          throw new Error(`API请求失败: ${response.data?.error?.message || '未知错误'}`);
        }

        const result = response.data;
        if (!result.choices?.[0]?.message?.content) {
          throw new Error('API 响应格式不正确');
        }

        return result.choices[0].message.content;

      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          continue;
        }
      }
    }

    throw lastError || new Error('请求失败，请稍后重试');
  },

  async handleFileUpload() {
    try {
      // 先检查网络状态
      const networkRes = await wx.getNetworkType();
      if (networkRes.networkType === 'none') {
        wx.showToast({
          title: '无网络连接',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      // 选择文件
      const fileRes = await wx.chooseMessageFile({
        count: 1,
        type: 'file'
      });

      if (!fileRes.tempFiles || !fileRes.tempFiles[0]) {
        return; // 用户取消选择文件，直接返回
      }

      const file = fileRes.tempFiles[0];
      const fileType = file.name.split('.').pop().toLowerCase();

      // 检查文件类型
      if (['png', 'jpg', 'jpeg'].includes(fileType)) {
        wx.showToast({
          title: '暂不支持图片处理',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      // 显示加载中
      wx.showLoading({
        title: '处理中...',
        mask: true // 添加遮罩防止重复操作
      });

      try {
        const response = await this.uploadFileToKimi(file.path, fileType, file.name);

        // 更新消息列表
        const fileMessage = {
          role: 'user',
          content: `[${file.name}]`,
          segments: [{
            type: 'file',
            content: file.name
          }],
          avatar: '/img/user-avatar.png',
          fileInfo: {
            name: file.name,
            type: fileType,
            size: file.size
          }
        };

        this.setData({
          messages: [...this.data.messages, fileMessage],
          selectedFile: null
        });

        // 发送到服务器并处理响应
        await this.sendToServer(response);

      } finally {
        // 确保在内部 try-catch 中也会隐藏 loading
        wx.hideLoading();
      }

    } catch (error) {
      // 外部错误处理
      wx.showToast({
        title: error.message || '文件处理失败',
        icon: 'none',
        duration: 2000
      });
      wx.hideLoading(); // 确保在外部错误时也会隐藏 loading
    }
  },

  async chooseDocument() {
    try {
      const networkRes = await wx.getNetworkType();
      if (networkRes.networkType === 'none') {
        wx.showToast({
          title: '请检查网络连接',
          icon: 'none'
        });
        return;
      }

      const fileRes = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['txt', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'pdf']
      });

      if (!fileRes.tempFiles || !fileRes.tempFiles[0]) return;

      const file = fileRes.tempFiles[0];
      const fileType = file.name.split('.').pop().toLowerCase();
      const fs = wx.getFileSystemManager();

      try {
        let content;
        let segments;

        // 根据文件类型进行不同处理
        if (['png', 'jpg', 'jpeg'].includes(fileType)) {
          // 处理图片
          const base64 = fs.readFileSync(file.path, 'base64');
          content = {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `这是一张图片 ${file.name}，请帮我分析图片内容。`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${fileType};base64,${base64}`
                }
              }
            ]
          };
          segments = [
            {
              type: 'text',
              content: '发送了一张图片'
            },
            {
              type: 'image',
              url: file.path
            }
          ];
        } else if (fileType === 'txt') {
          // 处理文本文件
          const textContent = fs.readFileSync(file.path, 'utf8');
          content = {
            role: 'user',
            content: `这是一个文本文件，内容如下：\n${textContent}`
          };
          segments = [
            {
              type: 'text',
              content: '发送了一个文本文件'
            },
            {
              type: 'file',
              name: file.name,
              size: this.formatFileSize(file.size),
              content: textContent
            }
          ];
        } else if (['doc', 'docx', 'pdf'].includes(fileType)) {
          wx.showLoading({
            title: '处理文件中...',
            mask: true
          });

          try {
            // 读取文件内容
            const fileContent = fs.readFileSync(file.path, 'base64');

            // 构建表单数据
            const formData = {
              file: fileContent,
              filename: file.name,
              purpose: 'file-extract'
            };

            // 上传文件
            const uploadRes = await new Promise((resolve, reject) => {
              wx.request({
                url: 'https://api.moonshot.cn/v1/files',
                method: 'POST',
                header: {
                  'Content-Type': 'multipart/form-data',
                  'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
                },
                data: formData,
                success: (res) => {
                  if (res.statusCode === 200 && res.data && res.data.id) {
                    resolve(res.data);
                  } else {
                    reject(new Error('文件上传失败'));
                  }
                },
                fail: (err) => reject(new Error(err.errMsg || '上传失败'))
              });
            });

            // 获取文件内容
            const contentRes = await wx.request({
              url: `https://api.moonshot.cn/v1/files/${uploadRes.id}/content`,
              method: 'GET',
              header: {
                'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
              }
            });

            if (!contentRes.data || !contentRes.data.text) {
              throw new Error('获取文件内容失败');
            }

            content = {
              role: 'user',
              content: `这是一个 ${fileType.toUpperCase()} 文件，内容如下：\n${contentRes.data.text}`
            };

            segments = [
              {
                type: 'text',
                content: `发送了一个 ${fileType.toUpperCase()} 文件`
              },
              {
                type: 'file',
                name: file.name,
                size: this.formatFileSize(file.size),
                type: fileType
              }
            ];

          } catch (error) {
            console.error('文件处理失败:', error);
            wx.showToast({
              title: error.message || '文件处理失败',
              icon: 'none'
            });
            return;
          } finally {
            wx.hideLoading();
          }
        } else {
          throw new Error('不支持的文件类型');
        }

        // 设置选中的文件
        this.setData({
          selectedFile: {
            ...file,
            preview: ['png', 'jpg', 'jpeg'].includes(fileType) ? file.path : null,
            formattedSize: this.formatFileSize(file.size),
            type: fileType,
            content: content,
            segments: segments
          }
        });

      } catch (error) {
        console.error('处理文件失败:', error);
        wx.showToast({
          title: error.message || '处理文件失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('选择文件失败:', error);
      wx.showToast({
        title: '选择文件失败',
        icon: 'none'
      });
    }
  },

  // 修改文件上传方法
  async uploadFileToServer(file) {
    // 添加到队列
    const uploadPromise = new Promise((resolve, reject) => {
      this.data.uploadQueue.push({
        file,
        resolve,
        reject
      });
    });

    // 如果当前没有上传任务，开始处理队列
    if (!this.data.isUploading) {
      this.processUploadQueue();
    }

    return uploadPromise;
  },

  // 处理上传队列
  async processUploadQueue() {
    if (this.data.uploadQueue.length === 0 || this.data.isUploading) {
      return;
    }

    this.setData({ isUploading: true });

    try {
      const task = this.data.uploadQueue[0];

      wx.showLoading({
        title: '处理文件中...',
        mask: true
      });

      // 上传文件
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadTask = wx.uploadFile({
          url: 'https://api.moonshot.cn/v1/files',
          filePath: task.file.path,
          name: 'file',
          formData: {
            purpose: 'file-extract'
          },
          header: {
            'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
          },
          success: (res) => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(res.data));
              } catch (e) {
                reject(new Error('解析响应失败'));
              }
            } else {
              reject(new Error('文件上传失败'));
            }
          },
          fail: reject
        });

        // 监听上传进度
        uploadTask.onProgressUpdate((res) => {
          console.log('上传进度', res.progress);
        });
      });

      if (!uploadResult.id) {
        throw new Error('文件上传失败');
      }

      // 获取文件内容
      const contentResult = await new Promise((resolve, reject) => {
        wx.request({
          url: `https://api.moonshot.cn/v1/files/${uploadResult.id}/content`,
          method: 'GET',
          header: {
            'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
          },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject(new Error('获取文件内容失败'));
            }
          },
          fail: reject
        });
      });

      if (!contentResult.text) {
        throw new Error('获取文件内容失败');
      }

      // 成功处理当前任务
      task.resolve(contentResult.text);

    } catch (error) {
      // 处理错误
      this.data.uploadQueue[0].reject(error);
    } finally {
      wx.hideLoading();

      // 移除已处理的任务
      this.data.uploadQueue.shift();

      // 重置上传状态
      this.setData({ isUploading: false });

      // 如果队列中还有任务，继续处理
      if (this.data.uploadQueue.length > 0) {
        setTimeout(() => {
          this.processUploadQueue();
        }, 500); // 添加延时，避免过快发起新请求
      }
    }
  },

  // 在页面卸载时清空队列
  onUnload() {
    this.setData({
      uploadQueue: [],
      isUploading: false
    });
  },

  // 添加文件大小格式化方法
  formatFileSize(size) {
    if (size < 1024) {
      return size + 'B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + 'KB';
    } else {
      return (size / (1024 * 1024)).toFixed(1) + 'MB';
    }
  },

  removeSelectedFile() {
    this.setData({
      selectedFile: null
    });
  },

  async callKimiAPI(content, fileType, fileId) {
    try {
      let messages = [
        {
          role: 'system',
          content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手...'
        }
      ];

      if (fileId) {
        const fileContent = await this.getFileContent(fileId);
        messages.push({
          role: 'system',
          content: `文件内容：${fileContent}`
        });
      }

      messages.push({
        role: 'user',
        content: content
      });

      const response = await wx.request({
        url: `${kimiConfig.baseUrl}/chat/completions`,
        method: 'POST',
        data: {
          model: kimiConfig.model,
          messages: messages,
          temperature: kimiConfig.temperature
        },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kimiConfig.apiKey}`
        }
      });

      if (!response || !response.statusCode) {
        throw new Error('网络请求失败，请检查网络连接');
      }

      if (response.statusCode !== 200) {
        throw new Error(`API请求失败：HTTP ${response.statusCode}`);
      }

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error('API返回数据格式错误');
      }

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Kimi API错误:', error);
      throw new Error(`Kimi API错误: ${error.message || '未知错误'}`);
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
          const imageMessage = {
            type: 'user',
            content: '[图片]',
            avatar: '/img/user-avatar.png',
            imageUrl: imageUrl,
            imageType: 'image/jpeg'
          };

          this.setData({
            messages: [...this.data.messages, imageMessage]
          });

          // 直接发送图片消息给服务器
          this.sendToServer({
            text: '请分析这张图片',
            image: {
              url: imageUrl,
              type: 'image/jpeg'
            }
          });
        } catch (error) {
          console.error('图片处理失败:', error);
          let errorMessage = '上传失败，请重试';

          if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '上传超时，请检查网络';
          } else if (error.errMsg && error.errMsg.includes('chooseImage:fail')) {
            errorMessage = '选择图片失败';
          } else if (error.errMsg && error.errMsg.includes('uploadFile:fail')) {
            errorMessage = '图片上传失败，请重试';
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
    const message = e.currentTarget.dataset.message;
    let content = message.content;

    // 如果消息包含segments，则拼接所有文本内容
    if (message.segments && message.segments.length > 0) {
      content = message.segments
        .map(segment => segment.content)
        .join('\n');
    }

    // 如果消息包含代码块，确保代码块内容也被复制
    if (message.codeBlocks && message.codeBlocks.length > 0) {
      content = message.codeBlocks
        .map(block => `${block.language}:\n${block.code}`)
        .join('\n\n');
    }

    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '复制成功',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
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
  chooseFile() {
    this.chooseDocument();
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

  async sendToServer(content) {
    const messages = this.data.messages;
    const messageIndex = messages.length;

    messages.push({
      role: 'assistant',
      content: '',
      avatar: '/img/system-avatar.png',
      segments: []
    });

    this.setData({ messages });

    // 判断是否是图片消息
    const isImageMessage = typeof content === 'object' && content.image;

    let requestMessages = [
      {
        role: 'system',
        content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手。'
      }
    ];

    // 根据消息类型构建不同的请求格式
    if (content && typeof content === 'object') {
      if (content.image) {
        // 图片消息
        requestMessages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: content.text || '请分析这张图片'
            },
            {
              type: 'image_url',
              image_url: {
                url: content.image.url,
                detail: 'auto'  // 添加 detail 参数
              }
            }
          ]
        });
      } else if (content.file) {
        // 文件消息
        requestMessages.push({
          role: 'user',
          content: `[文件内容] ${content.file.content || ''}
${content.text || ''}`
        });
      } else {
        // 其他对象类型消息
        requestMessages.push({
          role: 'user',
          content: JSON.stringify(content)
        });
      }
    } else {
      // 纯文本消息
      requestMessages.push({
        role: 'user',
        content: content
      });
    }

    wx.request({
      url: 'https://api.moonshot.cn/v1/chat/completions',
      method: 'POST',
      data: {
        model: content && typeof content === 'object' && content.image ? 'moonshot-v1-8k-vision-preview' : 'moonshot-v1-8k',
        messages: requestMessages,
        temperature: 0.3,
        stream: content && typeof content === 'object' && content.file ? false : true
      },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98'
      },
      success: async (res) => {
        if (res.statusCode === 404) {
          console.error('API端点不存在:', res);
          messages[messageIndex].segments = [{
            type: 'text',
            content: '抱歉，服务暂时不可用，请稍后再试。'
          }];
          this.setData({ messages });
          return;
        }
        if (res.statusCode === 200) {
          try {
            // 处理流式响应数据
            const lines = res.data.split('\n');
            let botResponse = '';
            let currentIndex = 0;

            const processNextChunk = async () => {
              if (currentIndex >= lines.length) return;

              const line = lines[currentIndex];
              if (line.startsWith('data: ')) {
                const jsonData = line.slice(6);
                if (jsonData.trim() === '[DONE]') {
                  currentIndex++;
                  setTimeout(processNextChunk, 50);
                  return;
                }

                try {
                  const result = JSON.parse(jsonData);
                  if (result.choices && result.choices[0]) {
                    const content = result.choices[0].delta?.content || '';
                    botResponse += content;
                    // 处理消息中的代码块
                    const segments = this.processMessage(botResponse);
                    messages[messageIndex].segments = segments;
                    await this.setData({ messages });

                    // 确保每次更新消息后都滚动到底部
                    this.scrollToBottom();

                    currentIndex++;
                    setTimeout(processNextChunk, 50);

                    // 更新数据库
                    if (this.data.currentChatId) {
                      try {
                        const db = wx.cloud.database();
                        await db.collection('chatHistory').doc(this.data.currentChatId).update({
                          data: {
                            messages: messages,
                            updateTime: db.serverDate()
                          }
                        });
                      } catch (error) {
                        console.error('更新会话失败:', error);
                      }
                    }
                  }
                } catch (e) {
                  console.error('解析响应数据失败:', e);
                  currentIndex++;
                  setTimeout(processNextChunk, 50);
                }
              } else {
                currentIndex++;
                setTimeout(processNextChunk, 50);
              }
            };

            processNextChunk();
          } catch (error) {
            console.error('处理响应失败:', error);
          }
        } else {
          console.error('请求失败:', res);
          messages[messageIndex].segments = [{
            type: 'text',
            content: '抱歉，服务器响应异常，请稍后再试。'
          }];
          this.setData({ messages });
        }
      },
      fail: (error) => {
        console.error('请求失败:', error);
        messages[messageIndex].segments = [{
          type: 'text',
          content: '抱歉，网络请求失败，请检查网络连接。'
        }];
        this.setData({ messages });
      }
    });
  },

  processMessage(content) {
    // 处理消息中的代码块
    const codeBlockRegex = /```(.*?)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    const segments = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // 添加代码块之前的文本
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      // 添加代码块
      segments.push({
        type: 'code',
        language: match[1].trim() || 'plaintext',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加最后一段文本
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return segments;
  },

  // 在接收到消息响应时调用
  handleResponse(response) {
    const segments = this.processMessage(response.content);
    const messages = this.data.messages;
    messages.push({
      role: 'assistant',
      segments: segments
    });

    this.setData({ messages });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '代码已复制',
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  // 优化滚动到底部的方法
  scrollToBottom() {
    setTimeout(() => {
      wx.createSelectorQuery()
        .select('.message-list')
        .boundingClientRect(rect => {
          if (rect) {
            this.setData({
              scrollTop: 100000000 // 使用一个足够大的数字
            });
          }
        })
        .exec();
    }, 100); // 添加延时确保内容已更新
  },

  // 切换文件预览大小
  toggleFilePreview(e) {
    const index = e.currentTarget.dataset.index;
    const expandedFiles = { ...this.data.expandedFiles };
    expandedFiles[index] = !expandedFiles[index];

    this.setData({
      expandedFiles
    });
  }
})
