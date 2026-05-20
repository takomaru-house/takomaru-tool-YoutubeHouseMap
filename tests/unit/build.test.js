const {
  filterDeadVideos,
  updateLastUpdated,
  checkCategoryIntegrity,
} = require('../../src/builder/build');

const makeVideo = (overrides = {}) => ({
  videoId: 'vidXXXXXXXX',
  title: 't',
  channelName: 'c',
  thumbnailUrl: 'https://img.youtube.com/vi/vidXXXXXXXX/hqdefault.jpg',
  publishedAt: '2025-01-01',
  duration: 'PT5M',
  tags: [],
  source: 'auto',
  status: 'active',
  order: 1,
  ...overrides,
});

const makeData = (videos) => ({
  meta: { last_updated: '2025-01-01', schema_version: '1.1' },
  categories: [
    {
      id: 'CAT-01',
      name: 'A',
      genres: [{ id: 'GNR-01', name: 'g1', videos }],
    },
  ],
});

describe('filterDeadVideos()', () => {
  test('UT-06-01: status:"dead" の動画が除外される', () => {
    const data = makeData([
      makeVideo({ videoId: 'aliveXXXXXX', status: 'active' }),
      makeVideo({ videoId: 'deadXXXXXXX', status: 'dead' }),
    ]);
    const result = filterDeadVideos(data);
    const ids = result.categories[0].genres[0].videos.map((v) => v.videoId);
    expect(ids).toEqual(['aliveXXXXXX']);
  });

  test('UT-06-02: status:"active" の動画は保持される', () => {
    const data = makeData([makeVideo({ videoId: 'aliveXXXXXX', status: 'active' })]);
    const result = filterDeadVideos(data);
    expect(result.categories[0].genres[0].videos).toHaveLength(1);
  });

  test('UT-06-03: 全動画が dead の場合は空配列のジャンルになる', () => {
    const data = makeData([
      makeVideo({ videoId: 'deadAAAAAAA', status: 'dead' }),
      makeVideo({ videoId: 'deadBBBBBBB', status: 'dead' }),
    ]);
    const result = filterDeadVideos(data);
    expect(result.categories[0].genres[0].videos).toEqual([]);
  });
});

describe('updateLastUpdated()', () => {
  test('UT-06-04: meta.last_updated が指定日付（YYYY-MM-DD）に更新される', () => {
    const data = makeData([]);
    const fixed = new Date(Date.UTC(2026, 4, 20)); // 2026-05-20
    const result = updateLastUpdated(data, fixed);
    expect(result.meta.last_updated).toBe('2026-05-20');
    expect(result.meta.schema_version).toBe('1.1');
  });
});

describe('checkCategoryIntegrity()', () => {
  test('UT-06-05: categories.json にないジャンルIDがあれば警告ログを出力', () => {
    const videos = makeData([]);
    const categories = {
      categories: [
        {
          id: 'CAT-01',
          name: 'A',
          genres: [{ id: 'OTHER', name: 'other' }], // GNR-01 が定義されていない
        },
      ],
    };
    const logger = { warn: jest.fn() };
    const orphaned = checkCategoryIntegrity(videos, categories, logger);
    expect(orphaned).toBeGreaterThan(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('UT-06-06: 整合性が取れている場合は警告なし', () => {
    const videos = makeData([]);
    const categories = {
      categories: [
        {
          id: 'CAT-01',
          name: 'A',
          genres: [{ id: 'GNR-01', name: 'g1' }],
        },
      ],
    };
    const logger = { warn: jest.fn() };
    const orphaned = checkCategoryIntegrity(videos, categories, logger);
    expect(orphaned).toBe(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
