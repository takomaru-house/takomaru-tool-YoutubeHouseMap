/* 管理画面（localhost）クライアントJS — プロトタイプ
   - XSS対策：すべて textContent / DOM API。innerHTML は使わない。
   - 全状態をシンプルに refresh で再描画
*/

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const api = {
  async getVideos() { return getJSON('/api/videos'); },
  async getCategories() { return getJSON('/api/categories'); },
  async getBlocklist() { return getJSON('/api/blocklist'); },
  async getDraft() {
    const res = await fetch('/api/draft');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async runBatch() { return postJSON('/api/batch'); },
  async approve() { return postJSON('/api/batch/approve'); },
  async reject() { return postJSON('/api/batch/reject'); },
  async addVideo(body) { return postJSON('/api/videos/add', body); },
  async deleteVideo(videoId, categoryId, groupId, genreId) {
    return fetchJSON(`/api/videos/${encodeURIComponent(videoId)}?categoryId=${encodeURIComponent(categoryId)}&groupId=${encodeURIComponent(groupId)}&genreId=${encodeURIComponent(genreId)}`, { method: 'DELETE' });
  },
  async reorderVideo(videoId, categoryId, groupId, genreId, direction) {
    return fetchJSON(`/api/videos/${encodeURIComponent(videoId)}/order?categoryId=${encodeURIComponent(categoryId)}&groupId=${encodeURIComponent(groupId)}&genreId=${encodeURIComponent(genreId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    });
  },
  async addBlocklist(type, id) { return postJSON('/api/blocklist', { type, id }); },
  async deleteBlocklist(type, id) {
    return fetchJSON(`/api/blocklist/${encodeURIComponent(id)}?type=${encodeURIComponent(type)}`, { method: 'DELETE' });
  },
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function postJSON(url, body) {
  const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetchJSON(url, opts);
}
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function showStatus(elId, message, level) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('ok', 'err');
  if (level) el.classList.add(level);
}

// YouTube URL から videoId 抽出
function extractVideoId(input) {
  const trimmed = (input || '').trim();
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  return null;
}

/* ---------- レンダリング ---------- */

function renderVideosList(data) {
  const container = document.getElementById('videos-list');
  container.textContent = '';
  for (const cat of data.categories || []) {
    const catBlock = document.createElement('div');
    catBlock.className = 'cat-block';
    const catTitle = document.createElement('div');
    catTitle.className = 'cat-title';
    catTitle.textContent = `${cat.name} (${cat.id})`;
    catBlock.appendChild(catTitle);

    for (const grp of cat.groups || []) {
      const grpBlock = document.createElement('div');
      grpBlock.className = 'grp-block';
      const grpTitle = document.createElement('div');
      grpTitle.className = 'grp-title';
      grpTitle.textContent = `▸ ${grp.name} (${grp.id})`;
      grpBlock.appendChild(grpTitle);

      for (const gnr of grp.genres || []) {
        const gnrBlock = document.createElement('div');
        gnrBlock.className = 'gnr-block';

        const gnrTitle = document.createElement('div');
        gnrTitle.className = 'gnr-title';
        const gnrName = document.createElement('span');
        gnrName.className = 'gnr-name';
        gnrName.textContent = `${gnr.name} (${gnr.id})`;
        gnrTitle.appendChild(gnrName);

        const count = (gnr.videos || []).length;
        const pill = document.createElement('span');
        pill.className = 'count-pill';
        if (count < 5) pill.classList.add('count-red');
        else if (count < 8) pill.classList.add('count-yellow');
        pill.textContent = `${count} 件`;
        gnrTitle.appendChild(pill);
        gnrBlock.appendChild(gnrTitle);

        for (const v of gnr.videos || []) {
          gnrBlock.appendChild(buildVideoRow(v, cat.id, grp.id, gnr.id));
        }
        grpBlock.appendChild(gnrBlock);
      }
      catBlock.appendChild(grpBlock);
    }
    container.appendChild(catBlock);
  }
}

function buildVideoRow(v, catId, groupId, gnrId) {
  const row = document.createElement('div');
  row.className = 'video-row';

  const id = document.createElement('span');
  id.className = 'vid-id';
  id.textContent = v.videoId;
  row.appendChild(id);

  const src = document.createElement('span');
  src.className = `vid-source ${v.source}`;
  src.textContent = v.source;
  row.appendChild(src);

  const title = document.createElement('span');
  title.className = 'vid-title';
  title.textContent = v.title;
  row.appendChild(title);

  if (v.status === 'dead') {
    const dead = document.createElement('span');
    dead.className = 'vid-status-dead';
    dead.textContent = 'dead';
    row.appendChild(dead);
  }

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.textContent = '↑';
  upBtn.addEventListener('click', () => reorderAndReload(v.videoId, catId, groupId, gnrId, 'up'));
  row.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.textContent = '↓';
  downBtn.addEventListener('click', () => reorderAndReload(v.videoId, catId, groupId, gnrId, 'down'));
  row.appendChild(downBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'danger';
  delBtn.textContent = '削除';
  delBtn.addEventListener('click', () => deleteAndReload(v.videoId, catId, groupId, gnrId));
  row.appendChild(delBtn);

  return row;
}

function renderBlocklist(bl) {
  const container = document.getElementById('blocklist-display');
  container.textContent = '';
  for (const [type, label, ids] of [
    ['channel', 'ブロック中チャンネルID', bl.blockedChannelIds || []],
    ['video', 'ブロック中videoID', bl.blockedVideoIds || []],
  ]) {
    const group = document.createElement('div');
    group.className = 'blocklist-group';
    const h = document.createElement('h3');
    h.textContent = label;
    group.appendChild(h);
    const ul = document.createElement('ul');
    if (ids.length === 0) {
      const li = document.createElement('li');
      li.textContent = '（なし）';
      ul.appendChild(li);
    } else {
      for (const id of ids) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = id;
        li.appendChild(span);
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '削除';
        rm.addEventListener('click', async () => {
          try {
            await api.deleteBlocklist(type, id);
            await reloadBlocklist();
          } catch (e) { alert(e.message); }
        });
        li.appendChild(rm);
        ul.appendChild(li);
      }
    }
    group.appendChild(ul);
    container.appendChild(group);
  }
}

async function populateCategorySelectors() {
  const cfg = await api.getCategories();
  const catSelect = document.getElementById('add-category');
  const grpSelect = document.getElementById('add-group');
  const gnrSelect = document.getElementById('add-genre');
  catSelect.textContent = '';
  for (const c of cfg.categories || []) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.id})`;
    catSelect.appendChild(opt);
  }
  const refreshGroups = () => {
    const cat = (cfg.categories || []).find((c) => c.id === catSelect.value);
    grpSelect.textContent = '';
    for (const g of (cat && cat.groups) || []) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.id})`;
      grpSelect.appendChild(opt);
    }
    refreshGenres();
  };
  const refreshGenres = () => {
    const cat = (cfg.categories || []).find((c) => c.id === catSelect.value);
    const grp = cat && (cat.groups || []).find((g) => g.id === grpSelect.value);
    gnrSelect.textContent = '';
    for (const g of (grp && grp.genres) || []) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.id})`;
      gnrSelect.appendChild(opt);
    }
  };
  catSelect.addEventListener('change', refreshGroups);
  grpSelect.addEventListener('change', refreshGenres);
  refreshGroups();
}

