/* =========================================================================
   注文住宅YouTube動画マップ - Sprint 4.5 公開サイトJS（schema v1.2 3階層）
   - JSONロード（5秒タイムアウト）+ エラーUI
   - formatDuration: ISO 8601 → MM:SS / HH:MM:SS
   - 動画カード生成（XSS対策: textContent / DOM API のみ、innerHTML不使用）
   - モバイル：アコーディオン 3階層（カテゴリ → グループ → ジャンル → 動画）
   - PC：D3.js カスタムツリーマインドマップ（ROOT 中央、CAT-02 左、CAT-01 右）+ サイドパネル
   - 768px ブレークポイント切替
   ========================================================================= */

const VIDEOS_JSON_URL = './data/videos.json';
const TIMEOUT_MS = 5000;
const BREAKPOINT_PX = 768;

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

/* ---------- アコーディオン（モバイル）3階層 ---------- */

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

function renderAccordion(data, container) {
  container.textContent = '';
  data.categories.forEach((cat) => {
    const catEl = document.createElement('section');
    catEl.className = 'acc-category';

    const catBtn = buildAccordionHeader(cat.name, undefined, 'acc-cat-header');
    catEl.appendChild(catBtn);

    const catContent = buildAccordionContent();
    (cat.groups || []).forEach((grp) => {
      const totalInGroup = (grp.genres || []).reduce(
        (s, gn) => s + ((gn.videos && gn.videos.length) || 0),
        0
      );
      if (totalInGroup === 0) return;

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
      catContent.appendChild(grpEl);
    });

    catEl.appendChild(catContent);
    catBtn.addEventListener('click', () => toggleAccordion(catBtn, catContent));
    container.appendChild(catEl);
  });
}

/* ---------- D3.js マインドマップ（PC、左右分割 3階層） ---------- */

function buildHierarchy(data) {
  return {
    name: '',
    type: 'root',
    children: (data.categories || []).map((cat) => ({
      name: cat.name,
      type: 'category',
      id: cat.id,
      side: cat.side || (cat.id === 'CAT-02' ? 'left' : 'right'),
      children: (cat.groups || []).map((grp) => ({
        name: grp.name,
        type: 'group',
        id: grp.id,
        side: cat.side,
        children: (grp.genres || []).map((gnr) => ({
          name: gnr.name,
          type: 'genre',
          id: gnr.id,
          side: cat.side,
          categoryId: cat.id,
          groupId: grp.id,
          videos: gnr.videos || [],
        })),
      })),
    })),
  };
}

function renderMindmap(data, container) {
  if (typeof d3 === 'undefined') {
    container.textContent = 'D3.js の読み込みに失敗しました。';
    return null;
  }
  container.textContent = '';

  const width = container.clientWidth || 1000;
  const height = Math.max(container.clientHeight, 700);
  const halfWidth = width / 2;
  const treeHeight = height - 80;
  const treeReach = halfWidth - 80; // 中央から左右への展開幅

  const root = d3.hierarchy(buildHierarchy(data));
  // tree layout: x=兄弟方向（縦）、y=深さ方向（横） → 中央が 0
  d3.tree().size([treeHeight, treeReach])(root);

  // 'left' は y を反転して左方向へ
  root.descendants().forEach((d) => {
    if (d.data && d.data.side === 'left') {
      d.y = -d.y;
    }
  });

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `${-halfWidth} 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(0, 40)`);

  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  // リンク描画（水平リンク）
  g.selectAll('path.link')
    .data(root.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x));

  const node = g
    .selectAll('g.node')
    .data(root.descendants())
    .enter()
    .append('g')
    .attr('class', (d) => `node node-${d.data.type || 'root'}`)
    .attr('transform', (d) => `translate(${d.y}, ${d.x})`);

  node.append('circle').attr('r', (d) => (d.data.type === 'root' ? 4 : 6));
  node
    .append('text')
    .attr('dx', (d) => (d.data.side === 'left' ? -12 : 12))
    .attr('text-anchor', (d) => (d.data.side === 'left' ? 'end' : 'start'))
    .attr('dy', '0.32em')
    .text((d) => d.data.name);

  // ジャンルノードクリックでサイドパネル
  node
    .filter((d) => d.data.type === 'genre')
    .on('click', (_event, d) => {
      showSidePanel(d.data);
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

/* ---------- ビュー切替 ---------- */

let currentView = null;
let currentData = null;
let currentMindmap = null;

function determineView() {
  return window.matchMedia(`(min-width: ${BREAKPOINT_PX}px)`).matches ? 'pc' : 'mobile';
}

function renderForView(data) {
  const view = determineView();
  if (view === currentView) return;
  currentView = view;

  if (view === 'pc') {
    currentMindmap = renderMindmap(data, document.getElementById('mindmap'));
  } else {
    renderAccordion(data, document.getElementById('accordion'));
  }
}

function displayLastUpdated(data) {
  if (!data.meta || !data.meta.last_updated) return;
  const el = document.getElementById('last-updated');
  if (!el) return;
  el.textContent = `最終更新日：${formatPublishedAt(data.meta.last_updated)}`;
}

/* ---------- ブートストラップ ---------- */

async function bootstrap() {
  const loading = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const main = document.getElementById('main-content');
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

  try {
    const data = await loadVideos();
    currentData = data;
    displayLastUpdated(data);
    if (loading) loading.hidden = true;
    if (main) main.hidden = false;
    renderForView(data);
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
