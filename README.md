# Genshin Text Workflow

<p align="center">
  <img alt="Genshin Text Workflow" src="https://capsule-render.vercel.app/api?type=waving&height=180&color=0:5B8DEF,100:63D7B0&text=Genshin%20Text%20Workflow&fontAlign=50&fontAlignY=38&fontColor=ffffff&desc=Quote%20Teyvat.%20Read%20the%20world.&descAlign=50&descAlignY=60" />
</p>

<p align="center">
  <a href="https://github.com/arathustr/genshin-text-workflow"><img alt="GitHub repo" src="https://img.shields.io/badge/repo-arathustr%2Fgenshin--text--workflow-24292f?style=for-the-badge&logo=github" /></a>
  <a href="https://github.com/arathustr/genshin-text-workflow/blob/main/LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/arathustr/genshin-text-workflow?style=for-the-badge" /></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="Data source" src="https://img.shields.io/badge/data-Dimbreath%2FAnimeGameData-6f42c1?style=for-the-badge&logo=gitlab" />
  <img alt="Genshin version" src="https://img.shields.io/badge/Genshin%20data-6.5.0-5B8DEF?style=for-the-badge" />
  <img alt="Status" src="https://img.shields.io/badge/status-experimental-f59e0b?style=for-the-badge" />
</p>

> Use Genshin Impact's Chinese game text as a cited literary corpus for essays on social events, public discourse, and everyday institutions.

This project is a local writing workflow, not a Codex skill. It searches Simplified Chinese Genshin text, traces quotes back to readable in-game sources, and helps draft essays where the game text carries the argument rather than acting as decoration.

## What It Does

- Searches local Simplified Chinese Genshin text from `TextMap_MediumCHS.json` and `TextMapCHS.json`.
- Builds a source index from `ExcelBinOutput` so quotes can be cited as readable in-game references.
- Produces reader-friendly citations such as:
  - `——《原神》·赛诺·角色故事`
  - `——《原神》·魔神任务「流转存续的花神诞祭」`
  - `——《原神》·素材图鉴「「自由」的教导」`
- Keeps internal hashes and config-table paths out of final essays.
- Encourages arguments led by Genshin text, not essays with a few ornamental quotes.

## Why

Genshin is a large public text about rule, memory, freedom, contract, knowledge, sacrifice, performance, nation, labor, and judgment. Those themes are not only lore. They are also language for talking about universities, platforms, workplaces, families, bureaucracies, and public controversies.

This workflow turns the game into a searchable citation field for that kind of writing.

## Quick Start

Requirements:

- Node.js 18+
- Git

Clone this repo:

```bash
git clone https://github.com/arathustr/genshin-text-workflow.git
cd genshin-text-workflow
```

Install or refresh the local game data:

```bash
npm run setup:data
```

Build the citation index:

```bash
npm run index
```

Search for text:

```bash
npm run search -- "虚空 终端 知识" --limit 8 --sourced-only
npm run search -- "契约" --limit 12 --sourced-only
npm run search -- "自由 生存" --limit 8 --sourced-only
```

## Writing Workflow

Ask your writing agent:

```text
用原神工作流评论：
如何评价电子科技大学在教室用摄像头识别学生查出勤
```

Expected essay shape:

```markdown
> 原神原文

——《原神》·可读出处

评论段落，把这条文本打开的问题接到现实材料上。
```

The argument should move from quote to quote. Each Genshin passage should do real conceptual work.

## Project Layout

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

Generated or external data is intentionally ignored:

```text
genshin-game-data/
genshin-workflow/index/
```

This keeps the repository light. The game data and source index can be rebuilt locally.

## Citation Discipline

Final essays should cite like this:

```text
——《原神》·赛诺·角色故事
——《原神》·魔神任务「空幻回响的花神诞祭」
——《原神》·加载界面提示「虚空终端」
```

Do not put these internal details in final prose:

```text
TextMap hash
Dialog ID
Avatar ID
ExcelBinOutput file names
Config field names
```

Those details are for verification only.

## Data Credit

Game data is fetched locally from [Dimbreath/AnimeGameData](https://gitlab.com/Dimbreath/AnimeGameData). This repository does not vendor the data dump.

If you use the data source in your own project, credit Dimbreath's work.

## Disclaimer

This is an unofficial fan/research writing tool. It is not affiliated with HoYoverse or Cognosphere. Genshin Impact and related text belong to their respective rights holders. Quote responsibly and keep excerpts short.

## License

MIT.
