const $ = (selector) => document.querySelector(selector);

const els = {
  query: $('#query'),
  searchButton: $('#searchButton'),
  clearButton: $('#clearButton'),
  fullMode: $('#fullMode'),
  exactMode: $('#exactMode'),
  status: $('#status'),
  summary: $('#summary'),
  activeTopics: $('#activeTopics'),
  results: $('#results'),
  template: $('#resultTemplate'),
};

const state = {
  manifest: null,
  topics: [],
  topicById: new Map(),
  featured: [],
  core: [],
  extra: [],
  coreLoaded: false,
  extraLoaded: false,
  searching: false,
};

const WEAK_TERMS = new Set([
  '学生',
  '学校',
  '高校',
  '大学',
  '老师',
  '上课',
  '课堂',
  '学院',
  '学者',
  '学习',
  '教令院',
  '管理',
  '系统',
  '数据',
]);

const STRONG_TERMS = new Set([
  '风纪',
  '教令',
  '求知',
  '虚空',
  '终端',
  '监控',
  '识别',
  '摄像头',
  '权力',
  '责任',
  '自由',
  '束缚',
  '枷锁',
  '棋子',
  '敌人',
  '信任',
  '审判',
  '公正',
  '麒麟',
  '仙兽',
  '血脉',
  '混血',
  '身体',
  '生理',
  '心理',
  '欲望',
  '私欲',
  '羞耻',
  '亲密',
  '相亲',
  '结合',
  '生儿育女',
  '沐浴',
  '月光',
  '来历',
]);

