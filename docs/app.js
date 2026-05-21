/* =========================================================================
   注文住宅YouTube動画マップ - Sprint 4.5b 公開サイトJS（タブ切替版）
   - JSONロード（5秒タイムアウト）+ エラーUI
   - formatDuration: ISO 8601 → MM:SS / HH:MM:SS
   - 動画カード生成（XSS対策: textContent / DOM API のみ、innerHTML不使用）
   - 「専門家目線 / 施主目線」をタブで切替（初期: 施主目線 CAT-01）
   - モバイル：アコーディオン 2階層（グループ → ジャンル → 動画）
   - PC：D3.js ツリーマインドマップ（選択中カテゴリ → グループ → ジャンル）+ サイドパネル
   - 768px ブレークポイント切替
   ========================================================================= */

const VIDEOS_JSON_URL = './data/videos.json';
const TIMEOUT_MS = 5000;
const BREAKPOINT_PX = 768;
const DEFAULT_CATEGORY_ID = 'CAT-01'; // 施主目線

/* ---------- ユーティリティ ---------- */

function formatDuration(iso) {
  if (typeof iso !== 'string') return '--:--';
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return '--:--';
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPublishedAt(iso) {
  if (typeof iso !== 'string') return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

async function loadVideos() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(VIDEOS_JSON_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/* ---------- 動画カード生成 ---------- */

function createVideoCard(video) {
  const card = document.createElement('a');
  card.className = 'video-card';
  card.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
  card.target = '_blank';
  card.rel = 'noopener';

  const img = document.createElement('img');
  img.className = 'video-thumb';
  img.src = video.thumbnailUrl;
  img.alt = `${video.title}のサムネイル`;
  img.loading = 'lazy';
  img.onerror = function () {
    this.onerror = null;
    this.src = 'images/no-thumbnail.svg';
  };
  card.appendChild(img);

  const info = document.createElement('div');
  info.className = 'video-info';

  if (Array.isArray(video.tags) && video.tags.length > 0) {
    const badges = document.createElement('div');
    badges.className = 'video-badges';
    if (video.tags.includes('trending')) {
      const b = document.createElement('span');
      b.className = 'badge badge-trending';
      b.textContent = '🔥 急上昇';
      badges.appendChild(b);
    }
    if (video.tags.includes('manual')) {
      const b = document.createElement('span');
      b.className = 'badge badge-manual';
      b.textContent = '⭐ 管理者おすすめ';
      badges.appendChild(b);
    }
    if (badges.children.length > 0) info.appendChild(badges);
  }

  const title = document.createElement('p');
  title.className = 'video-title';
  title.textContent = video.title;
  info.appendChild(title);

  const channel = document.createElement('p');
  channel.className = 'video-channel';
  channel.textContent = video.channelName;
  info.appendChild(channel);

  const meta = document.createElement('p');
  meta.className = 'video-meta';
  meta.textContent = `${formatPublishedAt(video.publishedAt)} ・ ${formatDuration(video.duration)}`;
  info.appendChild(meta);

  card.appendChild(info);
  return card;
}

/* ---------- アコーディオン（モバイル）2階層: グループ → ジャンル ---------- */

function toggleAccordion(button, content) {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  if (expanded) {
    content.setAttribute('aria-hidden', 'true');
    content.setAttribute('inert', '');
  } else {
    content.setAttribute('aria-hidden', 'false');
    content.removeAttribute('inert');
  }
}

function buildAccordionHeader(label, count, levelClass) {
  const btn = document.createElement('button');
  btn.className = `acc-header ${levelClass}`;
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');

  const icon = document.createElement('span');
  icon.className = 'acc-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '▶';
  btn.appendChild(icon);

  const labelEl = document.createElement('span');
  labelEl.className = 'acc-label';
  labelEl.textContent = label;
  btn.appendChild(document.createTextNode(' '));
  btn.appendChild(labelEl);

  if (typeof count === 'number') {
    const countEl = document.createElement('span');
    countEl.className = 'acc-count';
    countEl.textContent = `(${count})`;
    btn.appendChild(document.createTextNode(' '));
    btn.appendChild(countEl);
  }
  return btn;
}

function buildAccordionContent(extraClass) {
  const div = document.createElement('div');
  div.className = `acc-content ${extraClass || ''}`.trim();
  div.setAttribute('aria-hidden', 'true');
  div.setAttribute('inert', '');
  return div;
}

function renderAccordion(cat, container) {
  container.textContent = '';
  (cat.groups || []).forEach((grp) => {
    const totalInGroup = (grp.genres || []).reduce(
      (s, gn) => s + ((gn.videos && gn.videos.length) || 0),
      0
    );
    if (totalInGroup === 0) {
      // 動画 0 件のグループも表示するが「収集中」とする
      const grpEl = document.createElement('div');
      grpEl.className = 'acc-group acc-empty';
      const grpBtn = buildAccordionHeader(grp.name, 0, 'acc-grp-header');
      grpBtn.disabled = true;
      grpEl.appendChild(grpBtn);
      container.appendChild(grpEl);
      return;
    }

    const grpEl = document.createElement('div');
    grpEl.className = 'acc-group';

    const grpBtn = buildAccordionHeader(grp.name, totalInGroup, 'acc-grp-header');
    grpEl.appendChild(grpBtn);

    const grpContent = buildAccordionContent();
    (grp.genres || []).forEach((gnr) => {
      if (!gnr.videos || gnr.videos.length === 0) return;

      const gnrEl = document.createElement('div');
      gnrEl.className = 'acc-genre';

      const gnrBtn = buildAccordionHeader(gnr.name, gnr.videos.length, 'acc-genre-header');
      gnrEl.appendChild(gnrBtn);

      const gnrContent = buildAccordionContent('video-list');
      gnr.videos.forEach((video, i) => {
        const card = createVideoCard(video);
        card.style.setProperty('--idx', i);
        gnrContent.appendChild(card);
      });
      gnrEl.appendChild(gnrContent);

      gnrBtn.addEventListener('click', () => toggleAccordion(gnrBtn, gnrContent));
      grpContent.appendChild(gnrEl);
    });
    grpEl.appendChild(grpContent);

    grpBtn.addEventListener('click', () => toggleAccordion(grpBtn, grpContent));
    container.appendChild(grpEl);
  });
}

/* ---------- D3.js マインドマップ（PC、選択中カテゴリ 3階層・放射状） ---------- */

function renderMindmap(cat, container) {
  if (typeof d3 === 'undefined') {
    container.textContent = 'D3.js の読み込みに失敗しました。';
    return null;
  }
  // 全カテゴリ共通の放射状レイアウト
  return renderMindmapRadial(cat, container);
}

// 放射状マインドマップ（CAT-01 施主目線専用）
// ROOT 中央 → グループ 4個を等角度配置 → ジャンルは親グループ方向に扇形展開
// 1画面に全体像が見通せるよう、コンパクト寸法・長文ラベルは2行折り返し
function renderMindmapRadial(cat, container) {
  container.textContent = '';

  const ROOT_D = 100;
  const GROUP_D = 80;
  const GENRE_D = 72;
  const R1 = 110; // ROOT 中心 → GROUP 中心の距離（枝番号1）
  const R2 = 155; // GROUP 中心 → GENRE 中心の距離（枝番号2）— 円が被らないよう長め

  const nodes = [];
  const edges = [];

  nodes.push({ id: cat.id, type: 'root', label: cat.name, x: 0, y: 0, d: ROOT_D });

  const groups = cat.groups || [];
  const nG = groups.length;
  groups.forEach((grp, i) => {
    const a1 = (i / nG) * Math.PI * 2 - Math.PI / 2;
    const gx = Math.cos(a1) * R1;
    const gy = Math.sin(a1) * R1;
    nodes.push({ id: grp.id, type: 'group', label: grp.name, x: gx, y: gy, d: GROUP_D });
    edges.push({ source: cat.id, target: grp.id, tier: 'root' });

    const genres = grp.genres || [];
    const nGn = genres.length;
    // 4 GROUP × 90° 配置のため、各 GROUP のジャンル広がり角は ±45° 以内に抑えて隣 GROUP へ食い込まない
    const spread = nGn <= 3 ? Math.PI * 0.45 : Math.PI * 0.5;
    genres.forEach((gnr, j) => {
      const offset = nGn > 1 ? (j / (nGn - 1) - 0.5) * spread : 0;
      const a2 = a1 + offset;
      const gnx = gx + Math.cos(a2) * R2;
      const gny = gy + Math.sin(a2) * R2;
      const nodeId = grp.id + '/' + gnr.id;
      nodes.push({
        id: nodeId,
        type: 'genre',
        label: gnr.name,
        x: gnx, y: gny, d: GENRE_D,
        // showSidePanel が利用するフィールド
        name: gnr.name,
        videos: gnr.videos || [],
        categoryId: cat.id,
        groupId: grp.id,
        genreId: gnr.id,
      });
      edges.push({ source: grp.id, target: nodeId, tier: 'group' });
    });
  });

  // viewBox 用 bounding box
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x - n.d / 2);
    y0 = Math.min(y0, n.y - n.d / 2);
    x1 = Math.max(x1, n.x + n.d / 2);
    y1 = Math.max(y1, n.y + n.d / 2);
  }
  const pad = 60;
  const vbX = x0 - pad;
  const vbY = y0 - pad;
  const vbW = (x1 - x0) + pad * 2;
  const vbH = (y1 - y0) + pad * 2;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('class', `mindmap-radial mindmap-radial--${String(cat.id).toLowerCase()}`)
    .attr('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g');

  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const edgePath = (e) => {
    const s = nodeMap[e.source];
    const t = nodeMap[e.target];
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const cx1 = s.x + dx * 0.4;
    const cy1 = s.y + dy * 0.15;
    const cx2 = s.x + dx * 0.6;
    const cy2 = s.y + dy * 0.85;
    return `M${s.x} ${s.y} C${cx1} ${cy1} ${cx2} ${cy2} ${t.x} ${t.y}`;
  };

  // glow + 点線の2 レイヤーで参考HTMLの暖色グロー風を再現
  const glowLayer = g.append('g').attr('class', 'radial-glow-layer');
  const dotLayer = g.append('g').attr('class', 'radial-dot-layer');

  glowLayer.selectAll('path')
    .data(edges)
    .enter()
    .append('path')
    .attr('class', (e) => `radial-edge radial-edge-glow radial-edge-${e.tier}`)
    .attr('d', edgePath);

  dotLayer.selectAll('path')
    .data(edges)
    .enter()
    .append('path')
    .attr('class', (e) => `radial-edge radial-edge-${e.tier}`)
    .attr('d', edgePath);

  const node = g
    .selectAll('g.radial-node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', (n) => `radial-node node-radial-${n.type}`)
    .attr('transform', (n) => `translate(${n.x}, ${n.y})`);

  node.append('circle');

  // ラベル折り返し: 5文字超は2行、それ以下は1行
  const wrapLabel = (label) => {
    if (!label) return [''];
    if (label.length <= 4) return [label];
    const mid = Math.ceil(label.length / 2);
    return [label.slice(0, mid), label.slice(mid)];
  };

  node.each(function (d) {
    const lines = wrapLabel(d.label);
    const text = d3
      .select(this)
      .append('text')
      .attr('text-anchor', 'middle');
    lines.forEach((line, i) => {
      text
        .append('tspan')
        .attr('x', 0)
        .attr('dy', i === 0 ? (lines.length === 1 ? '0.32em' : '-0.2em') : '1.1em')
        .text(line);
    });
  });

  node
    .filter((d) => d.type === 'genre')
    .on('click', (_event, d) => {
      showSidePanel(d);
    });

  return { svg, zoom };
}

function showSidePanel(genre) {
  const panel = document.getElementById('side-panel');
  if (!panel) return;
  panel.textContent = '';

  const heading = document.createElement('h2');
  heading.textContent = genre.name;
  panel.appendChild(heading);

  if (!genre.videos || genre.videos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'このジャンルは現在収集中です。しばらくお待ちください。';
    panel.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'video-list side-panel-list';
  genre.videos.forEach((video, i) => {
    const card = createVideoCard(video);
    card.style.setProperty('--idx', i);
    list.appendChild(card);
  });
  panel.appendChild(list);
}

/* ---------- タブ ---------- */

function renderTabs(data) {
  const nav = document.getElementById('category-tabs');
  if (!nav) return;
  nav.textContent = '';
  for (const cat of data.categories || []) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(cat.id === currentCategoryId));
    btn.setAttribute('aria-controls', 'main-content');
    btn.dataset.catId = cat.id;
    btn.textContent = cat.name;
    btn.addEventListener('click', () => switchCategory(cat.id));
    nav.appendChild(btn);
  }
}

