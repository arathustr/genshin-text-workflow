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
]);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function topicScores(query, terms) {
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
  return scores;
}

function expandedTerms(terms, scores) {
  const selected = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => state.topicById.get(id))
    .filter(Boolean);
  const expansion = [];
  for (const topic of selected) expansion.push(...topic.queryTerms.slice(0, 14));
  return unique([...terms, ...expansion.map((term) => normalize(term).replace(/\s+/g, ''))])
    .filter((term) => term.length >= 2)
    .slice(0, 110);
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
  const ideaBoost = STRONG_TERMS.size
    ? [...STRONG_TERMS].reduce((sum, term) => sum + (record.t.includes(term) ? 0.8 : 0), 0)
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
    empty.textContent = '没有找到合适结果。试试把议题拆成几个概念词，例如“权力 责任 规训 自由”。';
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

async function search() {
  const query = els.query.value.trim();
  if (!query || state.searching) return;
  state.searching = true;
  els.searchButton.disabled = true;
  try {
    await ensureCore();
    if (els.fullMode.checked) await ensureExtra();
    const records = els.fullMode.checked ? [...state.core, ...state.extra] : state.core;
    const queryTerms = extractTerms(query);
    const scores = topicScores(query, queryTerms);
    const expansionTerms = expandedTerms(queryTerms, scores);
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

    els.summary.textContent = `“${query}” 找到 ${deduped.length} 条候选，当前展示前 ${Math.min(24, deduped.length)} 条。`;
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
