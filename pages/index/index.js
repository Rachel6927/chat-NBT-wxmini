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
    uploadQueue: [],
    isUploading: false,
    expandedFiles: []  // 用来记录哪些图片已经被放大
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
      currentChatId: null,
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
                type: 'image_url',
                image_url: {
                  url: `data:image/${fileType};base64,${base64}`
                }
              }
            ]
          };
          segments = [
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
            content: [
              {
                type: 'text',
                text:`这是一个文本文件，内容如下：\n${textContent}\n请你根据文本内容完成下列要求：`
              }
            ]
          };
          segments = [
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
              wx.uploadFile({
                url: 'https://api.moonshot.cn/v1/files',
                filePath: file.path,
                name: 'file',
                formData: {
                  purpose: 'file-extract',
                  filename: file.name
                },
                header: {
                  'Authorization': `Bearer ${kimiConfig.apiKey}`,
                  'Accept': 'application/json'
                },
                success: (res) => {
                  if (res.statusCode === 200) {
                    try {
                      const result = JSON.parse(res.data);
                      if (result.error) {
                        reject(new Error(result.error.message || '文件上传失败'));
                      } else {
                        resolve(result);
                      }
                    } catch (e) {
                      reject(new Error('解析响应失败：' + e.message));
                    }
                  } else if (res.statusCode === 401) {
                    reject(new Error('API密钥无效或已过期'));
                  } else if (res.statusCode === 413) {
                    reject(new Error('文件大小超过服务器限制'));
                  } else {
                    reject(new Error(`文件上传失败：HTTP ${res.statusCode}`));
                  }
                },
                fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
              });
            });

            // 获取文件内容
            const contentRes = await new Promise((resolve, reject) => {
              wx.request({
                url: `https://api.moonshot.cn/v1/files/${uploadRes.id}/content`,
                method: 'GET',
                header: {
                  'Authorization': `Bearer ${kimiConfig.apiKey}`,
                  'Accept': 'application/json'
                },
                success: (res) => {
                  if (res.statusCode === 200) {
                    if (res.data) {
                      resolve(res.data);
                    } else {
                      reject(new Error('获取文件内容失败：响应数据为空'));
                    }
                  } else if (res.statusCode === 401) {
                    reject(new Error('API密钥无效或已过期'));
                  } else if (res.statusCode === 404) {
                    reject(new Error('文件不存在或已被删除'));
                  } else {
                    reject(new Error(`获取文件内容失败：HTTP ${res.statusCode}`));
                  }
                },
                fail: (err) => {
                  console.error('请求失败:', err);
                  reject(new Error('网络请求失败，请检查网络连接'));
                }
              });
            });

            if (!contentRes) {
              throw new Error('获取文件内容失败：响应数据为空');
            }
            content = {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:`我上传了一个 ${fileType.toUpperCase()} 文件，文件完整内容如下：\n${contentRes.text || contentRes.content || ''} \n 请你根据给出的文件内容完成下列要求：`
                }
              ]
            };
            // content = {
            //   role: 'user',
            //   content: `这是一个 ${fileType.toUpperCase()} 文件，内容如下：\n${contentRes.text || contentRes.content || ''} \n请你根据文本内容完成下列要求：`
            // };

            segments = [
              {
                type: 'file',
                name: file.name,
                size: this.formatFileSize(file.size),
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
        }  else {
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

  removeSelectedFile() {
    this.setData({
      selectedFile: null
    });
  },

  async sendMessage() {
    const { inputValue, messages, selectedFile, currentChatId } = this.data;

    // 如果有选中的文件但没有输入文字，提示用户
    if (selectedFile && !inputValue.trim()) {
      wx.showToast({
        title: '请输入描述文字',
        icon: 'none'
      });
      return;
    }

    if (!inputValue.trim() && !selectedFile) return;

    try{
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
        userMessage.content.content.push(
          {
            type: 'text',
            text: inputValue.trim()
          }
        )
      } else {
        userMessage.content = inputValue.trim();
      }

      // 更新消息列表
      messages.push(userMessage);

      if(currentChatId==null){
        try {
          const db = wx.cloud.database();
          const result = await db.collection('chatHistory').add({
            data: {
              createTime: db.serverDate(),
              updateTime: db.serverDate(),
              title: this.data.inputValue.slice(0, 20), // 使用第一条消息作为标题
              messages: [userMessage]
            }
          });
          this.setData({
            currentChatId:result._id
          });
        } catch (error) {
          console.error('创建新会话失败:', error);
        }
      } else {
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
      this.setData({
        messages,
        inputValue: '',
        selectedFile: null
      },()=>{
        this.scrollToBottom();
      });
      this.sendToServer(userMessage.content);
    } catch (error) {
      console.error('发送消息失败:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
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
    // 判断是否是图片消息并构建正确的消息格式
    let requestContent;
    if (typeof content === 'object' && Array.isArray(content.content)) {
      // 处理已经是数组格式的消息
      requestContent = content.content;
    } else {
      requestContent = [
        {
          type: 'text',
          text: typeof content === 'string' ? content : JSON.stringify(content)
        }
      ];
    }
    const requestData = {
      model: 'moonshot-v1-8k-vision-preview',
      messages: [
        {
          role: 'system',
          content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手。'
        },
        {
          role: 'user',
          content: requestContent
        }
      ],
      temperature: 0.3,
      stream: true
    };

    // 打印请求数据以便调试
    // console.log('Request data:', JSON.stringify(requestData, null, 2));

    wx.request({
      url: 'https://api.moonshot.cn/v1/chat/completions',
      method: 'POST', 
      data: requestData,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kimiConfig.apiKey}`,
        'Accept': 'text/event-stream'
      },
      success: async(res) => {
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
            
            const processNextChunk = async() => {
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
                    this.setData({ messages }, () => {
                      this.scrollToBottom();
                    });
                    
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
  // 处理消息输出
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
  // 开始录音
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

  // 添加滚动到底部的方法
  scrollToBottom() {
    setTimeout(() =>{
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
      },50)
  },

  // 切换文件预览大小
  toggleFilePreview(e) {
    const index = e.currentTarget.dataset.index;
    const expandedFiles = { ...this.data.expandedFiles };
    expandedFiles[index] = !expandedFiles[index];
    console.log(expandedFiles)
    this.setData({
      expandedFiles
    });
  },
  
  toggleSidebar() {
    this.setData({
      sidebarOpen: !this.data.sidebarOpen
    });
  },
})