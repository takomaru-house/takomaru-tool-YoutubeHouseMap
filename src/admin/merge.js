// draft → 本番 videos.json へのマージロジック
// 戦略：
//   - auto 動画：draft の内容で更新（draft が真実）
//   - manual 動画：prev の内容を保護（draft には含まれていない前提）
//   - dead 動画：prev の status:"dead" を引き継ぐ
//   - ジャンル内：manual を先頭、auto を後続、最大 8 件で打ち切り、order 再付与
// 非破壊。アトミック書き込みは呼び出し側で実施。

const MAX_VIDEOS_PER_GENRE = 8;

const collectPrevByGenre = (prev) => {
  const manualMap = new Map();
  const deadIds = new Set();
  for (const cat of (prev && prev.categories) || []) {
    for (const gnr of cat.genres || []) {
      const key = `${cat.id}/${gnr.id}`;
      const manuals = (gnr.videos || []).filter((v) => v.source === 'manual');
      if (manuals.length > 0) manualMap.set(key, manuals);
      for (const v of gnr.videos || []) {
        if (v.status === 'dead') deadIds.add(v.videoId);
      }
    }
  }
  return { manualMap, deadIds };
};

const mergeDraft = (prev, draft) => {
  const { manualMap, deadIds } = collectPrevByGenre(prev);

  const mergedCategories = (draft.categories || []).map((cat) => {
    const newGenres = (cat.genres || []).map((gnr) => {
      const key = `${cat.id}/${gnr.id}`;
      const prevManuals = manualMap.get(key) || [];
      const draftAuto = (gnr.videos || []).map((v) => {
        if (deadIds.has(v.videoId)) {
          return { ...v, status: 'dead' };
        }
        return v;
      });

      // manual 先頭 → auto 後続
      const combined = [...prevManuals, ...draftAuto];

      // 同一 videoId の重複排除（先勝ち = manual 優先）
      const seen = new Set();
      const deduped = combined.filter((v) => {
        if (seen.has(v.videoId)) return false;
        seen.add(v.videoId);
        return true;
      });

      // 上限 8 件で打ち切り + order 再付与
      const limited = deduped
        .slice(0, MAX_VIDEOS_PER_GENRE)
        .map((v, i) => ({ ...v, order: i + 1 }));

      return { ...gnr, videos: limited };
    });
    return { ...cat, genres: newGenres };
  });

  return {
    meta: {
      ...(prev && prev.meta),
      ...(draft && draft.meta),
    },
    categories: mergedCategories,
  };
};

module.exports = { mergeDraft };