const CONCEPT_HINTS = [
  {
    pattern: /性爱|性欲|性描写|性暗示|性关系|隐晦.*性|情欲|欲望|情色|肉欲|身体|肉体|生理|亲密|亲密描写|生育|繁殖|交配|来历|出身|出生|降生|父母|父亲|母亲|血脉|混血|半仙|仙兽|麒麟|角/,
    topics: { body_desire_origin: 10, silence_relationship: 4, dignity_identity: 4, trust_personhood: 2 },
    terms: ['羞耻', '私欲', '沐浴', '衣物', '相亲', '结合', '互相结合', '生儿育女', '生育', '幼儿', '血脉', '混血', '身体', '亲密', '月光', '露珠', '浅睡', '凡人', '仙兽'],
  },
  {
    pattern: /霸凌|欺凌|羞辱|欺负|孤立|网暴|骚扰|伤害|暴力|羞耻/,
    topics: { harm_protection: 8, justice_trial: 5, dignity_identity: 4, trust_personhood: 3 },
    terms: ['伤害', '保护', '尊严', '审判', '公正', '信任', '敌人'],
  },
  {
    pattern: /内卷|加班|996|绩效|考核|裁员|失业|工资|劳动|打工|剥削|职场/,
    topics: { bureaucracy_control: 8, power_responsibility: 6, dignity_identity: 4, harm_protection: 3 },
    terms: ['责任', '权力', '代价', '流程', '指标', '尊严', '承担'],
  },
  {
    pattern: /pua|操控|洗脑|控制欲|情绪勒索|煤气灯|服从|顺从/,
    topics: { trust_personhood: 8, freedom_order: 6, silence_relationship: 5, harm_protection: 3 },
    terms: ['信任', '操纵', '工具', '棋子', '束缚', '自由', '伤害'],
  },
  {
    pattern: /性别|女性|女权|厌女|婚恋|彩礼|家务|生育|恋爱|出轨|分手|亲密关系/,
    topics: { silence_relationship: 7, trust_personhood: 5, dignity_identity: 5, power_responsibility: 4, body_desire_origin: 3 },
    terms: ['信任', '背叛', '关系', '尊严', '责任', '伤害', '等待', '身体', '血脉'],
  },
  {
    pattern: /焦虑|抑郁|压力|崩溃|痛苦|绝望|孤独|自责|创伤/,
    topics: { harm_protection: 7, silence_relationship: 6, resistance_hope: 4, trust_personhood: 3 },
    terms: ['痛苦', '恐惧', '希望', '保护', '沉默', '孤独', '勇气'],
  },
  {
    pattern: /形式主义|一刀切|官僚|审批|流程|填表|打卡|指标|汇报|留痕/,
    topics: { bureaucracy_control: 9, power_responsibility: 5, freedom_order: 4, dignity_identity: 3 },
    terms: ['流程', '制度', '规定', '责任', '权力', '自由', '约束'],
  },
  {
    pattern: /舆论|造谣|谣言|反转|热搜|小作文|举报|证据|吃瓜|公关/,
    topics: { memory_truth: 8, justice_trial: 6, trust_personhood: 3, power_responsibility: 3 },
    terms: ['真相', '记录', '证据', '审判', '公正', '信任', '故事'],
  },
  {
    pattern: /饭圈|粉丝|偶像|塌房|控评|追星|群体|狂热/,
    topics: { memory_truth: 5, trust_personhood: 5, dignity_identity: 4, justice_trial: 3 },
    terms: ['故事', '信任', '身份', '审判', '真相', '名字'],
  },
  {
    pattern: /ai|算法|大模型|自动化|机器人|推荐|平台|数据|隐私/,
    topics: { surveillance_technology: 8, trust_personhood: 5, dignity_identity: 4, power_responsibility: 4 },
    terms: ['数据', '系统', '终端', '工具', '责任', '信任', '编号'],
  },
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function conceptHints(query) {
  const normalized = normalize(query).replace(/\s+/g, '');
  const topics = new Map();
  const terms = [];
  for (const hint of CONCEPT_HINTS) {
    if (!hint.pattern.test(normalized)) continue;
    for (const [id, score] of Object.entries(hint.topics)) {
      topics.set(id, (topics.get(id) || 0) + score);
    }
    terms.push(...hint.terms);
  }
  return { topics, terms };
}

function bigrams(text) {
  const compact = normalize(text).replace(/\s+/g, '');
  const grams = new Set();
  for (let index = 0; index < compact.length - 1; index += 1) grams.add(compact.slice(index, index + 2));
  return grams;
}

function overlapScore(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return overlap / Math.min(a.size, b.size);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function extractTerms(query) {
  const normalized = normalize(query);
  const parts = normalized.split(/\s+/).filter(Boolean);
  const terms = [];
  for (const part of parts) {
    terms.push(part);
    if (/[\u4e00-\u9fff]/.test(part) && part.length >= 4) {
      for (let size = 2; size <= 4; size += 1) {
        for (let index = 0; index <= part.length - size; index += 1) {
          terms.push(part.slice(index, index + size));
        }
      }
    }
  }
  return unique(terms)
    .filter((term) => term.length >= 2)
    .slice(0, 80);
}

function topicScores(query, terms, hints = conceptHints(query)) {
  const normalized = normalize(query).replace(/\s+/g, '');
  const scores = new Map();
  for (const topic of state.topics) {
    let score = 0;
    for (const term of topic.queryTerms) {
      const t = normalize(term).replace(/\s+/g, '');
      if (!t) continue;
      if (normalized.includes(t)) score += Math.min(5, 1 + t.length / 2);
      else if (terms.includes(t)) score += 1;
    }
    if (score > 0) scores.set(topic.id, score);
  }
  const add = (id, value) => scores.set(id, (scores.get(id) || 0) + value);
  for (const [id, score] of hints.topics.entries()) add(id, score);
  if (/手机袋|收缴|上交|不得不|强制/.test(normalized)) {
    add('freedom_order', 7);
    add('trust_personhood', 5);
    add('bureaucracy_control', 4);
  }
  if (/摄像头|识别|监控|打卡|出勤|数据|编号/.test(normalized)) {
    add('surveillance_technology', 7);
    add('power_responsibility', 4);
    add('dignity_identity', 3);
  }
  if (/冷暴力|不回|不接|沉默|疏离/.test(normalized)) {
    add('silence_relationship', 8);
    add('trust_personhood', 4);
  }
  if (/性爱|性欲|性描写|性暗示|性关系|隐晦.*性|情欲|欲望|身体|肉体|生理|亲密|生育|父母|血脉|混血|麒麟|仙兽|甘雨|角/.test(normalized)) {
    add('body_desire_origin', 9);
    add('dignity_identity', 3);
  }
  if (scores.size === 0) {
    const queryGrams = bigrams(query);
    const fuzzy = state.topics
      .map((topic) => {
        const haystack = `${topic.name} ${topic.description} ${topic.queryTerms.join(' ')} ${topic.prompts.join(' ')}`;
        return [topic.id, overlapScore(queryGrams, bigrams(haystack))];
      })
      .filter(([, score]) => score >= 0.08)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [id, score] of fuzzy) add(id, Math.max(2, score * 12));
  }
  return scores;
}

function expandedTerms(terms, scores, hintTerms = []) {
  const selected = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => state.topicById.get(id))
    .filter(Boolean);
  const expansion = [];
  for (const topic of selected) expansion.push(...topic.queryTerms.slice(0, 14));
  return unique([...terms, ...hintTerms, ...expansion.map((term) => normalize(term).replace(/\s+/g, ''))])
    .filter((term) => term.length >= 2)
    .slice(0, 110);
}

