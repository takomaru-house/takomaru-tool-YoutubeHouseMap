// 重複排除：同一 videoId が複数カテゴリ × グループ × ジャンルに存在する場合、
// カテゴリ order → グループ order → ジャンル order の前のものを優先（auto/manual 問わず）。
// 非破壊：入力データはコピーして返す。
// データ契約：categories[].groups[].genres[] それぞれが order を持つ（categories.json で保証）。

const byOrder = (a, b) => a.order - b.order;

const deduplicateVideos = (data) => {
  const seenIds = new Set();
  const sortedCategories = [...data.categories].sort(byOrder);

  const newCategories = sortedCategories.map((cat) => {
    const sortedGroups = [...(cat.groups || [])].sort(byOrder);
    const newGroups = sortedGroups.map((grp) => {
      const sortedGenres = [...(grp.genres || [])].sort(byOrder);
      const newGenres = sortedGenres.map((gnr) => {
        const keptVideos = [];
        for (const v of gnr.videos || []) {
          if (seenIds.has(v.videoId)) continue;
          seenIds.add(v.videoId);
          keptVideos.push(v);
        }
        return { ...gnr, videos: keptVideos };
      });
      return { ...grp, genres: newGenres };
    });
    return { ...cat, groups: newGroups };
  });

  return { ...data, categories: newCategories };
};

module.exports = { deduplicateVideos };
