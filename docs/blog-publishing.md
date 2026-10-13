# 博客内容发布

博客正文来自 `src/content/blog/posts/`，公开目录由 `src/content/blog/manifest.json` 控制。只有状态为 `published` 的文章才会进入浏览器包、博客列表、文章路由、预渲染页面和站点地图。构建命令会自动生成 `src/features/blog/generated-catalog.ts` 与 `generated-manifest.ts`，不要手工编辑这两个文件。

指定的 [gupiaoWS 仓库](https://github.com/danielmoorelumestory/gupiaoWS) 截至 2026-10-13 只有《慢即是快》书稿、专题与修订材料，没有独立博客文章。本站没有把书稿或审稿文件自动当作博客发布。发布第一篇文章时，先明确选定原文、标题、摘要及真正的发布日期，再登记清单。

清单条目示例：

```json
{
  "slug": "my-first-post",
  "title": "文章标题",
  "summary": "用一两句话说明读者能获得什么。",
  "category": "投资",
  "tags": ["方法"],
  "publishedAt": "2026-10-13",
  "updatedAt": "2026-10-15",
  "file": "src/content/blog/posts/my-first-post.md",
  "sourceFile": "blog/my-first-post.md",
  "sourceUrl": "https://github.com/danielmoorelumestory/gupiaoWS/blob/master/blog/my-first-post.md",
  "status": "published"
}
```

`slug` 只用小写英文字母、数字和连字符；`publishedAt` 必须是实际公开日期，不要拿文件修改时间或 Git 提交时间代替。`updatedAt` 只在内容修订时填写。暂不公开的内容可标为 `draft`，但不应把个人敏感材料放入这个公开源码仓库。

如果文章在本地 gupiaoWS checkout 中，在清单中填写 `sourceFile`，然后运行：

```bash
npm run blog:import -- --source /path/to/gupiaoWS
```

导入器只处理清单里已发布且填写了 `sourceFile` 的条目。它会复制 Markdown 和被引用的本地资源，并把已发布文章间的相对 `.md` 链接改成博客路由；未登记的相对 Markdown 链接会报错。若正文直接在本站维护，可省略 `sourceFile`，将文件放到清单指定的 `file` 路径。

运行 `npm run dev` 本地预览，或用 `npm run build` / `npm run build:pages` 检查两种发布目标。构建会验证已发布文章文件存在。删除或撤回文章时，应同步移除以前复制到 `public/blog/assets/<slug>/` 的资源，再重新构建，避免旧资源仍可通过原 URL 访问。