function fallbackScores(query, scores) {
  if (scores.size > 0) return scores;
  const queryGrams = bigrams(query);
  const fuzzy = state.topics
    .map((topic) => {
      const haystack = `${topic.name} ${topic.description} ${topic.queryTerms.join(' ')} ${topic.prompts.join(' ')}`;
      return [topic.id, overlapScore(queryGrams, bigrams(haystack))];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const fallback = new Map();
  for (const [id, score] of fuzzy) fallback.set(id, Math.max(2, score * 10));
  if (fallback.size === 0) {
    fallback.set('trust_personhood', 2.4);
    fallback.set('memory_truth', 2.2);
    fallback.set('power_responsibility', 2);
  }
  return fallback;
}

function recordTopicScore(record, scores) {
  if (!record.v?.length || scores.size === 0) return 0;
  let score = 0;
  for (const [topicId, weight] of record.v) {
    score += (scores.get(topicId) || 0) * Number(weight || 1);
  }
  return score;
}

function lexicalScore(record, queryTerms, expansionTerms, exactMode) {
  const text = normalize(`${record.t} ${record.c} ${record.sp || ''} ${record.src || ''}`).replace(/\s+/g, '');
  let score = 0;
  for (const term of queryTerms) {
    const t = term.replace(/\s+/g, '');
    if (!t || t.length < 2) continue;
    const count = text.split(t).length - 1;
    const weight = WEAK_TERMS.has(t) ? 0.55 : STRONG_TERMS.has(t) ? 1.55 : 1;
    if (count > 0) score += count * (t.length >= 4 ? 5.5 : 3.2) * weight;
  }
  if (!exactMode) {
    for (const term of expansionTerms) {
      if (queryTerms.includes(term)) continue;
      const count = text.split(term).length - 1;
      const weight = WEAK_TERMS.has(term) ? 0.25 : STRONG_TERMS.has(term) ? 1.8 : 1;
      if (count > 0) score += count * (term.length >= 4 ? 1.5 : 0.9) * weight;
    }
  }
  return score;
}

function scoreRecord(record, queryTerms, expansionTerms, scores, exactMode) {
  const han = record.t.match(/[\u4e00-\u9fff]/g)?.length || 0;
  if (han < 4 || han / Math.max(1, record.t.length) < 0.18) return 0;
  const lexical = lexicalScore(record, queryTerms, expansionTerms, exactMode);
  const semantic = exactMode ? 0 : recordTopicScore(record, scores);
  const quality = Number(record.q || 0.3) * 10;
  const sourceBoost = /任务|角色|书籍|素材图鉴|道具|圣遗物|武器/.test(record.c) ? 2.2 : 0;
  const length = record.t.length;
  const lengthBoost = length >= 10 && length <= 220 ? 1.2 : length > 600 ? -1.5 : 0;
  const activeStrongTerms = new Set([...queryTerms, ...expansionTerms].filter((term) => STRONG_TERMS.has(term)));
  const ideaBoost = activeStrongTerms.size
    ? [...activeStrongTerms].reduce((sum, term) => sum + (record.t.includes(term) ? 0.8 : 0), 0)
    : 0;
  const featuredBoost = record.hot ? 18 : 0;
  const finalScore =
    lexical * (exactMode ? 1.35 : 1) + semantic * 1.35 + quality + sourceBoost + lengthBoost + ideaBoost + featuredBoost;
  if (lexical <= 0 && semantic <= 0) return 0;
  return finalScore;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  return response.json();
}

async function loadManifest() {
  state.manifest = await fetchJson('./data/manifest.json');
  const topicData = await fetchJson('./data/topics.json');
  state.featured = await fetchJson('./data/featured.json');
  state.topics = topicData.topics || [];
  state.topicById = new Map(state.topics.map((topic) => [topic.id, topic]));
  const counts = state.manifest.counts;
  els.status.textContent = `已准备：核心引文 ${counts.coreRecords.toLocaleString('zh-CN')} 条，全量文本 ${counts.publishedRecords.toLocaleString('zh-CN')} 条。`;
}

async function loadShards(shards, label) {
  const chunks = [];
  let loaded = 0;
  for (const shard of shards) {
    const data = await fetchJson(`./${shard.path}`);
    chunks.push(...data);
    loaded += data.length;
    if (loaded % 26000 < data.length) {
      els.status.textContent = `正在加载${label}：${loaded.toLocaleString('zh-CN')} 条…`;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return chunks;
}

async function ensureCore() {
  if (state.coreLoaded) return;
  els.status.textContent = '正在加载核心引文库…';
  state.core = [...state.featured, ...(await loadShards(state.manifest.modes.core.shards, '核心引文库'))];
  state.coreLoaded = true;
  els.status.textContent = `核心引文库已加载：${state.core.length.toLocaleString('zh-CN')} 条。`;
}

async function ensureExtra() {
  if (state.extraLoaded) return;
  els.status.textContent = '正在加载全量文本，首次会稍慢…';
  state.extra = await loadShards(state.manifest.modes.full.shards, '全量文本');
  state.extraLoaded = true;
  els.status.textContent = `全量文本已加载：${(state.core.length + state.extra.length).toLocaleString('zh-CN')} 条。`;
}

function renderTopics(scores) {
  els.activeTopics.innerHTML = '';
  const items = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => state.topicById.get(id))
    .filter(Boolean);
  for (const topic of items) {
    const span = document.createElement('span');
    span.className = 'pill';
    span.textContent = topic.name;
    els.activeTopics.append(span);
  }
}

function renderResults(results) {
  els.results.innerHTML = '';
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `
      <p>没有找到足够直接的结果。可以换成更抽象的概念词，或者关闭“偏精确匹配”。</p>
      <div class="empty-actions">
        <button type="button" data-empty-query="权力 责任">权力 责任</button>
        <button type="button" data-empty-query="自由 束缚">自由 束缚</button>
        <button type="button" data-empty-query="信任 棋子">信任 棋子</button>
        <button type="button" data-empty-query="审判 公正">审判 公正</button>
      </div>
    `;
    empty.querySelectorAll('[data-empty-query]').forEach((button) => {
      button.addEventListener('click', () => {
        els.query.value = button.dataset.emptyQuery || '';
        els.exactMode.checked = false;
        search();
      });
    });
    els.results.append(empty);
    return;
  }
  for (const item of results.slice(0, 24)) {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector('.result-card');
    card.querySelector('.category').textContent = item.record.k || '游戏文本';
    card.querySelector('.score').textContent = `匹配 ${Math.round(item.score)}`;
    card.querySelector('.quote').textContent = item.record.t;
    card.querySelector('.citation').textContent = `——${item.record.c}`;
    const topicList = card.querySelector('.topic-list');
    for (const [topicId] of item.record.v?.slice(0, 3) || []) {
      const topic = state.topicById.get(topicId);
      if (!topic) continue;
      const tag = document.createElement('span');
      tag.className = 'topic-tag';
      tag.textContent = topic.name;
      topicList.append(tag);
    }
    card.querySelector('.copy-quote').addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.record.t);
      els.status.textContent = '已复制原文。';
    });
    card.querySelector('.copy-citation').addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${item.record.t}\n——${item.record.c}`);
      els.status.textContent = '已复制原文和出处。';
    });
    els.results.append(node);
  }
}

function addFallbackResults(deduped, seen, records, scores) {
  const additions = records
    .map((record) => {
      const semantic = recordTopicScore(record, scores);
      if (semantic <= 0 && !record.hot) return null;
      return {
        record,
        score: semantic * 1.7 + Number(record.q || 0.4) * 10 + (record.hot ? 20 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.record.q - a.record.q);

  for (const item of additions) {
    const key = `${item.record.t}|${item.record.c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 24) break;
  }
}

