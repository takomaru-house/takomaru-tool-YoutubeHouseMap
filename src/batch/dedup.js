// 重複排除：同一 videoId が複数カテゴリ×ジャンルに存在する場合、
// カテゴリ order → ジャンル order の前のものを優先（auto/manual 問わず）。
// 非破壊：入力データはコピーして返す。
// データ契約：data.categories / cat.genres は order を持つ前提（categories.json で保証）。
// 未定義の場合は順序が不定になるが例外は出ない。

const byOrder = (a, b) => a.order - b.order;

const deduplicateVideos = (data) => {
  const seenIds = new Set();

  const sortedCategories = [...data.categories].sort(byOrder);

  const newCategories = sortedCategories.map((cat) => {
    const sortedGenres = [...cat.genres].sort(byOrder);
    const newGenres = sortedGenres.map((gnr) => {
      const keptVideos = [];
      for (const v of gnr.videos) {
        if (seenIds.has(v.videoId)) continue;
        seenIds.add(v.videoId);
        keptVideos.push(v);
      }
      return { ...gnr, videos: keptVideos };
    });
    return { ...cat, genres: newGenres };
  });

  return { ...data, categories: newCategories };
};

module.exports = { deduplicateVideos };