function switchCategory(catId) {
  if (catId === currentCategoryId) return;
  currentCategoryId = catId;
  renderTabs(currentData);
  // ビュー強制再描画
  currentView = null;
  renderForView(currentData);
}

/* ---------- ビュー切替 ---------- */

let currentView = null;
let currentData = null;
let currentMindmap = null;
let currentCategoryId = DEFAULT_CATEGORY_ID;

function determineView() {
  return window.matchMedia(`(min-width: ${BREAKPOINT_PX}px)`).matches ? 'pc' : 'mobile';
}

function renderForView(data) {
  const view = determineView();
  if (view === currentView) return;
  currentView = view;

  const cat =
    (data.categories || []).find((c) => c.id === currentCategoryId) ||
    (data.categories || [])[0];
  if (!cat) return;

  if (view === 'pc') {
    currentMindmap = renderMindmap(cat, document.getElementById('mindmap'));
    // 初期表示でカテゴリの最初のジャンル（GRP-A GNR-01 = 間取り）のサイドパネルを開く
    const firstGroup = (cat.groups || [])[0];
    const firstGenre = firstGroup && (firstGroup.genres || [])[0];
    if (firstGenre) {
      // genre オブジェクトに categoryId/groupId/genreId/name/videos を補完して showSidePanel に渡す
      showSidePanel({
        name: firstGenre.name,
        videos: firstGenre.videos || [],
        categoryId: cat.id,
        groupId: firstGroup.id,
        genreId: firstGenre.id,
      });
    } else {
      // フォールバック: グループ/ジャンル未定義時の placeholder
      const panel = document.getElementById('side-panel');
      if (panel) {
        panel.textContent = '';
        const ph = document.createElement('p');
        ph.className = 'side-panel-placeholder';
        ph.textContent = '左のジャンルを選択してください';
        panel.appendChild(ph);
      }
    }
  } else {
    renderAccordion(cat, document.getElementById('accordion'));
  }
}

