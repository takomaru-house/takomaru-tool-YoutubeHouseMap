const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const request = require('supertest');
const nock = require('nock');

const { createServer } = require('../../src/admin/server');
const {
  YOUTUBE_API_BASE,
  YOUTUBE_API_PATH,
  makeVideosResponse,
  makeSearchResponse,
  makeChannelsResponse,
  makeVideoIds,
} = require('../mocks/youtube-api');

const SCHEMA_INIT_CATEGORIES = {
  globalSettings: {
    blockedChannelIds: ['UCblockedChan'],
    blockedVideoIds: ['blockedVid1'],
  },
  categories: [
    {
      id: 'CAT-01',
      name: '施主目線',
      order: 1,
      genres: [
        {
          id: 'GNR-01',
          name: '間取り',
          order: 1,
          searchQuery: 'q1',
          searchQueryAlt: 'q1alt',
        },
      ],
    },
  ],
};

const makeInitialVideos = () => ({
  meta: { last_updated: '2026-05-20', schema_version: '1.1' },
  categories: [
    {
      id: 'CAT-01',
      name: '施主目線',
      genres: [
        {
          id: 'GNR-01',
          name: '間取り',
          videos: [
            {
              videoId: 'existing001',
              title: 'existing 1',
              channelName: 'ch',
              thumbnailUrl: 'https://img.youtube.com/vi/existing001/hqdefault.jpg',
              publishedAt: '2025-01-01',
              duration: 'PT8M',
              tags: [],
              source: 'auto',
              status: 'active',
              order: 1,
            },
            {
              videoId: 'existing002',
              title: 'existing 2',
              channelName: 'ch',
              thumbnailUrl: 'https://img.youtube.com/vi/existing002/hqdefault.jpg',
              publishedAt: '2025-01-02',
              duration: 'PT9M',
              tags: [],
              source: 'auto',
              status: 'active',
              order: 2,
            },
          ],
        },
      ],
    },
  ],
});

let tmpDir;
let dataDir;
let logsDir;
let app;

const seed = async () => {
  await fs.writeFile(
    path.join(dataDir, 'categories.json'),
    JSON.stringify(SCHEMA_INIT_CATEGORIES),
    'utf-8'
  );
  await fs.writeFile(
    path.join(dataDir, 'videos.json'),
    JSON.stringify(makeInitialVideos()),
    'utf-8'
  );
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-api-'));
  dataDir = path.join(tmpDir, 'data');
  logsDir = path.join(tmpDir, 'logs');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await seed();
  app = createServer({
    dataDir,
    logsDir,
    apiKey: 'test-key',
    sleep: () => Promise.resolve(),
  });
});

