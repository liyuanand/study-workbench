# 学习工作台

面向高中生的手机端 PWA，用于背诵、错题复习、间隔记忆和家长奖励协作。

## 本地运行

```bash
npm install
npm run dev
```

## 数据边界

学习资料、错题照片、复习记录、积分和家长密码都保存在当前浏览器的 IndexedDB 中，不会提交到 GitHub。清除站点数据或更换设备会失去本地资料，请定期在“我的”中导出完整备份。

家长密码用于区分学生和家长操作入口，不是云端账号系统，无法抵御通过浏览器开发工具进行的技术性修改。

## 验证

```bash
npm test
npm run build
npm run test:e2e
```

`main` 分支推送后，GitHub Actions 会构建并发布到 GitHub Pages。
