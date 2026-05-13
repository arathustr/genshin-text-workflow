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

> 用《原神》的中文游戏文本，写有出处、有论证、有现实指向的社会评论。

这是一个本地写作工作流，不是 Codex skill。它会检索《原神》简中文本，尽量把引文回溯到普通读者能看懂的游戏内出处，并帮助写出由游戏文本推进论证的短评，而不是在现实评论里点缀几句台词。

## 它能做什么

- 检索本地 `TextMap_MediumCHS.json` 与 `TextMapCHS.json` 中的《原神》简中文本。
- 从 `ExcelBinOutput` 建立出处索引，把文本定位到任务、角色、图鉴、书籍、武器、圣遗物等来源。
- 生成面向读者的出处格式，例如：
  - `——《原神》·赛诺·角色故事`
  - `——《原神》·魔神任务「流转存续的花神诞祭」`
  - `——《原神》·素材图鉴「「自由」的教导」`
- 在最终文章中隐藏内部核验信息，例如 `TextMap hash`、`Dialog ID`、配置表路径。
- 强制把《原神》文本作为论证主轴，而不是装饰性题词。

## 为什么做这个

《原神》是一座很大的公共文本库。它反复书写规则、记忆、自由、契约、知识、牺牲、表演、国家、劳动与审判。这些并不只属于提瓦特设定，也可以成为理解现实制度和公共话语的语言。

这个工作流想做的事，就是把游戏文本变成一个可检索、可引用、可写作的思想现场。

## 快速开始

需要：

- Node.js 18+
- Git

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
│   │   └── search-text.mjs
│   └── references/
│       ├── themes.md
│       ├── citation-style.md
│       └── anti-patterns.md
├── genshin-outputs/
└── package.json
```

外部数据和生成文件不会进入仓库：

```text
genshin-game-data/
genshin-workflow/index/
```

这样仓库保持轻量。游戏数据和出处索引都可以在本地重新生成。

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

游戏数据由本地脚本从 [Dimbreath/AnimeGameData](https://gitlab.com/Dimbreath/AnimeGameData) 拉取。本仓库不内置完整数据包。

如果你在自己的项目里使用该数据源，请记得给 Dimbreath 的数据维护工作署名。

## 免责声明

这是非官方的同人/研究/写作工具，与 HoYoverse 或 Cognosphere 无关。《原神》及相关文本的权利归其权利方所有。请负责任地引用，并控制引文长度。

## 许可证

MIT。
