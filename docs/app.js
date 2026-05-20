/* =========================================================================
   注文住宅YouTube動画マップ - Sprint 1 公開サイトJS
   - JSONロード（5秒タイムアウト）+ エラーUI
   - formatDuration: ISO 8601 → MM:SS / HH:MM:SS
   - 動画カード生成（XSS対策: textContent / DOM API のみ使用、innerHTML禁止）
   - モバイル：アコーディオン（300ms ease-in-out + stagger 50ms）
   - PC：D3.js カスタムツリーマインドマップ + サイドパネル
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

/* ---------- 動画カード生成（XSS対策：DOM API のみ） ---------- */

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

/* ---------- アコーディオン（モバイル） ---------- */

function toggleAccordion(button, content) {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  content.setAttribute('aria-hidden', String(expanded));
}

function buildAccordionHeader(label, count) {
  const btn = document.createElement('button');
  btn.className = 'acc-header';
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

function renderAccordion(data, container) {
  container.textContent = '';
  data.categories.forEach((cat) => {
    const catEl = document.createElement('section');
    catEl.className = 'acc-category';

    const catBtn = buildAccordionHeader(cat.name);
    catBtn.classList.add('acc-cat-header');
    catEl.appendChild(catBtn);

    const catContent = document.createElement('div');
    catContent.className = 'acc-content';
    catContent.setAttribute('aria-hidden', 'true');

    cat.genres.forEach((gnr) => {
      if (!gnr.videos || gnr.videos.length === 0) return;

      const gnrEl = document.createElement('div');
      gnrEl.className = 'acc-genre';

      const gnrBtn = buildAccordionHeader(gnr.name, gnr.videos.length);
      gnrBtn.classList.add('acc-genre-header');
      gnrEl.appendChild(gnrBtn);

      const gnrContent = document.createElement('div');
      gnrContent.className = 'acc-content video-list';
      gnrContent.setAttribute('aria-hidden', 'true');

      gnr.videos.forEach((video, i) => {
        const card = createVideoCard(video);
        card.style.setProperty('--idx', i);
        gnrContent.appendChild(card);
      });
      gnrEl.appendChild(gnrContent);

      gnrBtn.addEventListener('click', () => toggleAccordion(gnrBtn, gnrContent));
      catContent.appendChild(gnrEl);
    });

    catEl.appendChild(catContent);
    catBtn.addEventListener('click', () => toggleAccordion(catBtn, catContent));
    container.appendChild(catEl);
  });
}

/* ---------- D3.js マインドマップ（PC） ---------- */

function renderMindmap(data, container) {
  if (typeof d3 === 'undefined') {
    container.textContent = 'D3.js の読み込みに失敗しました。';
    return null;
  }

  container.textContent = '';
  const width = container.clientWidth || 800;
  const height = Math.max(container.clientHeight, 600);

  const hierarchyData = {
    name: 'ROOT',
    type: 'root',
    children: data.categories.map((cat) => ({
      name: cat.name,
      type: 'category',
      id: cat.id,
      children: cat.genres.map((gnr) => ({
        name: gnr.name,
        type: 'genre',
        id: gnr.id,
        categoryId: cat.id,
        videos: gnr.videos || [],
      })),
    })),
  };

  const root = d3.hierarchy(hierarchyData);
  const treeLayout = d3.tree().size([height - 80, width - 240]);
  treeLayout(root);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', 'translate(100, 40)');

  const zoom = d3
    .zoom()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

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

  node.append('circle').attr('r', 6);
  node
    .append('text')
    .attr('dx', 12)
    .attr('dy', '0.32em')
    .text((d) => d.data.name);

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

/* ---------- 環境分岐：ブラウザ実行 / Node.js テスト用エクスポート ---------- */

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
