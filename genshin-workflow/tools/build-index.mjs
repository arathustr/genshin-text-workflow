import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const workflowRoot = path.resolve(__dirname, '..');
const dataDir = process.env.GENSHIN_DATA_DIR || path.join(workspaceRoot, 'genshin-game-data');
const textMapDir = path.join(dataDir, 'TextMap');
const excelDir = path.join(dataDir, 'ExcelBinOutput');
const indexDir = path.join(workflowRoot, 'index');
const sourceIndexPath = path.join(indexDir, 'source-index.json');
const manifestPath = path.join(indexDir, 'manifest.json');

const PRIMARY_TEXTMAP = 'TextMap_MediumCHS.json';
const FALLBACK_TEXTMAP = 'TextMapCHS.json';
const MAX_REFS_PER_HASH = 30;

function git(args, fallback = '') {
  try {
    return execFileSync('git', ['-C', dataDir, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim();
}

function shorten(value, max = 80) {
  const text = cleanText(value).replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function isTextHashKey(key) {
  return /textmaphash$/i.test(key);
}

function asHash(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return '';
}

function idSummary(row) {
  if (!row || typeof row !== 'object') return '';
  const keys = [
    'id',
    'subId',
    'mainId',
    'questId',
    'chapterId',
    'materialId',
    'avatarId',
    'weaponId',
    'itemId',
    'configId',
    'GFLDJMJKIKE',
  ];
  return keys
    .filter((key) => row[key] !== undefined && row[key] !== null && row[key] !== '' && row[key] !== 0)
    .map((key) => `${key}=${row[key]}`)
    .join(', ');
}

function firstExistingHash(row, keys) {
  for (const key of keys) {
    const hash = asHash(row?.[key]);
    if (hash) return hash;
  }
  return '';
}

function fieldMeaning(fieldPath) {
  const field = fieldPath.split('.').at(-1) || fieldPath;
  const normalized = field.toLowerCase();
  if (normalized.includes('talkcontent')) return '台词正文';
  if (normalized.includes('talkrolename')) return '说话人名称';
  if (normalized.includes('talktitle')) return '对话标题';
  if (normalized.includes('title')) return '标题';
  if (normalized.includes('name')) return '名称';
  if (normalized.includes('desc')) return '描述';
  if (normalized.includes('content')) return '正文';
  if (normalized.includes('story')) return '故事';
  if (normalized.includes('tips') || normalized.includes('tip')) return '提示';
  return field;
}

function classify(fileName) {
  if (fileName === 'DialogExcelConfigData.json') return '剧情/任务对话';
  if (fileName.startsWith('TalkExcelConfigData')) return '对话入口';
  if (fileName === 'MainQuestExcelConfigData.json') return '任务';
  if (fileName === 'QuestExcelConfigData.json') return '任务步骤';
  if (/Avatar|Fetter|Costume/.test(fileName)) return '角色资料/语音';
  if (/Material|Book|Readable|Codex/.test(fileName)) return '道具/书籍/图鉴';
  if (/Weapon/.test(fileName)) return '武器';
  if (/Reliquary/.test(fileName)) return '圣遗物';
  if (/Achievement/.test(fileName)) return '成就';
  if (/Loading|Tutorial|Guide|Manual/.test(fileName)) return '教程/提示';
  if (/Activity|Watcher|BattlePass|GCG|MusicGame/.test(fileName)) return '活动/玩法';
  return '游戏文本';
}

function dialogIdOf(row) {
  if (!row || typeof row !== 'object') return '';
  if (row.id) return row.id;
  if (row.dialogId) return row.dialogId;
  if (row.dialogID) return row.dialogID;
  if (row.GFLDJMJKIKE) return row.GFLDJMJKIKE;
  return '';
}

function pushUnique(map, key, value) {
  const list = map.get(key) || [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

async function readJsonIfExists(fileName, defaultValue = []) {
  try {
    return await loadJson(path.join(excelDir, fileName));
  } catch {
    return defaultValue;
  }
}

function collectDialogIds(dialogMap, initDialog) {
  const start = String(initDialog || '');
  if (!start || start === '0') return [];
  const result = [];
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0 && result.length < 400) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    const row = dialogMap.get(id);
    for (const next of row?.nextDialogs || []) stack.push(String(next));
  }
  return result;
}

function traverseTextHashes(value, pathParts, row, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => traverseTextHashes(item, [...pathParts, String(index)], row, visit));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      traverseTextHashes(child, [...pathParts, key], row, visit);
    }
    return;
  }
  const key = pathParts.at(-1) || '';
  if (!isTextHashKey(key)) return;
  const hash = asHash(value);
  if (hash) visit(hash, pathParts.join('.'));
}

function addRef(refsByHash, hash, ref) {
  const refs = refsByHash.get(hash) || [];
  const signature = `${ref.source}|${ref.file}|${ref.field}|${ref.ids}`;
  if (refs.some((item) => `${item.source}|${item.file}|${item.field}|${item.ids}` === signature)) return;
  if (refs.length < MAX_REFS_PER_HASH) refs.push(ref);
  refsByHash.set(hash, refs);
}

async function main() {
  await mkdir(indexDir, { recursive: true });

  const fallback = await loadJson(path.join(textMapDir, FALLBACK_TEXTMAP));
  const primary = await loadJson(path.join(textMapDir, PRIMARY_TEXTMAP));
  const textMap = new Map();
  for (const [hash, text] of Object.entries(fallback)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }
  for (const [hash, text] of Object.entries(primary)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }

  const mainQuestRows = await readJsonIfExists('MainQuestExcelConfigData.json');
  const questRows = await readJsonIfExists('QuestExcelConfigData.json');
  const materialRows = await readJsonIfExists('MaterialExcelConfigData.json');
  const avatarRows = await readJsonIfExists('AvatarExcelConfigData.json');
  const weaponRows = await readJsonIfExists('WeaponExcelConfigData.json');
  const reliquarySetRows = await readJsonIfExists('ReliquarySetExcelConfigData.json');
  const npcRows = await readJsonIfExists('NpcExcelConfigData.json');
  const dialogRows = await readJsonIfExists('DialogExcelConfigData.json');
  const talkRows = [
    ...(await readJsonIfExists('TalkExcelConfigData_0.json')),
    ...(await readJsonIfExists('TalkExcelConfigData_1.json')),
  ];

  const mainQuestById = new Map();
  for (const row of mainQuestRows) {
    const title = textMap.get(firstExistingHash(row, ['titleTextMapHash'])) || '';
    mainQuestById.set(String(row.id), { ...row, title });
  }

  const materialNameById = new Map();
  for (const row of materialRows) {
    const name = textMap.get(firstExistingHash(row, ['nameTextMapHash'])) || '';
    if (row.id !== undefined) materialNameById.set(String(row.id), name);
    if (row.materialId !== undefined) materialNameById.set(String(row.materialId), name);
  }

  const avatarNameById = new Map();
  for (const row of avatarRows) {
    const name = textMap.get(firstExistingHash(row, ['nameTextMapHash'])) || '';
    if (row.id !== undefined) avatarNameById.set(String(row.id), name);
    if (row.avatarId !== undefined) avatarNameById.set(String(row.avatarId), name);
  }

  const weaponNameById = new Map();
  for (const row of weaponRows) {
    const name = textMap.get(firstExistingHash(row, ['nameTextMapHash'])) || '';
    if (row.id !== undefined) weaponNameById.set(String(row.id), name);
    if (row.weaponId !== undefined) weaponNameById.set(String(row.weaponId), name);
  }

  const reliquarySetNameById = new Map();
  for (const row of reliquarySetRows) {
    const name = textMap.get(firstExistingHash(row, ['setNameTextMapHash', 'nameTextMapHash'])) || '';
    if (row.setId !== undefined) reliquarySetNameById.set(String(row.setId), name);
    if (row.id !== undefined) reliquarySetNameById.set(String(row.id), name);
  }

  const npcNameById = new Map();
  for (const row of npcRows) {
    const name = textMap.get(firstExistingHash(row, ['nameTextMapHash'])) || '';
    if (row.id !== undefined && name) npcNameById.set(String(row.id), name);
  }

  const dialogById = new Map();
  for (const row of dialogRows) {
    const id = dialogIdOf(row);
    if (id) dialogById.set(String(id), row);
  }

  const talkById = new Map();
  const dialogToTalkIds = new Map();
  for (const row of talkRows) {
    if (row.id !== undefined) talkById.set(String(row.id), row);
    for (const dialogId of collectDialogIds(dialogById, row.initDialog)) {
      pushUnique(dialogToTalkIds, dialogId, String(row.id));
    }
  }

  function rowTitle(fileName, row) {
    const direct = textMap.get(firstExistingHash(row, [
      'titleTextMapHash',
      'nameTextMapHash',
      'setNameTextMapHash',
      'talkTitleTextMapHash',
      'talkRoleNameTextMapHash',
    ]));
    if (direct) return direct;
    if (row.mainId !== undefined) return mainQuestById.get(String(row.mainId))?.title || '';
    if (row.materialId !== undefined) return materialNameById.get(String(row.materialId)) || '';
    if (row.avatarId !== undefined) return avatarNameById.get(String(row.avatarId)) || '';
    if (row.weaponId !== undefined) return weaponNameById.get(String(row.weaponId)) || '';
    if (row.setId !== undefined) return reliquarySetNameById.get(String(row.setId)) || '';
    if (fileName.includes('Material') && row.id !== undefined) return materialNameById.get(String(row.id)) || '';
    if (fileName.includes('Avatar') && row.id !== undefined) return avatarNameById.get(String(row.id)) || '';
    if (fileName.includes('Weapon') && row.id !== undefined) return weaponNameById.get(String(row.id)) || '';
    return '';
  }

  function sourceLabel(fileName, row, fieldPath, hash) {
    const field = fieldMeaning(fieldPath);
    const ids = idSummary(row);
    const title = rowTitle(fileName, row);

    if (fileName === 'DialogExcelConfigData.json') {
      const dialogId = String(dialogIdOf(row) || '');
      const speaker =
        textMap.get(firstExistingHash(row, ['talkRoleNameTextMapHash', 'talkTitleTextMapHash'])) ||
        npcNameById.get(String(row.talkRole?.id || '')) ||
        '';
      const talkIds = dialogToTalkIds.get(dialogId) || [];
      const talkDetails = talkIds.slice(0, 4).map((talkId) => {
        const talk = talkById.get(talkId);
        const questId = talk?.questId ? String(talk.questId) : '';
        const questTitle = questId ? mainQuestById.get(questId)?.title || '' : '';
        return questTitle ? `Talk ${talkId}/任务《${questTitle}》` : `Talk ${talkId}`;
      });
      const talkText = talkDetails.length ? `；关联 ${talkDetails.join('、')}` : '';
      return `剧情/任务对话${speaker ? `：「${shorten(speaker, 32)}」` : ''}（Dialog ID ${dialogId}${talkText}；${field}）`;
    }

    if (fileName === 'MainQuestExcelConfigData.json') {
      return `任务${title ? `《${shorten(title, 48)}》` : ''}（MainQuest ID ${row.id ?? '?'}；${field}）`;
    }

    if (fileName === 'QuestExcelConfigData.json') {
      const mainTitle = row.mainId !== undefined ? mainQuestById.get(String(row.mainId))?.title || '' : '';
      return `任务步骤${mainTitle ? `《${shorten(mainTitle, 48)}》` : ''}（SubQuest ID ${row.subId ?? '?'}；MainQuest ID ${row.mainId ?? '?'}；${field}）`;
    }

    if (fileName === 'MaterialExcelConfigData.json') {
      return `道具/书籍/材料${title ? `「${shorten(title, 48)}」` : ''}（Material ID ${row.id ?? '?'}；${field}）`;
    }

    if (fileName === 'WeaponExcelConfigData.json') {
      return `武器${title ? `「${shorten(title, 48)}」` : ''}（Weapon ID ${row.id ?? row.weaponId ?? '?'}；${field}）`;
    }

    if (fileName === 'ReliquarySetExcelConfigData.json' || fileName === 'ReliquaryExcelConfigData.json') {
      const setName = row.setId !== undefined ? reliquarySetNameById.get(String(row.setId)) || title : title;
      return `圣遗物${setName ? `「${shorten(setName, 48)}」` : ''}（${fileName}${ids ? `；${ids}` : ''}；${field}）`;
    }

    if (/Avatar|Fetter|Costume/.test(fileName)) {
      return `角色资料/语音${title ? `「${shorten(title, 48)}」` : ''}（${fileName}${ids ? `；${ids}` : ''}；${field}）`;
    }

    return `${classify(fileName)}${title ? `「${shorten(title, 48)}」` : ''}（${fileName}${ids ? `；${ids}` : ''}；${field}）`;
  }

  const refsByHash = new Map();
  const files = (await readdir(excelDir)).filter((name) => name.endsWith('.json')).sort();

  let parsedFiles = 0;
  let scannedRows = 0;
  for (const fileName of files) {
    const filePath = path.join(excelDir, fileName);
    const raw = await readFile(filePath, 'utf8');
    if (!raw.includes('TextMapHash')) continue;
    const data = JSON.parse(raw);
    const rows = Array.isArray(data) ? data : [data];
    parsedFiles += 1;
    scannedRows += rows.length;
    for (const row of rows) {
      traverseTextHashes(row, [], row, (hash, fieldPath) => {
        const text = textMap.get(hash);
        if (!text) return;
        addRef(refsByHash, hash, {
          source: sourceLabel(fileName, row, fieldPath, hash),
          category: classify(fileName),
          file: fileName,
          field: fieldPath,
          ids: idSummary(row),
        });
      });
    }
  }

  const sourceIndex = {
    schema: 1,
    builtAt: new Date().toISOString(),
    textMaps: [PRIMARY_TEXTMAP, FALLBACK_TEXTMAP],
    maxRefsPerHash: MAX_REFS_PER_HASH,
    refs: Object.fromEntries([...refsByHash.entries()].sort(([a], [b]) => Number(a) - Number(b))),
  };

  const manifest = {
    schema: 1,
    builtAt: sourceIndex.builtAt,
    upstream: {
      name: 'Dimbreath/AnimeGameData',
      url: git(['remote', 'get-url', 'origin'], 'https://gitlab.com/Dimbreath/AnimeGameData.git'),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], 'master'),
      commit: git(['rev-parse', 'HEAD']),
      commitDate: git(['log', '-1', '--pretty=%ci']),
      commitSubject: git(['log', '-1', '--pretty=%s']),
    },
    localPaths: {
      dataDir,
      textMapDir,
      excelDir,
      sourceIndexPath,
    },
    text: {
      primary: PRIMARY_TEXTMAP,
      fallback: FALLBACK_TEXTMAP,
      entries: textMap.size,
    },
    sourceScan: {
      parsedFiles,
      scannedRows,
      hashesWithSources: refsByHash.size,
      totalSourceRefs: [...refsByHash.values()].reduce((sum, refs) => sum + refs.length, 0),
    },
  };

  await writeFile(sourceIndexPath, JSON.stringify(sourceIndex, null, 2), 'utf8');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Built ${sourceIndexPath}`);
  console.log(`Text entries: ${textMap.size}`);
  console.log(`Hashes with sources: ${manifest.sourceScan.hashesWithSources}`);
  console.log(`Upstream: ${manifest.upstream.commitSubject}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
