import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const workflowRoot = path.resolve(__dirname, '..');
const dataDir = process.env.GENSHIN_DATA_DIR || path.join(workspaceRoot, 'genshin-game-data');
const textMapDir = path.join(dataDir, 'TextMap');
const indexDir = path.join(workflowRoot, 'index');
const webRoot = path.join(workspaceRoot, 'web');
const webDataDir = path.join(webRoot, 'data');
const sourceIndexPath = path.join(indexDir, 'source-index.json');
const workflowManifestPath = path.join(indexDir, 'manifest.json');

const PRIMARY_TEXTMAP = 'TextMap_MediumCHS.json';
const FALLBACK_TEXTMAP = 'TextMapCHS.json';
const CORE_SHARD_SIZE = 6500;
const EXTRA_SHARD_SIZE = 9000;
const MAX_TEXT_LENGTH = 1200;
const MAX_QUOTE_LENGTH = 260;

const TOPICS = [
  {
    id: 'freedom_order',
    name: '自由与秩序',
    description: '自由、约束、秩序、散漫、枷锁、反抗与边界。',
    queryTerms: ['自由', '秩序', '束缚', '枷锁', '压迫', '规矩', '约束', '散漫', '反抗', '服从', '顺从', '管束', '强制', '不得不', '一刀切', '收缴', '自由之敌'],
    recordTerms: ['自由', '秩序', '束缚', '枷锁', '压迫', '规矩', '约束', '散漫', '混沌', '彷徨', '反抗', '服从', '管束', '韧劲'],
    prompts: ['学生被过度管理', '自由和纪律的边界', '为了秩序牺牲自由'],
  },
  {
    id: 'power_responsibility',
    name: '权力与责任',
    description: '权力、责任、代价、契约、承担与失职。',
    queryTerms: ['权力', '责任', '代价', '契约', '承担', '负责', '失职', '职位', '管理者', '校方', '老师', '教授', '领导', '滥权', '权力失范'],
    recordTerms: ['权力', '责任', '代价', '契约', '承担', '负责', '法度', '帝君', '神之眼', '义务'],
    prompts: ['权力不承担责任', '教师权力失范', '管理者只要求别人配合'],
  },
  {
    id: 'education_discipline',
    name: '求知与风纪',
    description: '教育、知识、学者、学生、课堂、教令、风纪与规训。',
    queryTerms: ['教育', '学校', '高校', '大学', '学生', '课堂', '上课', '出勤', '手机袋', '手机', '老师', '导师', '教授', '作业', '论文', '考试', '学习', '知识', '求知', '风纪', '教令', '规训'],
    recordTerms: ['知识', '智慧', '求知', '教令', '风纪', '教令院', '导师', '老师', '课堂', '规训', '论文', '学术'],
    prompts: ['高校课堂管理', '用制度规训学生', '教育变成出勤统计'],
  },
  {
    id: 'surveillance_technology',
    name: '监控与技术治理',
    description: '摄像头、识别、数据、记录、系统、装置与技术化治理。',
    queryTerms: ['监控', '摄像头', '识别', '算法', '大模型', 'AI', '平台', '推荐', '数据', '隐私', '系统', '记录', '打卡', '签到', '定位', '技术治理', '编号', '自动化', '终端', '虚空', '权力', '责任', '风纪', '教令'],
    recordTerms: ['监控', '观察', '注视', '记录', '数据', '系统', '编号', '终端', '虚空', '识别', '探测', '侦察', '自动', '分配', '限制'],
    prompts: ['摄像头识别学生出勤', '把人变成数据点', '技术监控校园'],
  },
  {
    id: 'trust_personhood',
    name: '信任与人格',
    description: '信任、伙伴、棋子、工具、敌人、尊重与人格化对待。',
    queryTerms: ['信任', '伙伴', '棋子', '工具', '敌人', '人', '人格', '尊重', '利用', '操控', '控制欲', 'PUA', '情绪勒索', '编号', '对象化', '成年人', '不可信'],
    recordTerms: ['信任', '伙伴', '棋子', '工具', '敌人', '利用', '操纵', '人偶', '尊重', '盟友', '朋友', '家人', '编号'],
    prompts: ['学生被当成棋子', '人被当成工具管理', '缺乏信任的制度'],
  },
  {
    id: 'silence_relationship',
    name: '沉默与关系',
    description: '冷暴力、沉默、疏离、等待、背叛、信任破裂与亲密关系。',
    queryTerms: ['冷暴力', '沉默', '不回消息', '不接电话', '疏离', '等待', '背叛', '欺骗', '关系', '恋爱', '分手', '出轨', '婚恋', '彩礼', '信任破裂', '伤心'],
    recordTerms: ['沉默', '等待', '离开', '背叛', '欺骗', '疏远', '孤独', '信任', '约定', '回应', '思念', '痛苦', '伤心', '恋人'],
    prompts: ['冷暴力不回消息', '亲密关系里的沉默惩罚', '信任被消耗'],
  },
  {
    id: 'body_desire_origin',
    name: '身体、欲望与血脉',
    description: '身体感受、欲望、亲密、生育、父母、出身、血脉、混血与身份秘密。',
    queryTerms: ['性爱', '性欲', '情欲', '欲望', '身体', '肉体', '生理', '心理', '亲密', '生育', '繁殖', '交配', '来历', '出身', '出生', '降生', '父母', '父亲', '母亲', '血脉', '混血', '半仙', '仙兽', '麒麟', '甘雨', '角', '害羞', '秘密', '体型'],
    recordTerms: ['欲望', '身体', '肉体', '生理上', '心理上', '亲密', '生育', '降生', '父母', '父亲', '母亲', '血脉', '混血', '半仙', '仙兽', '麒麟', '甘雨', '麒麟的角', '我的角', '发饰', '害羞', '疏远', '体型', '食欲', '来历', '出身'],
    prompts: ['用原神文本隐喻身体和欲望', '甘雨的来历与麒麟血脉', '亲密关系、身体边界和身份秘密'],
  },
  {
    id: 'justice_trial',
    name: '审判与公正',
    description: '法律、审判、罪、惩罚、公正、证据与程序。',
    queryTerms: ['审判', '公正', '法律', '罪', '惩罚', '证据', '调查', '真相', '程序', '处罚', '问责', '举报', '舆论', '造谣', '热搜', '网暴'],
    recordTerms: ['审判', '公正', '法律', '律法', '罪', '惩罚', '证据', '调查', '真相', '法庭', '枫丹', '裁判', '问责'],
    prompts: ['如何评价处罚是否公正', '舆论和审判', '证据不足时怎么评论'],
  },
  {
    id: 'harm_protection',
    name: '伤害与保护',
    description: '暴力、伤害、恐惧、保护、危险、代价与安全。',
    queryTerms: ['暴力', '打人', '霸凌', '欺凌', '羞辱', '骚扰', '伤害', '恐惧', '危险', '保护', '安全', '受害者', '威胁', '伤口', '痛苦', '焦虑', '抑郁'],
    recordTerms: ['暴力', '伤害', '痛苦', '恐惧', '危险', '保护', '安全', '威胁', '伤口', '牺牲', '代价'],
    prompts: ['家暴与权力', '保护受害者', '暴力行为的责任'],
  },
  {
    id: 'memory_truth',
    name: '记忆与真相',
    description: '记忆、遗忘、历史、真相、记录、谣言与叙事。',
    queryTerms: ['记忆', '遗忘', '历史', '真相', '记录', '叙事', '谣言', '传言', '舆论', '证词', '反转', '公关', '小作文', '饭圈'],
    recordTerms: ['记忆', '遗忘', '历史', '真相', '记录', '传说', '故事', '谣言', '传言', '叙事', '见证'],
    prompts: ['公共事件里的真相', '舆论如何讲故事', '谁有资格记录历史'],
  },
  {
    id: 'bureaucracy_control',
    name: '流程与控制',
    description: '流程、申请、命令、管理、许可、效率与官僚化。',
    queryTerms: ['流程', '申请', '命令', '管理', '许可', '审批', '效率', '考核', '绩效', '指标', '制度', '控制', '治理', '形式主义', '官僚', '强制', '收缴', '打卡', '出勤', '内卷', '加班', '996'],
    recordTerms: ['流程', '申请', '命令', '管理', '许可', '审批', '公务', '指标', '制度', '控制', '治理', '规定'],
    prompts: ['用流程替代教育', '管理主义', '为了效率牺牲人'],
  },
  {
    id: 'resistance_hope',
    name: '反抗与希望',
    description: '反抗、选择、韧劲、未来、希望、勇气与改变。',
    queryTerms: ['反抗', '选择', '希望', '未来', '勇气', '改变', '韧劲', '不屈', '自由', '挣脱'],
    recordTerms: ['反抗', '选择', '希望', '未来', '勇气', '改变', '韧劲', '不屈', '挣脱', '追寻', '前进'],
    prompts: ['反抗不合理制度', '还有没有改变的可能', '压迫之下的韧劲'],
  },
  {
    id: 'dignity_identity',
    name: '尊严与身份',
    description: '名字、身份、尊严、证明、编号、成年人和主体性。',
    queryTerms: ['尊严', '身份', '名字', '证明', '编号', '主体性', '成年人', '人格', '标签', '清点', '性别', '女性', '女权', '厌女', '劳动', '裁员'],
    recordTerms: ['尊严', '身份', '名字', '证明', '编号', '主体', '成年人', '人格', '标签', '清点', '名号'],
    prompts: ['大学生被当成编号', '人如何保有尊严', '被制度标签化'],
  },
];

