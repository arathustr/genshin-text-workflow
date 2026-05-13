import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const workflowRoot = path.resolve(__dirname, '..');
const dataDir = process.env.GENSHIN_DATA_DIR || path.join(workspaceRoot, 'genshin-game-data');
const textMapDir = path.join(dataDir, 'TextMap');
const indexDir = path.join(workflowRoot, 'index');
const sourceIndexPath = path.join(indexDir, 'source-index.json');
const manifestPath = path.join(indexDir, 'manifest.json');

const PRIMARY_TEXTMAP = 'TextMap_MediumCHS.json';
const FALLBACK_TEXTMAP = 'TextMapCHS.json';

function parseArgs(argv) {
  const args = { query: '', limit: 12, sourcedOnly: false, minLength: 2 };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--limit' || item === '-n') {
      args.limit = Number(argv[++i] || args.limit);
    } else if (item === '--sourced-only') {
      args.sourcedOnly = true;
    } else if (item === '--min-length') {
      args.minLength = Number(argv[++i] || args.minLength);
    } else {
      rest.push(item);
    }
  }
  args.query = rest.join(' ').trim();
  return args;
}

async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\{NICKNAME\}/g, '旅行者')
    .replace(/\{NON_BREAK_SPACE\}/g, ' ')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

function compact(value, max = 220) {
  const text = cleanText(value).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function scoreText(text, terms, sourceCount) {
  const normalized = text.toLowerCase();
  let score = sourceCount > 0 ? 5 : 0;
  for (const term of terms) {
    const lower = term.toLowerCase();
    const count = normalized.split(lower).length - 1;
    if (count <= 0) return -1;
    score += count * (term.length >= 2 ? 10 : 3);
  }
  if (text.length >= 12 && text.length <= 180) score += 5;
  if (text.length > 500) score -= 10;
  return score;
}

function humanCitation(ref) {
  const source = ref?.source || '';
  const file = ref?.file || '';
  const quest = source.match(/任务《([^》]+)》/)?.[1];
  const speaker = source.match(/剧情\/任务对话：「([^」]+)」/)?.[1];
  const quotedTitle = source.match(/「(.+)」/)?.[1];

  if (file === 'DialogExcelConfigData.json') {
    if (quest && speaker) return `《原神》·任务「${quest}」·${speaker}`;
    if (quest) return `《原神》·任务「${quest}」·对话`;
    if (speaker) return `《原神》·${speaker}·对话`;
    return '《原神》·任务对话';
  }

  if (/FetterStory/.test(file)) {
    return quotedTitle ? `《原神》·${quotedTitle}·角色故事` : '《原神》·角色故事';
  }

  if (/Fetters/.test(file)) {
    return quotedTitle ? `《原神》·${quotedTitle}·角色语音` : '《原神》·角色语音';
  }

  if (/MaterialCodex/.test(file)) {
    return quotedTitle ? `《原神》·素材图鉴「${quotedTitle}」` : '《原神》·素材图鉴';
  }

  if (/MaterialExcel/.test(file)) {
    return quotedTitle ? `《原神》·道具「${quotedTitle}」` : '《原神》·道具';
  }

  if (/Book|Readable/.test(file)) {
    return quotedTitle ? `《原神》·书籍「${quotedTitle}」` : '《原神》·书籍';
  }

  if (/Weapon/.test(file)) {
    return quotedTitle ? `《原神》·武器「${quotedTitle}」` : '《原神》·武器';
  }

  if (/Reliquary/.test(file)) {
    return quotedTitle ? `《原神》·圣遗物「${quotedTitle}」` : '《原神》·圣遗物';
  }

  if (/LoadingTips/.test(file)) return '《原神》·加载界面提示';
  if (/Reminder/.test(file)) return '《原神》·世界探索提示';
  if (/Achievement/.test(file)) return quotedTitle ? `《原神》·成就「${quotedTitle}」` : '《原神》·成就';

  return quotedTitle ? `《原神》·${quotedTitle}` : `《原神》·${ref?.category || '游戏文本'}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    console.error('Usage: node genshin-workflow/tools/search-text.mjs "关键词" [--limit 12] [--sourced-only]');
    process.exitCode = 2;
    return;
  }

  const fallback = await loadJson(path.join(textMapDir, FALLBACK_TEXTMAP), {});
  const primary = await loadJson(path.join(textMapDir, PRIMARY_TEXTMAP), {});
  const sourceIndex = await loadJson(sourceIndexPath, { refs: {} });
  const manifest = await loadJson(manifestPath, {});

  const textMap = new Map();
  for (const [hash, text] of Object.entries(fallback)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }
  for (const [hash, text] of Object.entries(primary)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }

  const terms = args.query.split(/\s+/).filter(Boolean);
  const results = [];
  for (const [hash, text] of textMap.entries()) {
    if (text.length < args.minLength) continue;
    const refs = sourceIndex.refs?.[hash] || [];
    if (args.sourcedOnly && refs.length === 0) continue;
    const score = scoreText(text, terms, refs.length);
    if (score < 0) continue;
    results.push({ hash, text, refs, score });
  }

  results.sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  const header = [
    `Query: ${args.query}`,
    `Results: ${Math.min(args.limit, results.length)} / ${results.length}`,
    manifest.upstream?.commitSubject ? `Data: ${manifest.upstream.commitSubject}` : '',
  ].filter(Boolean);

  console.log(header.join('\n'));
  console.log('');

  for (const [index, result] of results.slice(0, args.limit).entries()) {
    console.log(`#${index + 1} hash=${result.hash} score=${result.score}`);
    console.log(compact(result.text));
    if (result.refs.length > 0) {
      for (const ref of result.refs.slice(0, 5)) {
        console.log(`正文出处: ${humanCitation(ref)}`);
        console.log(`核验: ${ref.source}`);
        console.log(`内部定位: ${ref.file} :: ${ref.field}${ref.ids ? ` :: ${ref.ids}` : ''}`);
      }
    } else {
      console.log('正文出处: 不建议作为主引文');
      console.log(`内部定位: 未在已解析配置表中定位；TextMap hash=${result.hash}`);
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
