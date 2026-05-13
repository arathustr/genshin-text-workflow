# Genshin Text Workflow

这是当前工作区里的《原神》文本评论工作流：用游戏原文作为论证主轴，评论社会事件、公共话语和现实处境。

它不是 Codex skill，也没有安装到 `$CODEX_HOME/skills`。

## 数据源

本地游戏文本数据位于 `genshin-game-data/`，来自 Dimbreath 的 `AnimeGameData` 仓库。

- 上游：`https://gitlab.com/Dimbreath/AnimeGameData`
- 本地版本：见 `genshin-workflow/index/manifest.json`
- 文本：`genshin-game-data/TextMap/TextMap_MediumCHS.json`，并合并 `TextMapCHS.json` 作为补充。
- 出处配置：`genshin-game-data/ExcelBinOutput/`

`TextMap` 只负责“这句话是什么”，`ExcelBinOutput` 负责尽量判断“这句话在哪里出现”。引用正文前必须先通过本地索引核出处。

## 触发方式

```text
用原神工作流评论：
<粘贴社会事件、公共话语、热搜材料、帖子、争吵片段>
```

也可以指定主题：

```text
用原神工作流评论这个公共事件，重点找「契约 / 自由 / 神明 / 磨损」相关文本：
<材料>
```

## 输出

输出是一篇短评论。原神原文是论证主轴，不是装饰性题词。评论必须沿着引文推进，让游戏文本提出问题、限定方向、展开现实处境。

- 直接输出评论正文，不写“下面是”。
- 《原神》原文单独成段，用 Markdown 引用块 `>`。
- 每条《原神》引文后必须紧跟正文出处行，格式为：`——《原神》·赛诺·角色故事`、`——《原神》·魔神任务「流转存续的花神诞祭」·纳西妲`、`——《原神》·素材图鉴「「自由」的教导」`。
- 正文出处必须面向普通读者。不要在正文里写 `ExcelBinOutput`、配置表字段、Avatar ID、Dialog ID、TextMap hash 这类内部定位。
- 内部定位只用于核验，不进入定稿。若一条文本只能定位到配置表/hash，不能作为主引文；宁可换一条出处更清楚的文本。
- 详细出处格式见 `genshin-workflow/references/citation-style.md`。
- 正文不追加数据源说明。数据源、版本和内部定位保留在 `genshin-workflow/index/manifest.json` 与检索记录中，不进入定稿。

定稿保存到 `genshin-outputs/`。文件名从材料概括短标题，如 `彩礼谈判.md`；同一问题覆写同一文件。文件内容只有正文，无工程说明。

## 写作流程

1. 读输入，抓住最关键的现实动作、词语或结构。
2. 在 `genshin-workflow/references/themes.md` 里找候选主题。
3. 用 `genshin-workflow/tools/search-text.mjs` 检索原神文本。
4. 优先选出处清楚、能贴住具体材料的文本；不要先预设名台词。
5. 引文必须短而准。每篇通常使用 4-7 条引文，让引文承担论证骨架。
6. 每条引文后接 1-3 段评论，评论只推进这条引文打开的问题，不抢在引文前完成全部判断。
7. 评论必须对现实材料负责，不能变成游戏设定科普。
8. 用 `genshin-workflow/references/anti-patterns.md` 自检。
9. 定稿保存到 `genshin-outputs/`。

## 常用命令

更新上游数据：

```powershell
git -C genshin-game-data pull
```

重建出处索引：

```powershell
node genshin-workflow/tools/build-index.mjs
```

搜索文本：

```powershell
node genshin-workflow/tools/search-text.mjs "契约" --limit 12
node genshin-workflow/tools/search-text.mjs "自由 代价" --limit 12
```

## 引用纪律

不要编造《原神》原文。引号内、引用块内必须来自本地 TextMap。找不到出处时可以不用引文，用评论语言转述主题，但不能伪装成游戏文本。

如果出处只能定位到 `TextMap hash`，可以作为备选材料，但正式评论中不要作为主引文。正文出处必须像书籍章节或角色/任务出处一样可读。
