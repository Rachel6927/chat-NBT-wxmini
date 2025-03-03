const { cloudConfig } = require("../../../js/config");

Component({
  properties: {
    isOpen: {
      type: Boolean,
      value: false,
      observer: function(newVal, oldVal) {
        if (newVal && !oldVal) {
          const app = getApp();
          const openid = app.globalData.openid;          
          this.getUserInfo();
          // 当 isOpen 从 false 变为 true 时，调用 loadChatHistory
          this.loadChatHistory(openid);
        }
      }
    }
  },

  data: {
    userInfo: null,
    pageSize: 10, // 每页加载的数量
    skipCount: 0, // 当前已跳过的记录数
    hasMore: true, // 是否还有更多数据
    chatHistory: []
  },

  methods: {
    initData(){
      this.setData({
        pageSize: 10, // 每页加载的数量
        skipCount: 0, // 当前已跳过的记录数
        hasMore: true, // 是否还有更多数据
        chatHistory: []
      })
    },

    getUserInfo() {
      wx.getUserInfo({
        desc: '用于完善用户资料',
        success: (res) => {
          this.setData({ userInfo: res.userInfo });
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

    async loadChatHistory(openid) {
      this.initData();
      try {
        const db = wx.cloud.database();
        const result = await db.collection(cloudConfig.dataBase)
          .where({
            _openid:openid
          })
          .field({
            id: true, // 只返回id字段
            title: true, // 只返回title字段
            updateTime: true // 只返回updateTime字段
          })
          .orderBy('updateTime', 'desc')
          .get();

          const formattedChatHistory = result.data.map(item => ({
            ...item,
            updateTime: this.formatTime(new Date(item.updateTime)) // 格式化时间
        }));

        this.setData({
          chatHistory: this.data.chatHistory.concat(formattedChatHistory),
        });
      } catch (error) {
        
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
      }
    },


    formatTime(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
    
      return `${year}/${month}/${day} ${hours}:${minutes}`;
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
            db.collection(cloudConfig.dataBase).doc(chatHistoryId).remove({
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
            db.collection(cloudConfig.dataBase).where({
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

  }
});