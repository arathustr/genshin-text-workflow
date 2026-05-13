# 原神文本工作流

<p align="center">
  <img alt="原神文本工作流" src="https://capsule-render.vercel.app/api?type=waving&height=180&color=0:5B8DEF,100:63D7B0&text=Genshin%20Text%20Workflow&fontAlign=50&fontAlignY=38&fontColor=ffffff&desc=Quote%20Teyvat.%20Read%20the%20world.&descAlign=50&descAlignY=60" />
</p>

<p align="center">
  <a href="https://github.com/arathustr/genshin-text-workflow"><img alt="GitHub 仓库" src="https://img.shields.io/badge/repo-arathustr%2Fgenshin--text--workflow-24292f?style=for-the-badge&logo=github" /></a>
  <a href="https://github.com/arathustr/genshin-text-workflow/blob/main/LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/arathustr/genshin-text-workflow?style=for-the-badge" /></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="数据源" src="https://img.shields.io/badge/data-Dimbreath%2FAnimeGameData-6f42c1?style=for-the-badge&logo=gitlab" />
  <img alt="原神数据版本" src="https://img.shields.io/badge/Genshin%20data-6.5.0-5B8DEF?style=for-the-badge" />
  <img alt="状态" src="https://img.shields.io/badge/status-experimental-f59e0b?style=for-the-badge" />
</p>

> 用《原神》的中文游戏文本，写有出处、有论证、有现实指向的社会评论；也提供一个无需后端的静态引文检索网页。

这是一个本地写作工作流，不是 Codex skill。它会检索《原神》简中文本，尽量把引文回溯到普通读者能看懂的游戏内出处，并帮助写出由游戏文本推进论证的短评，而不是在现实评论里点缀几句台词。

## 它能做什么

- 检索本地 `TextMap_MediumCHS.json`、`TextMapCHS.json` 与 `Readable/CHS` 中的《原神》简中文本。
- 从 `ExcelBinOutput` 建立出处索引，把文本定位到任务、角色、图鉴、书籍、武器、圣遗物等来源。
- 生成面向读者的出处格式，例如：
  - `——《原神》·赛诺·角色故事`
  - `——《原神》·魔神任务「流转存续的花神诞祭」`
  - `——《原神》·素材图鉴「「自由」的教导」`
- 在最终文章中隐藏内部核验信息，例如 `TextMap hash`、`Dialog ID`、配置表路径。
- 强制把《原神》文本作为论证主轴，而不是装饰性题词。
- 构建 GitHub Pages 可直接托管的静态检索站：手机可用，支持模糊社会议题、主题语义扩展、书籍正文检索、精选引文优先和全量文本模式。
- 提供 `llms.txt` 与 AI 使用说明页，方便豆包、ChatGPT、Kimi、Claude 等外部 AI 学会如何检索和引用。

## 为什么做这个

《原神》是一座很大的公共文本库。它反复书写规则、记忆、自由、契约、知识、牺牲、表演、国家、劳动与审判。这些并不只属于提瓦特设定，也可以成为理解现实制度和公共话语的语言。

这个工作流想做的事，就是把游戏文本变成一个可检索、可引用、可写作的思想现场。

## 快速开始

需要：

- Node.js 18+
- Git
- PowerShell（仅在需要重新压缩网页图片时使用）

克隆仓库：

```bash
git clone https://github.com/arathustr/genshin-text-workflow.git
cd genshin-text-workflow
```

拉取或更新本地游戏数据：

```bash
npm run setup:data
```

建立出处索引：

```bash
npm run index
```

生成静态网页数据：

```bash
npm run build:web
```

如需重新下载并压缩网页视觉素材：

```bash
npm run build:assets
```

本地启动网页：

```bash
npm run serve:web
```

打开：

```text
http://localhost:4173
```

检索文本：

```bash
npm run search -- "虚空 终端 知识" --limit 8 --sourced-only
npm run search -- "契约" --limit 12 --sourced-only
npm run search -- "自由 生存" --limit 8 --sourced-only
```

## 写作方式

可以这样交给写作代理：

```text
用原神工作流评论：
如何评价电子科技大学在教室用摄像头识别学生查出勤
```

文章的理想形态：

```markdown
> 原神原文

——《原神》·可读出处

评论段落，把这条文本打开的问题接到现实材料上。
```

论证应该从一条引文走向下一条引文。每段《原神》文本都要承担真实的分析工作。

## 项目结构

```text
.
├── GENSHIN_WORKFLOW.md
├── genshin-workflow/
│   ├── tools/
│   │   ├── setup-data.mjs
│   │   ├── build-index.mjs
│   │   ├── search-text.mjs
│   │   ├── build-web-assets.ps1
│   │   ├── build-web-data.mjs
│   │   └── serve-web.mjs
│   └── references/
│       ├── themes.md
│       ├── citation-style.md
│       └── anti-patterns.md
├── web/
│   ├── index.html
│   ├── ai-use.html
│   ├── llms.txt
│   └── data/
│       ├── core/
│       └── extra/
├── genshin-outputs/
└── package.json
```

本地上游数据和本地出处索引不会进入仓库：

```text
genshin-game-data/
genshin-workflow/index/
```

`web/data/` 会进入仓库，用于静态网页直接检索。它不是原始 2GB 数据，而是压缩过语义结构的发布数据：默认核心引文库用于手机和写作，全量模式用于查漏。

## 静态网页检索

网页不需要服务器 API。它的检索分三层：

- 精选引文：常用于社会评论的高价值文本优先出现。
- 核心引文库：任务对白、角色故事、角色语音、书籍正文、图鉴和道具说明，长文本会切成可直接引用的短句/短段。
- 全量文本模式：加载其余 TextMap 文本，包括 UI、活动规则、名称和低频文本。

你可以直接输入模糊议题：

```text
高校用摄像头识别学生查出勤
上课强制把手机放进手机袋
权力不承担责任
冷暴力不接电话不回消息
学生被当成数据和编号管理
```

外部 AI 可以读取：

```text
/llms.txt
/ai-use.html
```

这些页面会提醒 AI：先把议题拆成概念词，再搜索；引用时只使用结果里的原文和出处，不要编造台词。

## 引用纪律

最终文章应该这样标注：

```text
——《原神》·赛诺·角色故事
——《原神》·魔神任务「空幻回响的花神诞祭」
——《原神》·加载界面提示「虚空终端」
```

不要在正文里放这些内部信息：

```text
TextMap hash
Dialog ID
Avatar ID
ExcelBinOutput 文件名
配置表字段名
```

这些只用于核验，不给读者看。

## 数据来源

游戏数据由本地脚本从 [Dimbreath/AnimeGameData](https://gitlab.com/Dimbreath/AnimeGameData) 拉取。脚本会使用 `TextMap`、`ExcelBinOutput` 和 `Readable/CHS`，因此书籍/可读物正文也会进入静态检索数据。仓库内的 `web/data/` 是为了静态网页查询生成的发布数据；原始上游数据不内置。

如果你在自己的项目里使用该数据源，请记得给 Dimbreath 的数据维护工作署名。

## 免责声明

这是非官方的同人/研究/写作工具，与 HoYoverse 或 Cognosphere 无关。《原神》及相关文本的权利归其权利方所有。请负责任地引用，并控制引文长度。

## 许可证

MIT。