function displayLastUpdated(data) {
  if (!data.meta || !data.meta.last_updated) return;
  const el = document.getElementById('last-updated');
  if (!el) return;
  el.textContent = `最終更新日：${formatPublishedAt(data.meta.last_updated)}`;
}

/* ---------- オンボーディング（初回訪問ガイド） ---------- */

const ONBOARDING_KEY = 'takomaru-onboarding-seen';

// PC view 向け 4 ステップ（モバイル view でも同じテキストで動作）
const ONBOARDING_STEPS = [
  {
    title: 'タコまる書庫へようこそ',
    text:
      '注文住宅の YouTube 動画を、視点別・ジャンル別に索引したサイトです。\n4 ステップで使い方をご案内します。',
    target: null,
  },
  {
    title: '視点を切り替える',
    text:
      '「専門家目線（工務店・設計士）」と「施主目線（実際に建てた人）」をタブで切替できます。',
    target: '#category-tabs',
  },
  {
    title: '索引からジャンルを選ぶ',
    text:
      '中央の索引図（マインドマップ）にあるオレンジ色の円をクリックすると、そのジャンルの動画一覧が右側に表示されます。',
    target: '#mindmap-container',
  },
  {
    title: 'YouTube で視聴する',
    text:
      '動画カードをクリックすると、YouTube が新しいタブで開きます。\n気になる動画から自由にご覧ください。',
    target: '#side-panel',
  },
];

