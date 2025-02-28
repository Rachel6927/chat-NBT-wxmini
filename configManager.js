// 导入所有配置项
import { dbConfig, wxConfig, cloudConfig, uploadConfig, kimiConfig, env } from './config.js';

class ConfigManager {
  static #instance = null;

  static getInstance() {
    if (!this.#instance) {
      this.#instance = new ConfigManager();
    }
    return this.#instance;
  }

  get(key) {
    switch(key) {
      case 'db': return dbConfig.collections.chatRecords;
      case 'wx': return wxConfig;
      case 'cloud': return cloudConfig;
      case 'upload': return uploadConfig;
      case 'kimi': return kimiConfig;
      case 'env': return env;
      default: return null;
    }
  }

  getKimiConfig() {
    return this.get('kimi');
  }

  getUploadConfig() {
    return this.get('upload');
  }

  getCloudConfig() {
    return this.get('cloud');
  }

  getWxConfig() {
    return this.get('wx');
  }

  getDbConfig() {
    return this.get('db');
  }

  getEnvConfig() {
    return this.get('env');
  }
}

// 使用 ES Module 导出
export default ConfigManager.getInstance();