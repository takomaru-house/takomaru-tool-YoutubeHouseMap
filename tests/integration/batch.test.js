const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const nock = require('nock');

const { runBatch } = require('../../src/batch');
const {
  YOUTUBE_API_BASE,
  YOUTUBE_API_PATH,
  makeSearchResponse,
  makeVideosResponse,
  makeChannelsResponse,
  makeVideoIds,
  daysAgo,
} = require('../mocks/youtube-api');

// テスト用最小 categories.json（1カテゴリ×1グループ×1ジャンル）を生成
const minimalCategories = (extra = {}) => ({
  globalSettings: {
    blockedChannelIds: [],
    blockedVideoIds: [],
    ...extra.globalSettings,
  },
  categories: [
    {
      id: 'CAT-01',
      name: '施主目線',
      order: 1,
      side: 'right',
      groups: [
        {
          id: 'GRP-A',
          name: '計画・間取り',
          order: 1,
          genres: [
            {
              id: 'GNR-01',
              name: '間取り',
              order: 1,
              searchQuery: '注文住宅 間取り 施主 体験談',
              searchQueryAlt: '注文住宅 間取り 失敗 後悔',
            },
          ],
        },
      ],
    },
  ],
});

const emptyPrev = {
  meta: { last_updated: '2026-01-01', schema_version: '1.2' },
  categories: [
    {
      id: 'CAT-01',
      name: '施主目線',
      groups: [
        {
          id: 'GRP-A',
          name: '計画・間取り',
          genres: [{ id: 'GNR-01', name: '間取り', videos: [] }],
        },
      ],
    },
  ],
};

const makeLogger = () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

let tmpDir;
let logger;
let sleepFn;
let sleepCalls;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-test-'));
  logger = makeLogger();
  sleepCalls = [];
  sleepFn = jest.fn((ms) => {
    sleepCalls.push(ms);
    return Promise.resolve();
  });
});

