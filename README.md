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
- 图片资源通过邀请链接封存，不再开放匿名上传。

## 邀请上传

这个站点支持“邀请链接上传”：

- 普通访问：只能浏览。
- 带 `?invite=...` 的访问：可以上传照片。
- 带 `?owner=1` 的访问：显示邀请管理入口，需要馆主密钥。

Supabase 设置步骤：

1. 在 Supabase SQL Editor 执行 `supabase/sql/invite_upload_setup.sql`。
2. 部署 Edge Function：`memory-vault-invite`。
3. 给函数设置环境变量：
   - `MEMORY_VAULT_OWNER_SECRET`：馆主密钥，自己设一个长一点的口令。
   - `MEMORY_VAULT_BUCKET`：默认是 `memories`，如果你的 bucket 名不同再改。
4. 打开网站地址并加上 `?owner=1`，输入馆主密钥生成邀请链接。
