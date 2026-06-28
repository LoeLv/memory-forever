# Memory Vault

一个基于静态 HTML 和 Supabase 的共享相册页面。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `memory-vault`。
2. 把本目录推送到该仓库。
3. 打开仓库的 `Settings` -> `Pages`。
4. 在 `Build and deployment` 里选择 `Deploy from a branch`。
5. 分支选择 `main`，目录选择 `/ (root)`。
6. 保存后等待 GitHub Pages 构建完成。

页面入口是 `index.html`。

## Supabase 注意事项

前端公开使用 Supabase anon/publishable key 是正常模式，但必须在 Supabase 后台配置好 Row Level Security 和 Storage policy：

- `photos` 表允许匿名读取。
- 如需公开上传，允许匿名插入，并限制可写字段。
- `memories` bucket 允许读取公开图片。
- 如需公开上传图片，允许匿名上传到该 bucket。
- 不建议允许匿名删除；发布版页面已移除公开删除按钮。