afterEach(async () => {
  nock.cleanAll();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const writeCategoriesJson = async (data) => {
  const p = path.join(tmpDir, 'categories.json');
  await fs.writeFile(p, JSON.stringify(data), 'utf-8');
  return p;
};

const writePrevVideosJson = async (data) => {
  const p = path.join(tmpDir, 'videos.json');
  await fs.writeFile(p, JSON.stringify(data), 'utf-8');
  return p;
};

// videos.list / channels.list はリクエストの id クエリで指定されたものだけ返す
// （実 API の挙動に近づけ、IT-01-04 のブロックリスト検証を可能にする）
const replyVideosByRequestedIds = (defaultOptions = {}) =>
  function (uri) {
    const url = new URL(uri, YOUTUBE_API_BASE);
    const idParam = url.searchParams.get('id') || '';
    const ids = idParam.split(',').filter(Boolean);
    return [
      200,
      makeVideosResponse(ids, {
        duration: 'PT12M30S',
        viewCount: 5000,
        ...defaultOptions,
      }),
    ];
  };

const replyChannelsByRequestedIds = (defaultOptions = {}) =>
  function (uri) {
    const url = new URL(uri, YOUTUBE_API_BASE);
    const idParam = url.searchParams.get('id') || '';
    const ids = idParam.split(',').filter(Boolean);
    return [
      200,
      makeChannelsResponse(ids, { subscriberCount: 10000, ...defaultOptions }),
    ];
  };

const setupNormalApiMocks = (videoCount = 10, options = {}) => {
  const ids = makeVideoIds('vid', videoCount);
  nock(YOUTUBE_API_BASE)
    .persist()
    .get(`${YOUTUBE_API_PATH}/search`)
    .query(true)
    .reply(200, makeSearchResponse(ids));
  nock(YOUTUBE_API_BASE)
    .persist()
    .get(`${YOUTUBE_API_PATH}/videos`)
    .query(true)
    .reply(replyVideosByRequestedIds(options));
  nock(YOUTUBE_API_BASE)
    .persist()
    .get(`${YOUTUBE_API_PATH}/channels`)
    .query(true)
    .reply(replyChannelsByRequestedIds(options));
  return ids;
};

describe('IT-01: バッチフロー統合テスト', () => {
  test('IT-01-01: バッチ実行後に videos.draft.json が生成される', async () => {
    setupNormalApiMocks(10);
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const stat = await fs.stat(draftPath);
    expect(stat.isFile()).toBe(true);
  });

  test('IT-01-02: draft のスキーマが videos.json と一致する（v1.2 3階層）', async () => {
    setupNormalApiMocks(10);
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    expect(draft).toHaveProperty('meta.schema_version', '1.2');
    expect(draft).toHaveProperty('meta.last_updated');
    expect(Array.isArray(draft.categories)).toBe(true);
    const v = draft.categories[0].groups[0].genres[0].videos[0];
    expect(v).toMatchObject({
      title: expect.any(String),
      channelName: expect.any(String),
      thumbnailUrl: expect.stringMatching(/^https:\/\/img\.youtube\.com\/vi\/.+\/hqdefault\.jpg$/),
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      duration: expect.stringMatching(/^PT/),
      tags: expect.any(Array),
      source: 'auto',
      status: 'active',
      order: expect.any(Number),
    });
    expect(v).toHaveProperty('videoId');
    expect(v.videoId).toMatch(/^[a-zA-Z0-9_-]{11}$/);
    expect(v).not.toHaveProperty('_tempApiData');
  });

  test('IT-01-03: manual 動画は draft に混入しない（前回 videos.json に manual があっても）', async () => {
    setupNormalApiMocks(10);
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevWithManual = {
      ...emptyPrev,
      categories: [
        {
          id: 'CAT-01',
          name: '施主目線',
          groups: [
            {
              id: 'GRP-A',
              name: '計画・間取り',
              genres: [
                {
                  id: 'GNR-01',
                  name: '間取り',
                  videos: [
                    {
                      videoId: 'manualxxxxx',
                      title: 'manual video',
                      channelName: 'ch',
                      thumbnailUrl: 'https://img.youtube.com/vi/manualxxxxx/hqdefault.jpg',
                      publishedAt: '2025-01-01',
                      duration: 'PT5M',
                      tags: ['manual'],
                      source: 'manual',
                      status: 'active',
                      order: 1,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const prevPath = await writePrevVideosJson(prevWithManual);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    const allVideos = draft.categories.flatMap((c) =>
      (c.groups || []).flatMap((g) => (g.genres || []).flatMap((gn) => gn.videos))
    );
    expect(allVideos.every((v) => v.source === 'auto')).toBe(true);
    expect(allVideos.some((v) => v.videoId === 'manualxxxxx')).toBe(false);
  });

  test('IT-01-04: ブロックリスト対象動画は draft から除外される', async () => {
    const ids = setupNormalApiMocks(10);
    const blockedVideoId = ids[0];
    const cats = minimalCategories({
      globalSettings: { blockedVideoIds: [blockedVideoId], blockedChannelIds: [] },
    });
    const categoriesPath = await writeCategoriesJson(cats);
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    const allVideoIds = draft.categories.flatMap((c) =>
      (c.groups || []).flatMap((g) => (g.genres || []).flatMap((gn) => gn.videos.map((v) => v.videoId)))
    );
    expect(allVideoIds).not.toContain(blockedVideoId);
  });

  test('IT-01-05: 8件未満のジャンルは件数不足としてログに出力される', async () => {
    // 3件のみ返却（searchQueryAlt も 3件で合計 6 件 → dedup後も 8件未満）
    setupNormalApiMocks(3);
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const warnCalls = logger.warn.mock.calls.flat().join(' ');
    expect(warnCalls).toMatch(/件数不足|不足|insufficient/i);
    expect(warnCalls).toMatch(/CAT-01|GRP-A|GNR-01/);
  });

  test('IT-01-06: 前回 videos.json の manual 動画件数がログに記録される（補完データとして認識）', async () => {
    setupNormalApiMocks(10);
    const prevWithManual = {
      ...emptyPrev,
      categories: [
        {
          id: 'CAT-01',
          name: '施主目線',
          groups: [
            {
              id: 'GRP-A',
              name: '計画・間取り',
              genres: [
                {
                  id: 'GNR-01',
                  name: '間取り',
                  videos: [
                    {
                      videoId: 'manualAAAAA',
                      title: 'M1',
                      channelName: 'c',
                      thumbnailUrl: 'https://img.youtube.com/vi/manualAAAAA/hqdefault.jpg',
                      publishedAt: '2025-01-01',
                      duration: 'PT5M',
                      tags: ['manual'],
                      source: 'manual',
                      status: 'active',
                      order: 1,
                    },
                    {
                      videoId: 'manualBBBBB',
                      title: 'M2',
                      channelName: 'c',
                      thumbnailUrl: 'https://img.youtube.com/vi/manualBBBBB/hqdefault.jpg',
                      publishedAt: '2025-01-01',
                      duration: 'PT5M',
                      tags: ['manual'],
                      source: 'manual',
                      status: 'active',
                      order: 2,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(prevWithManual);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    const result = await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    expect(result.prevManualCount).toBe(2);
    const logMessages = logger.log.mock.calls.flat().join(' ');
    expect(logMessages).toMatch(/manual.*2/i);
  });

  test('IT-01-07: API が 503 を返した場合に最大3回リトライする（計4回試行）', async () => {
    const ids = makeVideoIds('vid', 5);
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .times(3)
      .reply(503);
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(200, makeSearchResponse(ids));
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(replyVideosByRequestedIds());
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/channels`)
      .query(true)
      .reply(replyChannelsByRequestedIds());

    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    expect(draft.categories[0].groups[0].genres[0].videos.length).toBeGreaterThan(0);
    // 3回の sleep（3回のリトライ間隔）が発生
    expect(sleepCalls.length).toBeGreaterThanOrEqual(3);
  });

  test('IT-01-09: fetchForGenre が失敗した場合に空ジャンルとして処理される（バッチ全体は失敗しない）', async () => {
    // search が最大リトライ後も常に 503
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(503);

    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await expect(
      runBatch({
        categoriesPath,
        prevVideosPath: prevPath,
        draftPath,
        apiKey: 'test-key',
        logger,
        sleep: sleepFn,
      })
    ).resolves.toBeDefined();

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    expect(draft.categories[0].groups[0].genres[0].videos).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  test('IT-01-10: 件数不足時に前回 auto 動画から補完される', async () => {
    const newIds = makeVideoIds('vid', 3);
    // メインで 3件 → 8件未満 → alt 呼ばれる → alt は空（重複しない動画なし）
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(200, makeSearchResponse(newIds));
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(200, makeSearchResponse([]));
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(replyVideosByRequestedIds());
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/channels`)
      .query(true)
      .reply(replyChannelsByRequestedIds());

    const prevWithAuto = {
      ...emptyPrev,
      categories: [
        {
          id: 'CAT-01',
          name: '施主目線',
          groups: [
            {
              id: 'GRP-A',
              name: '計画・間取り',
              genres: [
                {
                  id: 'GNR-01',
                  name: '間取り',
                  videos: [
                    {
                      videoId: 'prevAUTO001',
                      title: 'prev auto 1',
                      channelName: 'c',
                      thumbnailUrl: 'https://img.youtube.com/vi/prevAUTO001/hqdefault.jpg',
                      publishedAt: '2025-01-01',
                      duration: 'PT5M',
                      tags: [],
                      source: 'auto',
                      status: 'active',
                      order: 1,
                    },
                    {
                      videoId: 'prevAUTO002',
                      title: 'prev auto 2',
                      channelName: 'c',
                      thumbnailUrl: 'https://img.youtube.com/vi/prevAUTO002/hqdefault.jpg',
                      publishedAt: '2025-01-01',
                      duration: 'PT5M',
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
        },
      ],
    };
    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(prevWithAuto);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    const draft = JSON.parse(await fs.readFile(draftPath, 'utf-8'));
    const draftIds = draft.categories[0].groups[0].genres[0].videos.map((v) => v.videoId);
    expect(draftIds).toContain('prevAUTO001');
    expect(draftIds).toContain('prevAUTO002');
    expect(draftIds.length).toBe(5); // 3 新規 + 2 前回 auto
  });

  test('IT-01-08: リトライ待機時間が指数バックオフ（1s/2s/4s）である', async () => {
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .times(3)
      .reply(503);
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/search`)
      .query(true)
      .reply(200, makeSearchResponse(makeVideoIds('vid', 5)));
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(replyVideosByRequestedIds());
    nock(YOUTUBE_API_BASE)
      .persist()
      .get(`${YOUTUBE_API_PATH}/channels`)
      .query(true)
      .reply(replyChannelsByRequestedIds());

    const categoriesPath = await writeCategoriesJson(minimalCategories());
    const prevPath = await writePrevVideosJson(emptyPrev);
    const draftPath = path.join(tmpDir, 'videos.draft.json');

    await runBatch({
      categoriesPath,
      prevVideosPath: prevPath,
      draftPath,
      apiKey: 'test-key',
      logger,
      sleep: sleepFn,
    });

    // 指数バックオフ（1s → 2s → 4s）が正しい順序で発火している
    // ※ リクエスト間隔 sleep（REQUEST_INTERVAL_MS=300）が混入するため、バックオフ値のみ抽出して検証
    const backoffSleeps = sleepCalls.filter((ms) => [1000, 2000, 4000].includes(ms));
    expect(backoffSleeps).toEqual([1000, 2000, 4000]);
  });
});
