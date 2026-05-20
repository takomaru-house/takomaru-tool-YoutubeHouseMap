const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { buildSite } = require('../../src/builder/build');

let tmpDir;
let videosPath;
let categoriesPath;
let outputPath;
let logger;

const baseCategories = {
  globalSettings: { blockedChannelIds: [], blockedVideoIds: [] },
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
          genres: [{ id: 'GNR-01', name: '間取り', order: 1, searchQuery: 'q', searchQueryAlt: 'q' }],
        },
      ],
    },
  ],
};

const baseVideos = {
  meta: { last_updated: '2025-01-01', schema_version: '1.2' },
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
                  videoId: 'aliveAAAAAA',
                  title: 'alive',
                  channelName: 'c',
                  thumbnailUrl: 'https://img.youtube.com/vi/aliveAAAAAA/hqdefault.jpg',
                  publishedAt: '2025-06-01',
                  duration: 'PT10M',
                  tags: [],
                  source: 'auto',
                  status: 'active',
                  order: 1,
                },
                {
                  videoId: 'deadBBBBBBB',
                  title: 'dead',
                  channelName: 'c',
                  thumbnailUrl: 'https://img.youtube.com/vi/deadBBBBBBB/hqdefault.jpg',
                  publishedAt: '2025-06-01',
                  duration: 'PT10M',
                  tags: [],
                  source: 'auto',
                  status: 'dead',
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

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-it-'));
  videosPath = path.join(tmpDir, 'videos.json');
  categoriesPath = path.join(tmpDir, 'categories.json');
  outputPath = path.join(tmpDir, 'out', 'videos.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(categoriesPath, JSON.stringify(baseCategories), 'utf-8');
  logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('IT-05: 静的ビルド統合 (v1.2 3階層)', () => {
  test('IT-05-01: ビルド後に docs/data/videos.json 相当のファイルが生成される', async () => {
    await fs.writeFile(videosPath, JSON.stringify(baseVideos), 'utf-8');
    await buildSite({ videosPath, categoriesPath, outputPath, logger });
    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
  });

  test('IT-05-02: dead 動画が出力から除外されている', async () => {
    await fs.writeFile(videosPath, JSON.stringify(baseVideos), 'utf-8');
    await buildSite({ videosPath, categoriesPath, outputPath, logger });
    const out = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    const ids = out.categories[0].groups[0].genres[0].videos.map((v) => v.videoId);
    expect(ids).toContain('aliveAAAAAA');
    expect(ids).not.toContain('deadBBBBBBB');
  });

  test('IT-05-03: meta.last_updated が指定日付になる', async () => {
    await fs.writeFile(videosPath, JSON.stringify(baseVideos), 'utf-8');
    await buildSite({
      videosPath,
      categoriesPath,
      outputPath,
      logger,
      now: new Date(Date.UTC(2026, 4, 20)),
    });
    const out = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    expect(out.meta.last_updated).toBe('2026-05-20');
  });

  test('IT-05-04: videos.json が存在しない場合も空構造でビルドされる', async () => {
    await buildSite({ videosPath, categoriesPath, outputPath, logger });
    const out = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    expect(out).toHaveProperty('meta.schema_version', '1.2');
    expect(out.categories).toEqual([]);
  });

  test('IT-05-05: categories.json と孤立 ID がある場合に警告ログが出力される', async () => {
    const orphanedVideos = {
      ...baseVideos,
      categories: [
        {
          id: 'CAT-99',
          name: 'orphan',
          groups: [
            {
              id: 'GRP-99',
              name: 'orphan-grp',
              genres: [{ id: 'GNR-99', name: 'orphan-gnr', videos: [] }],
            },
          ],
        },
      ],
    };
    await fs.writeFile(videosPath, JSON.stringify(orphanedVideos), 'utf-8');
    await buildSite({ videosPath, categoriesPath, outputPath, logger });
    expect(logger.warn).toHaveBeenCalled();
    const warnText = logger.warn.mock.calls.flat().join(' ');
    expect(warnText).toMatch(/孤立|orphan/i);
  });

  test('IT-05-06: アトミック書き込みで生成される（.tmp が残らない）', async () => {
    await fs.writeFile(videosPath, JSON.stringify(baseVideos), 'utf-8');
    await buildSite({ videosPath, categoriesPath, outputPath, logger });
    await expect(fs.access(outputPath + '.tmp')).rejects.toThrow();
  });
});