function git(args, fallback = '') {
  try {
    return execFileSync('git', ['-C', dataDir, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactSpaces(value) {
  return cleanText(value).replace(/\s+/g, ' ').trim();
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
  if (/MainQuest|Quest/.test(file)) return quotedTitle ? `《原神》·任务「${quotedTitle}」` : '《原神》·任务';

  return quotedTitle ? `《原神》·${quotedTitle}` : `《原神》·${ref?.category || '游戏文本'}`;
}

function sourceTitle(ref, citation) {
  const source = ref?.source || '';
  return (
    citation.match(/·任务「([^」]+)」/)?.[1] ||
    citation.match(/·素材图鉴「([^」]+)」/)?.[1] ||
    citation.match(/·道具「([^」]+)」/)?.[1] ||
    citation.match(/·书籍「([^」]+)」/)?.[1] ||
    citation.match(/·武器「([^」]+)」/)?.[1] ||
    citation.match(/·圣遗物「([^」]+)」/)?.[1] ||
    source.match(/「([^」]+)」/)?.[1] ||
    ''
  );
}

function speakerName(ref, citation) {
  const source = ref?.source || '';
  if (ref?.file === 'DialogExcelConfigData.json') {
    return citation.split('·').at(-1)?.replace(/^对话$/, '') || source.match(/：「([^」]+)」/)?.[1] || '';
  }
  if (/角色故事|角色语音/.test(citation)) {
    return citation.replace(/^《原神》·/, '').replace(/·角色(故事|语音)$/, '');
  }
  return source.match(/：「([^」]+)」/)?.[1] || '';
}

function sourceRank(ref) {
  const file = ref?.file || '';
  const field = ref?.field || '';
  const source = ref?.source || '';
  let rank = 0.35;
  if (file === 'DialogExcelConfigData.json' && /talkContent/i.test(field)) rank = 0.98;
  else if (/FetterStory/.test(file) && /storyContext/i.test(field)) rank = 0.95;
  else if (/Fetters/.test(file) && /voiceFileText/i.test(field)) rank = 0.92;
  else if (/Book|Readable/.test(file)) rank = 0.88;
  else if (/MaterialCodex|MaterialExcel|Reliquary|Weapon/.test(file) && /desc|story/i.test(field)) rank = 0.84;
  else if (/MainQuest|Quest/.test(file)) rank = 0.76;
  else if (/LoadingTips|Reminder/.test(file)) rank = 0.62;
  else if (/Manual|Tutorial/.test(file)) rank = 0.42;
  else if (/Activity|Watcher|BattlePass|GCG|MusicGame/.test(file)) rank = 0.32;
  if (/nameTextMapHash|talkRoleName|speaker/i.test(field)) rank -= 0.28;
  if (/test|\$HIDDEN|UNRELEASED/i.test(source)) rank -= 0.35;
  return Math.max(0.05, Math.min(1, rank));
}

function textRank(text) {
  const compact = compactSpaces(text);
  let rank = 0.5;
  const len = compact.length;
  if (len >= 12 && len <= 180) rank += 0.25;
  else if (len >= 181 && len <= 420) rank += 0.16;
  else if (len < 4) rank -= 0.35;
  else if (len > 700) rank -= 0.18;
  if (/[，。；？！]/.test(compact)) rank += 0.08;
  if (/^\W*$/.test(compact)) rank -= 0.4;
  if (/^\d+$/.test(compact)) rank -= 0.5;
  if (/\{|\}|\$HIDDEN|UNRELEASED|test\)/i.test(compact)) rank -= 0.25;
  return Math.max(0.05, Math.min(1, rank));
}

function isReadableQuote(text) {
  const compact = compactSpaces(text);
  const han = compact.match(/[\u4e00-\u9fff]/g)?.length || 0;
  if (han < 4) return false;
  if (han / Math.max(1, compact.length) < 0.22) return false;
  if (/^[0-9.\-_\s「」"'#]+$/.test(compact)) return false;
  return true;
}

function chooseBestRef(refs) {
  if (!refs?.length) return null;
  return [...refs].sort((a, b) => sourceRank(b) - sourceRank(a))[0];
}

function splitLongSentence(sentence) {
  const compact = compactSpaces(sentence);
  if (compact.length <= MAX_QUOTE_LENGTH) return [compact];
  const clauses = compact.match(/[^，、,]+[，、,]?/g) || [compact];
  const chunks = [];
  let current = '';
  for (const clause of clauses) {
    const next = current ? `${current}${clause}` : clause;
    if (next.length > MAX_QUOTE_LENGTH && current.length >= 24) {
      chunks.push(current);
      current = clause;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => (chunk.length > MAX_QUOTE_LENGTH ? chunk.match(new RegExp(`.{1,${MAX_QUOTE_LENGTH}}`, 'g')) || [] : [chunk]));
}

function splitIntoQuoteChunks(text) {
  const compact = compactSpaces(text).replace(/^#+/, '').trim();
  if (compact.length <= MAX_QUOTE_LENGTH) return [compact];

  const sentences = compact.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [compact];
  const chunks = [];
  let buffer = '';

  function flush() {
    const value = buffer.trim();
    if (value.length >= 8) chunks.push(value);
    buffer = '';
  }

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > MAX_QUOTE_LENGTH) {
      flush();
      chunks.push(...splitLongSentence(sentence).filter((item) => item.length >= 8));
      continue;
    }
    const next = buffer ? `${buffer}${sentence}` : sentence;
    if (next.length > MAX_QUOTE_LENGTH) {
      flush();
      buffer = sentence;
      continue;
    }
    buffer = next;
    if (buffer.length >= 46 && /[。！？!?；;]$/.test(sentence)) flush();
  }
  flush();

  return chunks.length ? chunks : [compact.slice(0, MAX_QUOTE_LENGTH)];
}

function topicVector(searchable) {
  const vector = [];
  for (const topic of TOPICS) {
    let score = 0;
    for (const term of topic.recordTerms) {
      if (!term) continue;
      const count = searchable.split(term).length - 1;
      if (count > 0) score += Math.min(3, count) * Math.min(3, Math.max(1, term.length / 2));
    }
    if (score > 0) vector.push([topic.id, Number(Math.min(9, score).toFixed(2))]);
  }
  return vector.sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function isCoreRecord(record, ref, text) {
  if (!ref) return false;
  if (record.q < 0.66) return false;
  if (compactSpaces(text).length < 8) return false;
  if (/^《原神》·(教程\/提示|活动\/玩法|游戏文本)$/.test(record.c)) return false;
  if (/nameTextMapHash|speakerTextMapHash|titleTextMapHash$/i.test(ref.field || '')) return false;
  return true;
}

function makeRecord(hash, text, refs) {
  const ref = chooseBestRef(refs);
  const citation = ref ? humanCitation(ref) : '《原神》·未定位文本';
  const searchable = compactSpaces(`${text} ${citation} ${ref?.source || ''}`);
  const vector = topicVector(searchable);
  const q = Number(((sourceRank(ref) * 0.62) + (textRank(text) * 0.3) + (vector.length ? 0.08 : 0)).toFixed(3));
  const record = {
    id: hash,
    t: compactSpaces(text).slice(0, MAX_TEXT_LENGTH),
    c: citation,
    k: ref?.category || '未定位文本',
    f: ref?.file || '',
    sp: ref ? speakerName(ref, citation) : '',
    src: ref ? sourceTitle(ref, citation) : '',
    q,
    v: vector,
  };
  return { record, ref };
}

function makeQuoteRecord(hash, index, text, ref) {
  const citation = humanCitation(ref);
  const searchable = compactSpaces(`${text} ${citation} ${ref?.source || ''}`);
  const vector = topicVector(searchable);
  const q = Number(((sourceRank(ref) * 0.62) + (textRank(text) * 0.3) + (vector.length ? 0.08 : 0)).toFixed(3));
  return {
    id: `${hash}:${index}`,
    t: compactSpaces(text).slice(0, MAX_QUOTE_LENGTH),
    c: citation,
    k: ref?.category || '游戏文本',
    f: ref?.file || '',
    sp: speakerName(ref, citation),
    src: sourceTitle(ref, citation),
    q,
    v: vector,
  };
}

async function writeShards(root, prefix, records, size) {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const shards = [];
  for (let start = 0; start < records.length; start += size) {
    const index = String(shards.length).padStart(3, '0');
    const name = `${prefix}-${index}.json`;
    const filePath = path.join(root, name);
    const items = records.slice(start, start + size);
    await writeFile(filePath, JSON.stringify(items), 'utf8');
    shards.push({
      path: path.posix.join('data', path.basename(root), name),
      count: items.length,
    });
  }
  return shards;
}

async function main() {
  await mkdir(webDataDir, { recursive: true });

  const fallback = await loadJson(path.join(textMapDir, FALLBACK_TEXTMAP), {});
  const primary = await loadJson(path.join(textMapDir, PRIMARY_TEXTMAP), {});
  const sourceIndex = await loadJson(sourceIndexPath, { refs: {} });
  const workflowManifest = await loadJson(workflowManifestPath, {});

  const textMap = new Map();
  for (const [hash, text] of Object.entries(fallback)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }
  for (const [hash, text] of Object.entries(primary)) {
    const cleaned = cleanText(text);
    if (cleaned) textMap.set(hash, cleaned);
  }

  const core = [];
  const extra = [];
  let sourced = 0;
  let unsourced = 0;

  for (const [hash, text] of textMap.entries()) {
    const cleaned = compactSpaces(text);
    if (cleaned.length < 2 || cleaned.length > MAX_TEXT_LENGTH) continue;
    const refs = sourceIndex.refs?.[hash] || [];
    if (refs.length) sourced += 1;
    else unsourced += 1;
    const { record, ref } = makeRecord(hash, cleaned, refs);
    if (isCoreRecord(record, ref, cleaned)) {
      const chunks = splitIntoQuoteChunks(cleaned);
      for (const [index, chunk] of chunks.entries()) {
        if (!isReadableQuote(chunk)) continue;
        const quoteRecord = makeQuoteRecord(hash, index, chunk, ref);
        if (quoteRecord.q >= 0.64) core.push(quoteRecord);
      }
    } else {
      extra.push(record);
    }
  }

  core.sort((a, b) => b.q - a.q || a.t.length - b.t.length);
  extra.sort((a, b) => b.q - a.q || a.t.length - b.t.length);

  const coreShards = await writeShards(path.join(webDataDir, 'core'), 'core', core, CORE_SHARD_SIZE);
  const extraShards = await writeShards(path.join(webDataDir, 'extra'), 'extra', extra, EXTRA_SHARD_SIZE);

  const topics = {
    schema: 1,
    topics: TOPICS.map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      queryTerms: topic.queryTerms,
      prompts: topic.prompts,
    })),
  };
  await writeFile(path.join(webDataDir, 'topics.json'), JSON.stringify(topics, null, 2), 'utf8');

  const manifest = {
    schema: 1,
    builtAt: new Date().toISOString(),
    upstream: workflowManifest.upstream || {
      name: 'Dimbreath/AnimeGameData',
      url: git(['remote', 'get-url', 'origin'], 'https://gitlab.com/Dimbreath/AnimeGameData.git'),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], 'master'),
      commit: git(['rev-parse', 'HEAD']),
      commitDate: git(['log', '-1', '--pretty=%ci']),
      commitSubject: git(['log', '-1', '--pretty=%s']),
    },
    counts: {
      textEntries: textMap.size,
      publishedRecords: core.length + extra.length,
      coreRecords: core.length,
      extraRecords: extra.length,
      sourcedRecords: sourced,
      unsourcedRecords: unsourced,
    },
    modes: {
      core: {
        label: '核心引文库',
        description: '默认加载，面向写作和手机检索，优先包含任务对白、角色故事、角色语音、书籍、图鉴和道具说明。',
        shards: coreShards,
      },
      full: {
        label: '全量文本',
        description: '在核心引文库基础上加载其余 TextMap 文本，包含 UI、活动规则、名称和未定位文本，适合精确查漏。',
        shards: extraShards,
      },
    },
  };
  await writeFile(path.join(webDataDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Core records: ${core.length}`);
  console.log(`Extra records: ${extra.length}`);
  console.log(`Published records: ${core.length + extra.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
