const { deduplicateVideos } = require('../../src/batch/dedup');

const makeVideo = (videoId, source = 'auto') => ({
  videoId,
  title: `Title ${videoId}`,
  channelName: 'Channel',
  thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  publishedAt: '2025-01-01',
  duration: 'PT10M0S',
  tags: source === 'manual' ? ['manual'] : [],
  source,
  status: 'active',
  order: 1,
});

const makeData = (categories) => ({
  meta: { last_updated: '2026-05-20', schema_version: '1.1' },
  categories,
});

const allVideoIds = (data) =>
  data.categories.flatMap((c) => c.genres.flatMap((g) => g.videos.map((v) => v.videoId)));

describe('deduplicateVideos()', () => {
  test('UT-02-01: 重複なしデータはそのまま返す（videoId数が変わらない）', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [
          { id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('aaaaaaaaaaa'), makeVideo('bbbbbbbbbbb')] },
          { id: 'GNR-02', name: 'g2', order: 2, videos: [makeVideo('ccccccccccc')] },
        ],
      },
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result).sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
  });

  test('UT-02-02: CAT-01にあるvideoIdはCAT-02から除外される', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('dupdupdupdu')] }],
      },
      {
        id: 'CAT-02',
        name: 'B',
        order: 2,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('dupdupdupdu')] }],
      },
    ]);
    const result = deduplicateVideos(data);
    expect(result.categories[0].genres[0].videos).toHaveLength(1);
    expect(result.categories[1].genres[0].videos).toHaveLength(0);
  });

  test('UT-02-03: manual動画が重複した場合もカテゴリ順序前を残す', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('manualxxxxx', 'manual')] }],
      },
      {
        id: 'CAT-02',
        name: 'B',
        order: 2,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('manualxxxxx', 'manual')] }],
      },
    ]);
    const result = deduplicateVideos(data);
    expect(result.categories[0].genres[0].videos[0].source).toBe('manual');
    expect(result.categories[1].genres[0].videos).toHaveLength(0);
  });

  test('UT-02-04: 同一カテゴリ内のジャンル間重複はジャンルorder前を残す', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [
          { id: 'GNR-02', name: 'g2', order: 2, videos: [makeVideo('crossxxxxxx')] },
          { id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('crossxxxxxx')] },
        ],
      },
    ]);
    const result = deduplicateVideos(data);
    // genre.order=1 (GNR-01) が残る
    const gnr1 = result.categories[0].genres.find((g) => g.id === 'GNR-01');
    const gnr2 = result.categories[0].genres.find((g) => g.id === 'GNR-02');
    expect(gnr1.videos).toHaveLength(1);
    expect(gnr2.videos).toHaveLength(0);
  });

  test('UT-02-05: 空配列入力は空配列を返す', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [] }],
      },
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result)).toEqual([]);
  });

  test('UT-02-06: 全動画が重複している場合は最初の1件のみ残す', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [
          { id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('sameXXXXXXX'), makeVideo('sameXXXXXXX')] },
          { id: 'GNR-02', name: 'g2', order: 2, videos: [makeVideo('sameXXXXXXX')] },
        ],
      },
      {
        id: 'CAT-02',
        name: 'B',
        order: 2,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('sameXXXXXXX')] }],
      },
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result)).toEqual(['sameXXXXXXX']);
  });

  test('UT-02-08: order が未定義のカテゴリ・ジャンルでも例外なく処理される（ロバストネス）', () => {
    const data = {
      meta: { last_updated: '2026-05-20', schema_version: '1.1' },
      categories: [
        { id: 'X', name: 'no-order', genres: [{ id: 'Y', name: 'no-order', videos: [makeVideo('robustaaaaa')] }] },
      ],
    };
    expect(() => deduplicateVideos(data)).not.toThrow();
    const result = deduplicateVideos(data);
    expect(result.categories[0].genres[0].videos[0].videoId).toBe('robustaaaaa');
  });

  test('UT-02-07: autoとmanual混在で同一videoIdの場合は順序優先（categoryOrder→genreOrder→source非問わず）', () => {
    const data = makeData([
      {
        id: 'CAT-01',
        name: 'A',
        order: 1,
        genres: [{ id: 'GNR-02', name: 'g2', order: 2, videos: [makeVideo('mixedxxxxxx', 'auto')] }],
      },
      {
        id: 'CAT-02',
        name: 'B',
        order: 2,
        genres: [{ id: 'GNR-01', name: 'g1', order: 1, videos: [makeVideo('mixedxxxxxx', 'manual')] }],
      },
    ]);
    const result = deduplicateVideos(data);
    // CAT-01（先）の auto が残り、CAT-02 の manual は除外される
    expect(result.categories[0].genres[0].videos[0].source).toBe('auto');
    expect(result.categories[1].genres[0].videos).toHaveLength(0);
  });
});
