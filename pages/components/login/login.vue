<template>
  <view class="login-container">
    <view v-if="userStore['openid'] === ''">
      <view class="header">
        <view class="userinfo">
          <view class="face">
            <image src="https://dev-edoclin-1304812488.cos.ap-chongqing.myqcloud.com/user/logo.png" mode="aspectFill" />
          </view>
          <view class="info">
            <view class="username">未登录，请登录</view>
          </view>
        </view>
      </view>
      <view class="login-button">
        <u-button
          shape="circle"
          text="快捷登录"
          type="success"
          open-type="getPhoneNumber"
          @getphonenumber="login"
          :loading="loginLoading"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const loginLoading = ref(false);

const login = async ({ detail }) => {
  loginLoading.value = true;
  try {
    // 使用微信原生登录API
    const loginRes = await new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
    
    if (!loginRes.code) {
      throw new Error('获取登录凭证失败');
    }
    
    // 调用云函数处理登录
    const cloudRes = await wx.cloud.callFunction({
      name: 'login',
      data: {
        code: loginRes.code,
        phoneNumber: detail.code
      }
    });
    
    if (!cloudRes.result || !cloudRes.result.data) {
      throw new Error('登录失败');
    }
    
    const res = cloudRes.result;
    console.log('登录响应:', res);
    
    if (res.code === 5102 && res.data) {
      // 更新用户状态
      userStore.updateToken(res.data.token);
      userStore.updateOpenid(res.data.openid);
      
      // 处理用户信息
      const userInfo = {
        ...res.data,
        isMale: res.data.parentIsMale,
        realName: res.data.realName || '临时用户'
      };
      userStore.updateUserInfo(userInfo);
      
      uni.showToast({
        title: '登录成功',
        icon: 'success'
      });
    } else {
      throw new Error(res.msg || '登录失败');
    }
  } catch (error) {
    console.error('登录失败:', error);
    uni.showToast({
      title: error.message || '登录失败，请重试',
      icon: 'none'
    });
  } finally {
    loginLoading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.login-container {
  padding: 20px;
  
  .header {
    margin-bottom: 30px;
    
    .userinfo {
      display: flex;
      align-items: center;
      
      .face {
        width: 80px;
        height: 80px;
        margin-right: 20px;
        border-radius: 50%;
        overflow: hidden;
        
        image {
          width: 100%;
          height: 100%;
        }
      }
      
      .info {
        .username {
          font-size: 18px;
          color: #333;
        }
      }
    }
  }
  
  .login-button {
    margin-top: 20px;
  }
}
</style>