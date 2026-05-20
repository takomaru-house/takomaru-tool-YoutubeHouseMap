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

// 3階層: categories[] → groups[] → genres[] → videos[]
const makeData = (categories) => ({
  meta: { last_updated: '2026-05-20', schema_version: '1.2' },
  categories,
});

const cat = (id, order, groups) => ({ id, name: id, order, groups });
const grp = (id, order, genres) => ({ id, name: id, order, genres });
const gnr = (id, order, videos) => ({ id, name: id, order, videos });

const allVideoIds = (data) =>
  data.categories.flatMap((c) =>
    (c.groups || []).flatMap((g) => (g.genres || []).flatMap((gn) => (gn.videos || []).map((v) => v.videoId)))
  );

describe('deduplicateVideos() (3階層: category → group → genre)', () => {
  test('UT-02-01: 重複なしデータはそのまま返す（videoId数が変わらない）', () => {
    const data = makeData([
      cat('CAT-01', 1, [
        grp('GRP-A', 1, [
          gnr('GNR-01', 1, [makeVideo('aaaaaaaaaaa'), makeVideo('bbbbbbbbbbb')]),
          gnr('GNR-02', 2, [makeVideo('ccccccccccc')]),
        ]),
      ]),
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result).sort()).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
  });

  test('UT-02-02: CAT-01 にある videoId は CAT-02 から除外される（CAT order 優先）', () => {
    const data = makeData([
      cat('CAT-01', 1, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('dupdupdupdu')])])]),
      cat('CAT-02', 2, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('dupdupdupdu')])])]),
    ]);
    const result = deduplicateVideos(data);
    expect(result.categories[0].groups[0].genres[0].videos).toHaveLength(1);
    expect(result.categories[1].groups[0].genres[0].videos).toHaveLength(0);
  });

  test('UT-02-03: manual 動画が重複した場合もカテゴリ順序前を残す', () => {
    const data = makeData([
      cat('CAT-01', 1, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('manualxxxxx', 'manual')])])]),
      cat('CAT-02', 2, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('manualxxxxx', 'manual')])])]),
    ]);
    const result = deduplicateVideos(data);
    expect(result.categories[0].groups[0].genres[0].videos[0].source).toBe('manual');
    expect(result.categories[1].groups[0].genres[0].videos).toHaveLength(0);
  });

  test('UT-02-04: 同一カテゴリ内のグループ間重複はグループ order 前を残す', () => {
    const data = makeData([
      cat('CAT-01', 1, [
        grp('GRP-B', 2, [gnr('GNR-04', 1, [makeVideo('crossxxxxxx')])]),
        grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('crossxxxxxx')])]),
      ]),
    ]);
    const result = deduplicateVideos(data);
    const grpA = result.categories[0].groups.find((g) => g.id === 'GRP-A');
    const grpB = result.categories[0].groups.find((g) => g.id === 'GRP-B');
    expect(grpA.genres[0].videos).toHaveLength(1);
    expect(grpB.genres[0].videos).toHaveLength(0);
  });

  test('UT-02-04b: 同一グループ内のジャンル間重複はジャンル order 前を残す', () => {
    const data = makeData([
      cat('CAT-01', 1, [
        grp('GRP-A', 1, [
          gnr('GNR-08', 2, [makeVideo('innerxxxxxx')]),
          gnr('GNR-01', 1, [makeVideo('innerxxxxxx')]),
        ]),
      ]),
    ]);
    const result = deduplicateVideos(data);
    const grpA = result.categories[0].groups[0];
    const gnr01 = grpA.genres.find((g) => g.id === 'GNR-01');
    const gnr08 = grpA.genres.find((g) => g.id === 'GNR-08');
    expect(gnr01.videos).toHaveLength(1);
    expect(gnr08.videos).toHaveLength(0);
  });

  test('UT-02-05: 空配列入力は空配列を返す', () => {
    const data = makeData([
      cat('CAT-01', 1, [grp('GRP-A', 1, [gnr('GNR-01', 1, [])])]),
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result)).toEqual([]);
  });

  test('UT-02-06: 全動画が重複している場合は最初の1件のみ残す', () => {
    const data = makeData([
      cat('CAT-01', 1, [
        grp('GRP-A', 1, [
          gnr('GNR-01', 1, [makeVideo('sameXXXXXXX'), makeVideo('sameXXXXXXX')]),
          gnr('GNR-02', 2, [makeVideo('sameXXXXXXX')]),
        ]),
      ]),
      cat('CAT-02', 2, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('sameXXXXXXX')])])]),
    ]);
    const result = deduplicateVideos(data);
    expect(allVideoIds(result)).toEqual(['sameXXXXXXX']);
  });

  test('UT-02-07: auto と manual 混在で同一 videoId の場合は order 優先（source 非問わず）', () => {
    const data = makeData([
      cat('CAT-01', 1, [grp('GRP-A', 1, [gnr('GNR-08', 2, [makeVideo('mixedxxxxxx', 'auto')])])]),
      cat('CAT-02', 2, [grp('GRP-A', 1, [gnr('GNR-01', 1, [makeVideo('mixedxxxxxx', 'manual')])])]),
    ]);
    const result = deduplicateVideos(data);
    expect(result.categories[0].groups[0].genres[0].videos[0].source).toBe('auto');
    expect(result.categories[1].groups[0].genres[0].videos).toHaveLength(0);
  });
});
