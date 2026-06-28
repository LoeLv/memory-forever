# Memory Vault

《诸神愚戏》记忆之神的只读藏馆。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库并推送本目录。
2. 打开 `Settings` -> `Pages`。
3. 在 `Build and deployment` 里选择 `Deploy from a branch`。
4. 分支选 `main`，目录选 `/ (root)`。
5. 等待 GitHub Pages 构建完成。

入口文件是 `index.html`。

## 当前状态

- 页面只读浏览，不对公众开放上传。
- 记忆数据从 Supabase 的 `photos` 表读取。
- 图片资源由馆主统一封存与维护。
