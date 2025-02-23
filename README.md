# Chat NBT

基于微信小程序的智能对话应用，集成了 Moonshot AI 的 Kimi 大语言模型，支持文本对话、语音交互和图片分析等功能，高效、可用。

## 功能特点

- 文本对话：支持与 AI 进行自然语言对话
- 语音交互：支持语音输入和语音识别
- 图片分析：支持上传图片并进行智能分析
- 文件处理：支持上传和处理 PDF、DOC、TXT 等多种格式文件
- 云端存储：使用微信云开发能力，支持文件云存储

## 技术栈

- 微信小程序原生开发
- 微信云开发
- Moonshot AI Kimi API

## 开始使用

1. 克隆项目
```bash
git clone [your-repository-url]
```

2. 配置环境变量
- 在项目根目录创建 .env.local 文件
- 添加必要的环境变量：
  ```
  KIMI_API_KEY=your_api_key
  ```

3. 安装依赖
```bash
npm install
```

4. 在微信开发者工具中打开项目

## 项目结构

```
├── cloudfunctions/     # 云函数
├── js/                 # JavaScript 源码
├── pages/             # 小程序页面
├── img/               # 图片资源
├── css/               # 样式文件
└── config.js          # 配置文件
```

## 注意事项

- 使用前请确保已经申请了 Moonshot AI 的 API 密钥
- 需要使用微信开发者工具 2.2.3 或以上版本
- 请妥善保管 API 密钥等敏感信息

## 许可证

MIT License