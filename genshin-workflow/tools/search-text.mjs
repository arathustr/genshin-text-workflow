import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const workflowRoot = path.resolve(__dirname, '..');
const dataDir = process.env.GENSHIN_DATA_DIR || path.join(workspaceRoot, 'genshin-game-data');
const textMapDir = path.join(dataDir, 'TextMap');
const excelDir = path.join(dataDir, 'ExcelBinOutput');
const readableDir = path.join(dataDir, 'Readable', 'CHS');
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

async function readTextIfExists(filePath) {
  try {
    const bytes = await readFile(filePath);
    const utf8 = new TextDecoder('utf-8').decode(bytes);
    if (!looksMojibake(utf8)) return utf8;
    return new TextDecoder('gb18030').decode(bytes);
  } catch {
    return '';
  }
}

function looksMojibake(text) {
  const sample = text.slice(0, 2000);
  if (sample.includes('\uFFFD')) return true;
  const latinNoise = sample.match(/[ÃÂãäåæçèéêìíîïòóôöùúûü]/g)?.length || 0;
  const hanCount = sample.match(/[\u4e00-\u9fff]/g)?.length || 0;
  return latinNoise >= 6 && hanCount < latinNoise * 2;
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

function readableStem(localizationRow) {
  const candidates = [
    localizationRow?.LJMEGPECFEN,
    localizationRow?.DALLNFNILMI,
    localizationRow?.chsPath,
    localizationRow?.cnPath,
  ].filter(Boolean);
  for (const value of candidates) {
    const match = String(value).match(/Readable\/CHS\/([^/\\]+)$/i);
    if (match) return match[1];
  }
  return '';
}

function titleFromReadableText(text, fallback) {
  const explicitTitle = compact(fallback || '', 80);
  if (explicitTitle && !/^Book\d+$/i.test(explicitTitle)) return explicitTitle;
  const firstLine = cleanText(text)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine?.match(/^[-—]+(.+?)[-—]+$/)?.[1]?.trim() || explicitTitle || '';
}

function splitReadableText(text) {
  const cleaned = cleanText(text).replace(/^#+/, '').trim();
  const sentences = cleaned.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [cleaned];
  const chunks = [];
  for (const sentence of sentences) {
    const item = compact(sentence, 260);
    if ((item.match(/[\u4e00-\u9fff]/g)?.length || 0) >= 4) chunks.push(item);
  }
  return chunks;
}

async function loadReadableEntries(textMap) {
  const localizationRows = await loadJson(path.join(excelDir, 'LocalizationExcelConfigData.json'), []);
  const documentRows = await loadJson(path.join(excelDir, 'DocumentExcelConfigData.json'), []);
  const materialRows = await loadJson(path.join(excelDir, 'MaterialExcelConfigData.json'), []);
  const metaByLocalizationId = new Map();
  const materialNameById = new Map();

  for (const row of materialRows) {
    const name = textMap.get(String(row.nameTextMapHash || '')) || '';
    if (name && row.id !== undefined) materialNameById.set(String(row.id), name);
  }

  for (const row of documentRows) {
    const title = textMap.get(String(row.titleTextMapHash || '')) || materialNameById.get(String(row.id)) || '';
    const ids = [
      ...(Array.isArray(row.questIDList) ? row.questIDList : []),
      ...(Array.isArray(row.contentLocalizedId) ? row.contentLocalizedId : []),
      ...(Array.isArray(row.questContentLocalizedId) ? row.questContentLocalizedId : []),
    ];
    for (const id of ids) {
      if (!id) continue;
      metaByLocalizationId.set(String(id), { documentId: row.id, title });
    }
  }

  const files = new Set(await readdir(readableDir).catch(() => []));
  const entries = [];
  for (const row of localizationRows) {
    const stem = readableStem(row);
    if (!stem) continue;
    const file = `${stem}.txt`;
    if (!files.has(file)) continue;
    const text = cleanText(await readTextIfExists(path.join(readableDir, file)));
    if (!text) continue;
    const meta = metaByLocalizationId.get(String(row.id)) || {};
    const title = titleFromReadableText(text, meta.title || stem);
    const ref = {
      category: '书籍/可读物',
      file: `Readable/CHS/${file}`,
      field: 'readableText',
      ids: `localizationId=${row.id}${meta.documentId ? `, documentId=${meta.documentId}` : ''}`,
      source: `书籍「${title}」`,
    };
    for (const [index, chunk] of splitReadableText(text).entries()) {
      entries.push({ hash: `readable:${row.id}:${index}`, text: chunk, refs: [ref] });
    }
  }
  return entries;
}

function semanticHintTerms(query) {
  const normalized = cleanText(query).replace(/\s+/g, '');
  if (/性爱|性欲|性描写|性暗示|性关系|隐晦.*性|情欲|欲望|情色|肉欲|身体|肉体|生理|亲密|生育|繁殖|交配|血脉|混血|半仙|仙兽|麒麟/.test(normalized)) {
    return ['羞耻', '私欲', '沐浴', '衣物', '相亲', '结合', '互相结合', '生儿育女', '月光', '露珠', '浅睡', '血脉', '仙兽', '凡人'];
  }
  return [];
}

function scoreText(text, terms, sourceCount, requireAll = true) {
  const normalized = text.toLowerCase();
  let score = sourceCount > 0 ? 5 : 0;
  let hits = 0;
  const termWeights = new Map([
    ['羞耻', 2],
    ['私欲', 2],
    ['生儿育女', 2],
    ['互相结合', 1.8],
    ['相亲', 1.6],
    ['结合', 1.4],
    ['沐浴', 1.2],
    ['衣物', 1.2],
    ['血脉', 1.5],
    ['浅睡', 1.3],
    ['月光', 0.35],
  ]);
  for (const term of terms) {
    const lower = term.toLowerCase();
    const count = normalized.split(lower).length - 1;
    if (count <= 0) {
      if (requireAll) return -1;
      continue;
    }
    hits += 1;
    score += count * (term.length >= 2 ? 10 : 3) * (termWeights.get(term) || 1);
  }
  if (!requireAll && hits === 0) return -1;
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
  const entries = [];
  for (const [hash, text] of textMap.entries()) {
    if (text.length < args.minLength) continue;
    const refs = sourceIndex.refs?.[hash] || [];
    if (args.sourcedOnly && refs.length === 0) continue;
    entries.push({ hash, text, refs });
  }
  entries.push(...(await loadReadableEntries(textMap)));

  function collectResults(searchTerms, requireAll, bonus = 0) {
    const collected = [];
    for (const entry of entries) {
      if (entry.text.length < args.minLength) continue;
      const refs = entry.refs || [];
      if (args.sourcedOnly && refs.length === 0) continue;
      const searchable = `${entry.text} ${refs.map(humanCitation).join(' ')}`;
      const score = scoreText(searchable, searchTerms, refs.length, requireAll);
      if (score < 0) continue;
      collected.push({ hash: entry.hash, text: entry.text, refs, score: score + bonus });
    }
    return collected;
  }

  let results = collectResults(terms, true);
  const hintTerms = semanticHintTerms(args.query);
  let usedSemanticFallback = false;
  if (results.length === 0 && hintTerms.length) {
    results = collectResults(hintTerms, false, 3);
    usedSemanticFallback = true;
  }

  results.sort((a, b) => b.score - a.score || a.text.length - b.text.length);

  const header = [
    `Query: ${args.query}`,
    `Results: ${Math.min(args.limit, results.length)} / ${results.length}`,
    usedSemanticFallback ? `Semantic fallback: ${hintTerms.join(' ')}` : '',
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
