// 文件问答组件
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    fileInfo: null,
    userInput: '',
    isLoading: false,
    previewContent: '',
    apiKey: 'sk-cGB1pPSaLF8alrvHGtpdyESXPS0rky6H0VtQ0jVRE9K3FS98',
    baseUrl: 'https://api.moonshot.cn/v1'
  },

  methods: {
    // 选择文件
    async chooseFile() {
      try {
        const res = await wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['doc', 'docx', 'pdf']
        });

        if (!res.tempFiles || !res.tempFiles[0]) return;

        const file = res.tempFiles[0];
        const fileType = file.name.split('.').pop().toLowerCase();

        // 上传文件到 Moonshot API
        await this.uploadFile(file.path, fileType, file.name);
      } catch (error) {
        console.error('选择文件失败:', error);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    },

    // 上传文件到 Moonshot API
    async uploadFile(filePath, fileType, fileName) {
      try {
        wx.showLoading({ title: '上传文件中...' });

        const fileStats = await wx.getFileInfo({ filePath });
        
        // 检查文件类型
        const allowedTypes = ['txt', 'doc', 'docx', 'pdf'];
        if (!allowedTypes.includes(fileType.toLowerCase())) {
          throw new Error('不支持的文件类型，请上传txt、doc、docx或pdf文件');
        }

        // 检查文件大小
        if (fileStats.size > 10 * 1024 * 1024) { // 10MB限制
          throw new Error('文件大小不能超过10MB');
        }

        // 检查API密钥
        if (!this.data.apiKey) {
          throw new Error('未配置API密钥，请先在设置中配置');
        }

        const uploadRes = await wx.uploadFile({
          url: `${this.data.baseUrl}/files`,
          filePath: filePath,
          name: 'file',
          formData: {
            purpose: 'file-extract',
            filename: fileName
          },
          header: {
            'Authorization': `Bearer ${this.data.apiKey}`,
            'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
            'Accept': 'application/json'
          }
        });

        let responseData;
        try {
          responseData = JSON.parse(uploadRes.data);
          if (uploadRes.statusCode === 401) {
            throw new Error('API密钥无效或已过期');
          } else if (uploadRes.statusCode === 413) {
            throw new Error('文件大小超过服务器限制');
          } else if (uploadRes.statusCode !== 200) {
            throw new Error(responseData.error?.message || '文件上传失败');
          }
        } catch (e) {
          console.error('解析响应数据失败:', e, uploadRes);
          throw new Error('服务器响应格式错误');
        }

        if (!responseData.id) {
          throw new Error('文件上传失败：未获取到文件ID');
        }

        // 获取文件内容
        const contentRes = await new Promise((resolve, reject) => {
          wx.request({
            url: `${this.data.baseUrl}/files/${responseData.id}/content`,
            method: 'GET',
            header: {
              'Authorization': `Bearer ${this.data.apiKey}`,
              'Accept': 'application/json'
            },
            success: (res) => {
              if (res.statusCode === 200 && res.data) {
                // 兼容不同的响应格式
                const text = res.data.text || res.data.content;
                if (text) {
                  resolve({ data: { text } });
                } else if (res.data.error) {
                  reject(new Error('获取文件内容失败：' + res.data.error.message));
                } else {
                  reject(new Error('获取文件内容失败：响应数据格式不正确'));
                }
              } else if (res.statusCode === 401) {
                reject(new Error('API密钥无效或已过期'));
              } else if (res.statusCode === 404) {
                reject(new Error('文件不存在或已被删除'));
              } else {
                reject(new Error('获取文件内容失败：' + (res.data?.error?.message || '未知错误')));
              }
            },
            fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
          });
        });

        if (!contentRes.data?.text) {
          throw new Error('获取文件内容失败：未获取到文本内容');
        }

        this.setData({
          fileInfo: {
            id: responseData.id,
            name: fileName,
            type: fileType,
            content: contentRes.data.text
          },
          previewContent: contentRes.data.text.substring(0, 1000) + '...'
        });

        wx.hideLoading();
      } catch (error) {
        wx.hideLoading();
        console.error('上传文件失败:', error);
        wx.showToast({
          title: error.message || '上传文件失败',
          icon: 'none',
          duration: 3000
        });
        throw error; // 向上层抛出错误，便于调用方处理
      }
    },

    // 发送问题
    async sendQuestion() {
      if (!this.data.fileInfo || !this.data.userInput.trim()) {
        wx.showToast({
          title: '请选择文件并输入问题',
          icon: 'none'
        });
        return;
      }

      try {
        this.setData({ isLoading: true });

        const messages = [
          {
            role: 'system',
            content: '你是 Kimi，由 Moonshot AI 提供的人工智能助手。'
          },
          {
            role: 'system',
            content: this.data.fileInfo.content
          },
          {
            role: 'user',
            content: this.data.userInput
          }
        ];

        const response = await wx.request({
          url: `${this.data.baseUrl}/chat/completions`,
          method: 'POST',
          data: {
            model: 'moonshot-v1-32k',
            messages: messages,
            temperature: 0.3
          },
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.data.apiKey}`
          }
        });

        if (!response.data || !response.data.choices || !response.data.choices[0]) {
          throw new Error('API返回数据格式错误');
        }

        // 触发回调事件
        this.triggerEvent('onResponse', {
          question: this.data.userInput,
          answer: response.data.choices[0].message.content,
          fileInfo: this.data.fileInfo
        });

        // 清空输入
        this.setData({
          userInput: '',
          isLoading: false
        });

      } catch (error) {
        console.error('发送问题失败:', error);
        this.setData({ isLoading: false });
        wx.showToast({
          title: error.message || '发送失败',
          icon: 'none'
        });
      }
    },

    // 输入框内容变化
    onInput(e) {
      this.setData({
        userInput: e.detail.value
      });
    },

    // 关闭组件
    close() {
      this.setData({
        visible: false,
        fileInfo: null,
        userInput: '',
        previewContent: ''
      });
    }
  }
})}