function renderDraftPreview(draft, current) {
  const container = document.getElementById('draft-preview');
  container.textContent = '';
  if (!draft) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = '現在 draft はありません。バッチを実行すると生成されます。';
    container.appendChild(p);
    return;
  }
  const summary = document.createElement('p');
  summary.className = 'draft-summary';
  const total = (draft.categories || []).reduce(
    (s, c) => s + c.genres.reduce((ss, g) => ss + g.videos.length, 0),
    0
  );
  summary.textContent = `draft 内 ${total} 件の auto 動画。承認するとマージされます（manual は保護）。`;
  container.appendChild(summary);

  const currentIds = new Set();
  for (const c of (current && current.categories) || []) {
    for (const grp of c.groups || []) {
      for (const g of grp.genres || []) {
        for (const v of g.videos || []) {
          if (v.source === 'auto') currentIds.add(v.videoId);
        }
      }
    }
  }

  const diff = document.createElement('div');
  diff.className = 'draft-diff';
  for (const c of draft.categories || []) {
    for (const grp of c.groups || []) {
      for (const g of grp.genres || []) {
        const ul = document.createElement('ul');
        let touched = false;
        for (const v of g.videos || []) {
          const li = document.createElement('li');
          if (!currentIds.has(v.videoId)) {
            li.className = 'diff-add';
            li.textContent = `[+ 新規] ${c.id}/${grp.id}/${g.id} ${v.videoId} ${v.title}`;
          } else {
            li.className = 'diff-change';
            li.textContent = `[更新] ${c.id}/${grp.id}/${g.id} ${v.videoId} ${v.title}`;
          }
          touched = true;
          ul.appendChild(li);
        }
        if (touched) diff.appendChild(ul);
      }
    }
  }
  container.appendChild(diff);
}