async function search() {
  const query = els.query.value.trim();
  if (!query || state.searching) return;
  state.searching = true;
  els.searchButton.disabled = true;
  try {
    await ensureCore();
    if (els.fullMode.checked) await ensureExtra();
    const records = els.fullMode.checked ? [...state.core, ...state.extra] : state.core;
    const hints = conceptHints(query);
    const queryTerms = unique([...extractTerms(query), ...hints.terms.map((term) => normalize(term).replace(/\s+/g, ''))]);
    const scores = topicScores(query, queryTerms, hints);
    const expansionTerms = expandedTerms(queryTerms, scores, hints.terms);
    renderTopics(scores);

    const ranked = [];
    const exactMode = els.exactMode.checked;
    const batch = 16000;
    for (let start = 0; start < records.length; start += batch) {
      const end = Math.min(records.length, start + batch);
      for (let index = start; index < end; index += 1) {
        const record = records[index];
        const score = scoreRecord(record, queryTerms, expansionTerms, scores, exactMode);
        if (score > 7) ranked.push({ record, score });
      }
      if (records.length > batch) {
        els.status.textContent = `正在检索：${end.toLocaleString('zh-CN')} / ${records.length.toLocaleString('zh-CN')} 条…`;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    ranked.sort((a, b) => b.score - a.score || b.record.q - a.record.q || a.record.t.length - b.record.t.length);
    const deduped = [];
    const seen = new Set();
    for (const item of ranked) {
      const key = `${item.record.t}|${item.record.c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 80) break;
    }
    let usedFallback = false;
    if (!exactMode && deduped.length < 8) {
      usedFallback = true;
      const broadScores = fallbackScores(query, scores);
      renderTopics(broadScores);
      addFallbackResults(deduped, seen, records, broadScores);
    }

    els.summary.textContent = usedFallback
      ? `“${query}” 直接命中较少，已启用主题兜底，当前展示 ${Math.min(24, deduped.length)} 条可用引文。`
      : `“${query}” 找到 ${deduped.length} 条候选，当前展示前 ${Math.min(24, deduped.length)} 条。`;
    els.status.textContent = els.fullMode.checked ? '全量检索完成。' : '核心引文库检索完成。';
    renderResults(deduped);
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    if (els.fullMode.checked) url.searchParams.set('mode', 'full');
    else url.searchParams.delete('mode');
    history.replaceState(null, '', url);
  } catch (error) {
    els.status.textContent = error.message || '检索失败。';
  } finally {
    state.searching = false;
    els.searchButton.disabled = false;
  }
}

function bindEvents() {
  els.searchButton.addEventListener('click', search);
  els.clearButton.addEventListener('click', () => {
    els.query.value = '';
    els.summary.textContent = '输入一个议题开始检索。';
    els.results.innerHTML = '';
    els.activeTopics.innerHTML = '';
    history.replaceState(null, '', window.location.pathname);
  });
  els.query.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') search();
  });
  document.querySelectorAll('[data-query]').forEach((button) => {
    button.addEventListener('click', () => {
      els.query.value = button.dataset.query || '';
      search();
    });
  });
}

async function init() {
  bindEvents();
  await loadManifest();
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (params.get('mode') === 'full') els.fullMode.checked = true;
  if (q) {
    els.query.value = q;
    search();
  }
}

init();
