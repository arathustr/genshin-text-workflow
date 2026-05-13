# Genshin Workflow

主说明见根目录 `GENSHIN_WORKFLOW.md`。

这个目录只放工作流说明、索引脚本和本地索引，不直接存放完整游戏文本。完整文本来自根目录的 `genshin-game-data/`。

## Tools

```powershell
node genshin-workflow/tools/setup-data.mjs
node genshin-workflow/tools/build-index.mjs
node genshin-workflow/tools/search-text.mjs "关键词" --limit 12 --sourced-only
node genshin-workflow/tools/build-web-data.mjs
node genshin-workflow/tools/serve-web.mjs
```

`build-index.mjs` 会读取：

- `genshin-game-data/TextMap/TextMap_MediumCHS.json`
- `genshin-game-data/TextMap/TextMapCHS.json`
- `genshin-game-data/ExcelBinOutput/*.json`

并生成：

- `genshin-workflow/index/manifest.json`
- `genshin-workflow/index/source-index.json`

`build-web-data.mjs` 会读取本地索引，并生成静态网页数据：

- `web/data/manifest.json`
- `web/data/topics.json`
- `web/data/core/*.json`
- `web/data/extra/*.json`