/* ---------- アクション ---------- */

async function reloadAll() {
  try {
    const [videos, cats, draft, blocklist] = await Promise.all([
      api.getVideos(),
      api.getCategories(),
      api.getDraft().catch(() => null),
      api.getBlocklist(),
    ]);
    renderVideosList(videos);
    renderBlocklist(blocklist);
    renderDraftPreview(draft, videos);
    await populateCategorySelectors();
  } catch (err) {
    showStatus('action-status', `読み込み失敗: ${err.message}`, 'err');
  }
}

async function reloadBlocklist() {
  const bl = await api.getBlocklist();
  renderBlocklist(bl);
}

async function reorderAndReload(videoId, catId, groupId, gnrId, direction) {
  try {
    await api.reorderVideo(videoId, catId, groupId, gnrId, direction);
    await reloadAll();
  } catch (e) { alert(e.message); }
}

async function deleteAndReload(videoId, catId, groupId, gnrId) {
  if (!confirm(`${videoId} を削除しますか？`)) return;
  try {
    await api.deleteVideo(videoId, catId, groupId, gnrId);
    await reloadAll();
  } catch (e) { alert(e.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-batch').addEventListener('click', async () => {
    showStatus('action-status', 'バッチ実行中... (数十秒)', '');
    try {
      const r = await api.runBatch();
      showStatus('action-status', `完了。件数不足ジャンル: ${r.insufficientGenres.length} 件 / 前回 manual 保護対象: ${r.prevManualCount} 件`, 'ok');
      await reloadAll();
    } catch (e) {
      showStatus('action-status', `失敗: ${e.message}`, 'err');
    }
  });

  document.getElementById('btn-approve').addEventListener('click', async () => {
    if (!confirm('draft を本番にマージしますか？')) return;
    try {
      await api.approve();
      showStatus('action-status', '承認しました。videos.json に反映済み。', 'ok');
      await reloadAll();
    } catch (e) {
      showStatus('action-status', `失敗: ${e.message}`, 'err');
    }
  });

  document.getElementById('btn-reject').addEventListener('click', async () => {
    if (!confirm('draft を破棄しますか？')) return;
    try {
      await api.reject();
      showStatus('action-status', '差し戻しました。draft を破棄。', 'ok');
      await reloadAll();
    } catch (e) {
      showStatus('action-status', `失敗: ${e.message}`, 'err');
    }
  });

  document.getElementById('add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const raw = document.getElementById('add-input').value;
    const videoId = extractVideoId(raw);
    if (!videoId) {
      showStatus('add-status', 'videoID の抽出に失敗。URL または 11文字IDを入力してください。', 'err');
      return;
    }
    const categoryId = document.getElementById('add-category').value;
    const groupId = document.getElementById('add-group').value;
    const genreId = document.getElementById('add-genre').value;
    try {
      await api.addVideo({ videoId, categoryId, groupId, genreId });
      showStatus('add-status', `追加成功: ${videoId}`, 'ok');
      document.getElementById('add-input').value = '';
      await reloadAll();
    } catch (e) {
      showStatus('add-status', `失敗: ${e.message}`, 'err');
    }
  });

  document.getElementById('block-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const type = document.getElementById('block-type').value;
    const id = document.getElementById('block-id').value.trim();
    if (!id) return;
    try {
      await api.addBlocklist(type, id);
      document.getElementById('block-id').value = '';
      await reloadBlocklist();
    } catch (e) { alert(e.message); }
  });

  reloadAll();
});