afterEach(async () => {
  nock.cleanAll();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const readVideosJson = async () =>
  JSON.parse(await fs.readFile(path.join(dataDir, 'videos.json'), 'utf-8'));

describe('IT-04: 管理 API エンドポイント', () => {
  test('IT-04-01: GET /api/videos でカテゴリ一覧（videos.json）が取得できる', async () => {
    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].id).toBe('CAT-01');
    expect(res.body.categories[0].genres[0].videos.length).toBe(2);
  });

  test('IT-04-02: POST /api/videos/add で manual 動画が追加される（201）', async () => {
    // YouTube API で動画詳細を取得（nock モック）
    const videoId = 'newManual01';
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosResponse([videoId], { duration: 'PT7M', viewCount: 1000 }));

    const res = await request(app)
      .post('/api/videos/add')
      .send({ videoId, categoryId: 'CAT-01', genreId: 'GNR-01' });

    expect(res.status).toBe(201);
    const stored = await readVideosJson();
    const added = stored.categories[0].genres[0].videos.find((v) => v.videoId === videoId);
    expect(added).toBeDefined();
    expect(added.source).toBe('manual');
    expect(added.tags).toContain('manual');
  });

  test('IT-04-03: DELETE /api/videos/:id で動画が削除される（200）', async () => {
    const res = await request(app)
      .delete('/api/videos/existing001')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' });
    expect(res.status).toBe(200);

    const stored = await readVideosJson();
    const remaining = stored.categories[0].genres[0].videos.map((v) => v.videoId);
    expect(remaining).not.toContain('existing001');
  });

  test('IT-04-04: PUT /api/videos/:id/order で順序が変更される（200）', async () => {
    // existing001 (order:1) を down へ
    const res = await request(app)
      .put('/api/videos/existing001/order')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' })
      .send({ direction: 'down' });
    expect(res.status).toBe(200);

    const stored = await readVideosJson();
    const videos = stored.categories[0].genres[0].videos;
    expect(videos[0].videoId).toBe('existing002');
    expect(videos[1].videoId).toBe('existing001');
  });

  test('IT-04-05: 不正な videoId の追加は 400 を返す', async () => {
    const res = await request(app)
      .post('/api/videos/add')
      .send({ videoId: 'short', categoryId: 'CAT-01', genreId: 'GNR-01' });
    expect(res.status).toBe(400);
  });

  test('IT-04-06: POST /api/batch でバッチが起動し draft が生成される（202）', async () => {
    const ids = makeVideoIds('btc', 5);
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(200, makeSearchResponse(ids));
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosResponse(ids));
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/channels`)
      .query(true)
      .reply(
        200,
        makeChannelsResponse(
          ids.map((v) => `UC${v}_chan`.slice(0, 24)),
          { subscriberCount: 10000 }
        )
      );

    const res = await request(app).post('/api/batch');
    expect(res.status).toBe(202);

    const draftPath = path.join(dataDir, 'videos.draft.json');
    const stat = await fs.stat(draftPath);
    expect(stat.isFile()).toBe(true);
  });

  test('IT-04-07: POST /api/batch/approve で draft がマージされ draft が削除される', async () => {
    const draft = {
      meta: { last_updated: '2026-05-21', schema_version: '1.1' },
      categories: [
        {
          id: 'CAT-01',
          name: '施主目線',
          genres: [
            {
              id: 'GNR-01',
              name: '間取り',
              videos: [
                {
                  videoId: 'fromDraft01',
                  title: 'from draft',
                  channelName: 'ch',
                  thumbnailUrl: 'https://img.youtube.com/vi/fromDraft01/hqdefault.jpg',
                  publishedAt: '2025-04-01',
                  duration: 'PT12M',
                  tags: [],
                  source: 'auto',
                  status: 'active',
                  order: 1,
                },
              ],
            },
          ],
        },
      ],
    };
    await fs.writeFile(
      path.join(dataDir, 'videos.draft.json'),
      JSON.stringify(draft),
      'utf-8'
    );

    const res = await request(app).post('/api/batch/approve');
    expect(res.status).toBe(200);

    const stored = await readVideosJson();
    const ids = stored.categories[0].genres[0].videos.map((v) => v.videoId);
    expect(ids).toContain('fromDraft01');

    // draft 削除確認
    await expect(fs.access(path.join(dataDir, 'videos.draft.json'))).rejects.toThrow();
  });

  test('IT-04-08: POST /api/batch/reject で draft が破棄され videos.json は変更されない', async () => {
    await fs.writeFile(
      path.join(dataDir, 'videos.draft.json'),
      JSON.stringify({ categories: [] }),
      'utf-8'
    );
    const before = await readVideosJson();

    const res = await request(app).post('/api/batch/reject');
    expect(res.status).toBe(200);

    await expect(fs.access(path.join(dataDir, 'videos.draft.json'))).rejects.toThrow();
    const after = await readVideosJson();
    expect(after).toEqual(before);
  });

  test('IT-04-09: GET /api/blocklist でブロックリストが取得できる（200）', async () => {
    const res = await request(app).get('/api/blocklist');
    expect(res.status).toBe(200);
    expect(res.body.blockedChannelIds).toContain('UCblockedChan');
    expect(res.body.blockedVideoIds).toContain('blockedVid1');
  });

  test('IT-04-10: POST /api/blocklist でチャンネルIDが追加される（201）', async () => {
    const res = await request(app)
      .post('/api/blocklist')
      .send({ type: 'channel', id: 'UCnewChannelXyz' });
    expect(res.status).toBe(201);

    const cfg = JSON.parse(
      await fs.readFile(path.join(dataDir, 'categories.json'), 'utf-8')
    );
    expect(cfg.globalSettings.blockedChannelIds).toContain('UCnewChannelXyz');
  });

  test('IT-04-11: DELETE /api/blocklist/:id で ID が削除される（200）', async () => {
    const res = await request(app)
      .delete('/api/blocklist/UCblockedChan')
      .query({ type: 'channel' });
    expect(res.status).toBe(200);

    const cfg = JSON.parse(
      await fs.readFile(path.join(dataDir, 'categories.json'), 'utf-8')
    );
    expect(cfg.globalSettings.blockedChannelIds).not.toContain('UCblockedChan');
  });
});

describe('IT-04 拡張: 負シナリオとバリデーション', () => {
  test('IT-04-12: 存在しない videoId の DELETE は 404', async () => {
    const res = await request(app)
      .delete('/api/videos/notExistAAA')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' });
    expect(res.status).toBe(404);
  });

  test('IT-04-13: 存在しない category/genre の DELETE は 404', async () => {
    const res = await request(app)
      .delete('/api/videos/existing001')
      .query({ categoryId: 'CAT-99', genreId: 'GNR-99' });
    expect(res.status).toBe(404);
  });

  test('IT-04-14: PUT order で direction 欠落は 400', async () => {
    const res = await request(app)
      .put('/api/videos/existing001/order')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' })
      .send({});
    expect(res.status).toBe(400);
  });

  test('IT-04-15: PUT order で先頭動画を up すると unchanged', async () => {
    const res = await request(app)
      .put('/api/videos/existing001/order')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' })
      .send({ direction: 'up' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unchanged');
  });

  test('IT-04-16: PUT order で存在しない videoId は 404', async () => {
    const res = await request(app)
      .put('/api/videos/notExistAAA/order')
      .query({ categoryId: 'CAT-01', genreId: 'GNR-01' })
      .send({ direction: 'up' });
    expect(res.status).toBe(404);
  });

  test('IT-04-17: POST add で存在しない category/genre は 404', async () => {
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosResponse(['validVid001']));
    const res = await request(app)
      .post('/api/videos/add')
      .send({ videoId: 'validVid001', categoryId: 'CAT-99', genreId: 'GNR-99' });
    expect(res.status).toBe(404);
  });

  test('IT-04-18: POST blocklist で type 不正は 400', async () => {
    const res = await request(app).post('/api/blocklist').send({ type: 'unknown', id: 'x' });
    expect(res.status).toBe(400);
  });

  test('IT-04-19: POST blocklist で id 欠落は 400', async () => {
    const res = await request(app).post('/api/blocklist').send({ type: 'channel' });
    expect(res.status).toBe(400);
  });

  test('IT-04-20: DELETE blocklist で type 欠落は 400', async () => {
    const res = await request(app).delete('/api/blocklist/anything');
    expect(res.status).toBe(400);
  });

  test('IT-04-21: GET /api/draft で draft が無いとき 404', async () => {
    const res = await request(app).get('/api/draft');
    expect(res.status).toBe(404);
  });

  test('IT-04-22: GET /api/categories で categories.json が返る', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories[0].id).toBe('CAT-01');
  });
});

describe('NS-010: localhost 制限', () => {
  test('NS-010-01: 外部 Host ヘッダからのアクセスは 403 を返す', async () => {
    const res = await request(app)
      .get('/api/videos')
      .set('Host', '192.168.1.100:3000');
    expect(res.status).toBe(403);
  });

  test('NS-010-02: localhost からのアクセスは許可される', async () => {
    const res = await request(app)
      .get('/api/videos')
      .set('Host', '127.0.0.1:3000');
    expect(res.status).toBe(200);
  });
});
