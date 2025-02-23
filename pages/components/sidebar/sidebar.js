Component({
  properties: {
    isOpen: {
      type: Boolean,
      value: false
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

    loadChatHistory() {
      wx.getStorage({
        key: 'chatHistory',
        success: (res) => {
          this.setData({ chatHistory: res.data || [] });
        },
        fail: () => {
          this.setData({ chatHistory: [] });
        }
      });
    },

    selectHistory(e) {
      const index = e.currentTarget.dataset.index;
      const history = this.data.chatHistory[index];
      this.triggerEvent('select', { history });
      this.toggleSidebar();
    },

    clearHistory() {
      wx.showModal({
        title: '提示',
        content: '确定要清除所有历史记录吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({ chatHistory: [] });
            wx.removeStorage({ key: 'chatHistory' });
            this.triggerEvent('clear');
          }
        }
      });
    },

    toggleSidebar() {
      this.triggerEvent('toggle');
    },

    addChatHistory(title) {
      const history = {
        title,
        time: new Date().toLocaleString()
      };
      const chatHistory = [history, ...this.data.chatHistory];
      this.setData({ chatHistory });
      wx.setStorage({
        key: 'chatHistory',
        data: chatHistory
      });
    }
  }
});