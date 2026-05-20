// 管理 Web サーバ（localhost 限定）
// - 127.0.0.1 バインド + Host ヘッダ検証ミドルウェアの二重防衛
// - 11 エンドポイント：videos / batch / blocklist
// - createServer() ファクトリで supertest テストに直接渡せる

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const { writeJsonAtomic } = require('../utils/fileUtils');
const { validateVideoId } = require('../utils/validation');
const { fetchVideoDetails } = require('../batch/fetch');
const { runBatch } = require('../batch');
const { mergeDraft } = require('./merge');

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const readJSON = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
};

const unlinkIfExists = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
};

const reorderVideos = (videos) => videos.map((v, i) => ({ ...v, order: i + 1 }));

// async ルートハンドラを Express の next(err) へ簡潔に橋渡しするヘルパー
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const createServer = (options = {}) => {
  const projectRoot = path.join(__dirname, '..', '..');
  const {
    dataDir = path.join(projectRoot, 'data'),
    logsDir = path.join(projectRoot, 'logs'),
    apiKey = process.env.YOUTUBE_API_KEY,
    sleep,
  } = options;

  const videosPath = path.join(dataDir, 'videos.json');
  const categoriesPath = path.join(dataDir, 'categories.json');
  const draftPath = path.join(dataDir, 'videos.draft.json');

  const app = express();
  app.use(express.json());

  // NS-010: Host ヘッダ検証（L7 防衛）
  app.use((req, res, next) => {
    const host = req.hostname;
    if (!ALLOWED_HOSTS.has(host)) {
      return res.status(403).json({ error: 'forbidden: localhost only' });
    }
    next();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  // ---- /api/videos ----

  app.get('/api/videos', asyncH(async (_req, res) => {
    const data = await readJSON(videosPath);
    res.json(data);
  }));

  app.post('/api/videos/add', asyncH(async (req, res) => {
    const { videoId, categoryId, genreId } = req.body || {};
    if (!validateVideoId(videoId)) {
      return res.status(400).json({ error: 'invalid videoId' });
    }
    const details = await fetchVideoDetails([videoId], { apiKey, sleep });
    if (details.length === 0) {
      return res.status(404).json({ error: 'video not found' });
    }
    const d = details[0];
    const publishedAtIso = d.publishedAt || '';
    const newVideo = {
      videoId,
      title: d.title || '',
      channelName: d.channelTitle || '',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: publishedAtIso.split('T')[0] || '',
      duration: d.duration || '',
      tags: ['manual'],
      source: 'manual',
      status: 'active',
      order: 0,
    };

    const data = await readJSON(videosPath);
    const cat = (data.categories || []).find((c) => c.id === categoryId);
    const gnr = cat && (cat.genres || []).find((g) => g.id === genreId);
    if (!gnr) return res.status(404).json({ error: 'category/genre not found' });

    gnr.videos = reorderVideos([...gnr.videos, newVideo]);
    await writeJsonAtomic(videosPath, data);
    res.status(201).json({ videoId });
  }));

  app.delete('/api/videos/:id', asyncH(async (req, res) => {
    const { id } = req.params;
    const { categoryId, genreId } = req.query;
    const data = await readJSON(videosPath);
    const cat = (data.categories || []).find((c) => c.id === categoryId);
    const gnr = cat && (cat.genres || []).find((g) => g.id === genreId);
    if (!gnr) return res.status(404).json({ error: 'category/genre not found' });
    const before = gnr.videos.length;
    gnr.videos = reorderVideos(gnr.videos.filter((v) => v.videoId !== id));
    if (gnr.videos.length === before) {
      return res.status(404).json({ error: 'video not found' });
    }
    await writeJsonAtomic(videosPath, data);
    res.json({ status: 'deleted' });
  }));

  app.put('/api/videos/:id/order', asyncH(async (req, res) => {
    const { id } = req.params;
    const { categoryId, genreId } = req.query;
    const { direction } = req.body || {};
    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ error: 'direction must be up or down' });
    }
    const data = await readJSON(videosPath);
    const cat = (data.categories || []).find((c) => c.id === categoryId);
    const gnr = cat && (cat.genres || []).find((g) => g.id === genreId);
    if (!gnr) return res.status(404).json({ error: 'category/genre not found' });
    const idx = gnr.videos.findIndex((v) => v.videoId === id);
    if (idx < 0) return res.status(404).json({ error: 'video not found' });
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= gnr.videos.length) {
      return res.status(200).json({ status: 'unchanged' });
    }
    const next = [...gnr.videos];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    gnr.videos = reorderVideos(next);
    await writeJsonAtomic(videosPath, data);
    res.json({ status: 'reordered' });
  }));

  // ---- /api/batch ----

  app.post('/api/batch', asyncH(async (_req, res) => {
    const result = await runBatch({
      categoriesPath,
      prevVideosPath: videosPath,
      draftPath,
      apiKey,
      sleep,
    });
    res.status(202).json(result);
  }));

  app.post('/api/batch/approve', asyncH(async (_req, res) => {
    const prev = await readJSON(videosPath);
    const draft = await readJSON(draftPath);
    const merged = mergeDraft(prev, draft);
    await writeJsonAtomic(videosPath, merged);
    await unlinkIfExists(draftPath);
    res.json({ status: 'merged' });
  }));

  app.get('/api/draft', asyncH(async (_req, res) => {
    try {
      const draft = await readJSON(draftPath);
      res.json(draft);
    } catch (err) {
      /* istanbul ignore else : 想定外エラーは共通ハンドラへ */
      if (err && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'no draft' });
      }
      throw err;
    }
  }));

  app.post('/api/batch/reject', asyncH(async (_req, res) => {
    await unlinkIfExists(draftPath);
    res.json({ status: 'rejected' });
  }));

  // ---- /api/blocklist ----

  app.get('/api/blocklist', asyncH(async (_req, res) => {
    const cfg = await readJSON(categoriesPath);
    res.json(cfg.globalSettings || { blockedChannelIds: [], blockedVideoIds: [] });
  }));

  app.post('/api/blocklist', asyncH(async (req, res) => {
    const { type, id } = req.body || {};
    if (type !== 'channel' && type !== 'video') {
      return res.status(400).json({ error: 'type must be channel or video' });
    }
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'id is required' });
    }
    const cfg = await readJSON(categoriesPath);
    cfg.globalSettings = cfg.globalSettings || { blockedChannelIds: [], blockedVideoIds: [] };
    const key = type === 'channel' ? 'blockedChannelIds' : 'blockedVideoIds';
    cfg.globalSettings[key] = cfg.globalSettings[key] || [];
    if (!cfg.globalSettings[key].includes(id)) {
      cfg.globalSettings[key].push(id);
    }
    await writeJsonAtomic(categoriesPath, cfg);
    res.status(201).json({ status: 'added' });
  }));

  app.delete('/api/blocklist/:id', asyncH(async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;
    if (type !== 'channel' && type !== 'video') {
      return res.status(400).json({ error: 'type query must be channel or video' });
    }
    const cfg = await readJSON(categoriesPath);
    const key = type === 'channel' ? 'blockedChannelIds' : 'blockedVideoIds';
    cfg.globalSettings = cfg.globalSettings || {};
    cfg.globalSettings[key] = (cfg.globalSettings[key] || []).filter((x) => x !== id);
    await writeJsonAtomic(categoriesPath, cfg);
    res.json({ status: 'deleted' });
  }));

  // ---- /api/categories (UI 用：カテゴリ・ジャンル定義) ----
  app.get('/api/categories', asyncH(async (_req, res) => {
    const cfg = await readJSON(categoriesPath);
    res.json(cfg);
  }));

  // 共通エラーハンドラ
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error('admin api error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  });

  return app;
};

/* istanbul ignore next : CLI 起動。テストは createServer をsupertest経由で呼ぶ */
const startServer = (port) => {
  const app = createServer();
  const listenPort = port || parseInt(process.env.ADMIN_PORT || '3000', 10);
  app.listen(listenPort, '127.0.0.1', () => {
    console.log(`Admin server running at http://127.0.0.1:${listenPort}`);
  });
};

/* istanbul ignore if : CLI 起動。テストは createServer をsupertest経由で呼ぶ */
if (require.main === module) {
  startServer();
}

module.exports = { createServer, startServer };
