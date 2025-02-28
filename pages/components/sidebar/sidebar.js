const { cloudConfig, dbConfig } = require("../../../config");

Component({
  properties: {
    isOpen: {
      type: Boolean,
      value: false,
      observer: function(newVal, oldVal) {
        if (newVal && !oldVal) {
          // 当 isOpen 从 false 变为 true 时，调用 loadChatHistory
          this.loadChatHistory();
        }
      }
    }
  },

  data: {
    userInfo: null,
    chatHistory: []
  },

  lifetimes: {
    attached() {
      this.loadUserInfo();
      this.loadChatHistory();
    }
  },

  methods: {
    loadUserInfo() {
      wx.getStorage({
        key: 'userInfo',
        success: (res) => {
          this.setData({ userInfo: res.data });
        }
      });
    },

    getUserProfile() {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          this.setData({ userInfo: res.userInfo });
          wx.setStorage({
            key: 'userInfo',
            data: res.userInfo
          });
        },
        fail: (err) => {
          console.error('获取用户信息失败：', err);
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
        }
      });
    },

    async loadChatHistory() {
      try {
        // 添加配置检查
        if (!dbConfig || !dbConfig.collections || !dbConfig.collections.chatHistory || !dbConfig.collections.chatHistory.name) {
          console.error('数据库配置不完整');
          throw new Error('数据库配置错误');
        }

        const db = wx.cloud.database();
        const result = await db.collection(dbConfig.collections.chatHistory.name)
          .orderBy('updateTime', 'desc')
          .get();

        if (!result || !result.data) {
          throw new Error('获取聊天记录失败');
        }

        const formattedChatHistory = result.data.map(item => ({
          ...item,
          updateTime: item.updateTime ? new Date(item.updateTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未知时间'
        }));

        this.setData({
          chatHistory: formattedChatHistory
        });
      } catch (error) {
        console.error('获取会话列表失败:', error);
        wx.showToast({
          title: '获取历史记录失败',
          icon: 'none',
          duration: 2000
        });
      }
    },

    selectHistory(e) {
      const chatHistoryId = e.currentTarget.dataset.index;
      const page = this.getPageInstance();
      if(page) {
        page.loadChatHistory(chatHistoryId);
      }
      this.toggleSidebar();
    },

    getPageInstance() {
      const pages = getCurrentPages();
      return pages[pages.length - 1];
    },

    deleteHistory(e) {
      const chatHistoryId = e.currentTarget.dataset.index;
      wx.showModal({
        title: '提示',
        content: '确定要删除此记录吗？',
        success: (res) => {
          if (res.confirm) {
            const db = wx.cloud.database();
            db.collection(dbConfig.collections.chatHistory.name).doc(chatHistoryId).remove({
              success: res => {
                wx.showToast({
                  title: '删除成功',
                })
                this.loadChatHistory()//删除成功重新加载
              }, fail: err => {
                wx.showToast({
                  title: '删除失败',
                })
              }        
            })
          }
        }
      })
    },

    clearHistory() {
      wx.showModal({
        title: '提示',
        content: '确定要清除所有历史记录吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ chatHistory: [] });
            const db = wx.cloud.database();
            db.collection(cloudConfig.dataBse).where({
              all:null,   
            }).remove();
            this.triggerEvent('clear');
          }
        }
      });
    },

    toggleSidebar() {
      this.triggerEvent('toggle');
    },

    // addChatHistory(title) {
    //   const history = {
    //     title,
    //     time: new Date().toLocaleString()
    //   };
    //   const chatHistory = [history, ...this.data.chatHistory];
    //   this.setData({ chatHistory });
    //   wx.setStorage({
    //     key: 'chatHistory',
    //     data: chatHistory
    //   });
    // }
  }
});