let onboardingStepIndex = 0;
let onboardingResizeHandler = null;

function startOnboarding(force) {
  if (!force) {
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === '1') return;
    } catch (_e) {
      // localStorage 不可（プライベートブラウジング等）でもオンボードは表示
    }
  }
  const root = document.getElementById('onboarding');
  if (!root) return;
  onboardingStepIndex = 0;
  root.hidden = false;
  showOnboardingStep(onboardingStepIndex);

  onboardingResizeHandler = () => showOnboardingStep(onboardingStepIndex);
  window.addEventListener('resize', onboardingResizeHandler);
}

function showOnboardingStep(i) {
  const step = ONBOARDING_STEPS[i];
  if (!step) return;
  document.getElementById('onboarding-step-counter').textContent =
    `${i + 1} / ${ONBOARDING_STEPS.length}`;
  document.getElementById('onboarding-title').textContent = step.title;
  document.getElementById('onboarding-text').textContent = step.text;

  const nextBtn = document.getElementById('onboarding-next');
  if (nextBtn) {
    nextBtn.textContent = i === ONBOARDING_STEPS.length - 1 ? '閉じる' : '次へ →';
  }

  const highlight = document.getElementById('onboarding-highlight');
  if (step.target) {
    const el = document.querySelector(step.target);
    if (el && !el.hidden && el.offsetParent !== null) {
      const rect = el.getBoundingClientRect();
      const pad = 6;
      highlight.style.top = `${rect.top - pad}px`;
      highlight.style.left = `${rect.left - pad}px`;
      highlight.style.width = `${rect.width + pad * 2}px`;
      highlight.style.height = `${rect.height + pad * 2}px`;
      highlight.hidden = false;
    } else {
      highlight.hidden = true;
    }
  } else {
    highlight.hidden = true;
  }
}

function finishOnboarding() {
  const root = document.getElementById('onboarding');
  if (root) root.hidden = true;
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch (_e) {
    // 失敗してもサイトは動く
  }
  if (onboardingResizeHandler) {
    window.removeEventListener('resize', onboardingResizeHandler);
    onboardingResizeHandler = null;
  }
}

function bindOnboardingEvents() {
  const next = document.getElementById('onboarding-next');
  const skip = document.getElementById('onboarding-skip');
  const overlay = document.getElementById('onboarding-overlay');
  const restart = document.getElementById('onboarding-restart');

  if (next) {
    next.addEventListener('click', () => {
      if (onboardingStepIndex >= ONBOARDING_STEPS.length - 1) {
        finishOnboarding();
        return;
      }
      onboardingStepIndex += 1;
      showOnboardingStep(onboardingStepIndex);
    });
  }
  if (skip) skip.addEventListener('click', finishOnboarding);
  if (overlay) overlay.addEventListener('click', finishOnboarding);
  if (restart) restart.addEventListener('click', () => startOnboarding(true));
}

/* ---------- ブートストラップ ---------- */

async function bootstrap() {
  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const main = document.getElementById('main-content');
  const tabNav = document.getElementById('category-tabs');
  const reloadBtn = document.getElementById('reload-btn');
  const resetBtn = document.getElementById('mindmap-reset');

  if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (currentMindmap) {
        currentMindmap.svg
          .transition()
          .duration(300)
          .call(currentMindmap.zoom.transform, d3.zoomIdentity);
      }
    });
  }

  bindOnboardingEvents();

  try {
    const data = await loadVideos();
    currentData = data;
    // 既定カテゴリが存在しない場合は最初のカテゴリにフォールバック
    if (!data.categories.find((c) => c.id === currentCategoryId)) {
      currentCategoryId = data.categories[0] && data.categories[0].id;
    }
    displayLastUpdated(data);
    if (loading) loading.hidden = true;
    if (tabNav) tabNav.hidden = false;
    if (main) main.hidden = false;
    renderTabs(data);
    renderForView(data);
    // メインコンテンツ描画後、初回訪問者にオンボーディング表示
    startOnboarding(false);
  } catch (err) {
    if (loading) loading.hidden = true;
    if (errorEl) errorEl.hidden = false;
    console.error('Failed to load videos.json:', err);
  }

  window.addEventListener('resize', () => {
    if (currentData) renderForView(currentData);
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatDuration, formatPublishedAt };
}
