// 静的サイトビルダー
// data/videos.json + data/categories.json → docs/data/videos.json
// - dead 動画除外
// - meta.last_updated を現在日付に更新
// - categories.json との整合性チェック（孤立 ID 警告）
// - writeJsonAtomic で安全書き込み

const fs = require('fs').promises;
const path = require('path');
const { writeJsonAtomic } = require('../utils/fileUtils');

const SCHEMA_VERSION = '1.1';

const formatDateYYYYMMDD = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const filterDeadVideos = (data) => ({
  ...data,
  categories: (data.categories || []).map((c) => ({
    ...c,
    genres: (c.genres || []).map((g) => ({
      ...g,
      videos: (g.videos || []).filter((v) => v.status !== 'dead'),
    })),
  })),
});

const updateLastUpdated = (data, date) => ({
  ...data,
  meta: {
    ...(data.meta || {}),
    last_updated: formatDateYYYYMMDD(date || new Date()),
    schema_version: SCHEMA_VERSION,
  },
});

const checkCategoryIntegrity = (videos, categories, logger) => {
  const defined = new Set();
  for (const c of (categories && categories.categories) || []) {
    for (const g of c.genres || []) {
      defined.add(`${c.id}/${g.id}`);
    }
  }
  let orphaned = 0;
  for (const c of (videos && videos.categories) || []) {
    for (const g of c.genres || []) {
      const key = `${c.id}/${g.id}`;
      if (!defined.has(key)) {
        logger.warn(`孤立 ID 検出（categories.json に未定義）: ${key}`);
        orphaned += 1;
      }
    }
  }
  return orphaned;
};

const buildSite = async (options) => {
  const { videosPath, categoriesPath, outputPath, logger = console, now } = options;

  let videosData;
  try {
    videosData = JSON.parse(await fs.readFile(videosPath, 'utf-8'));
  } catch (err) {
    /* istanbul ignore else : 想定外の I/O エラーは呼び出し側へ */
    if (err && err.code === 'ENOENT') {
      logger.warn(`videos.json が存在しないため空構造でビルドします: ${videosPath}`);
      videosData = { meta: { schema_version: SCHEMA_VERSION }, categories: [] };
    } else {
      throw err;
    }
  }

  const categoriesData = JSON.parse(await fs.readFile(categoriesPath, 'utf-8'));

  const orphaned = checkCategoryIntegrity(videosData, categoriesData, logger);
  const filtered = filterDeadVideos(videosData);
  const finalData = updateLastUpdated(filtered, now);

  await writeJsonAtomic(outputPath, finalData);

  return { outputPath, orphaned };
};

/* istanbul ignore next : CLI 起動。tests は buildSite を直接呼ぶ */
const main = async () => {
  const projectRoot = path.join(__dirname, '..', '..');
  try {
    const result = await buildSite({
      videosPath: path.join(projectRoot, 'data', 'videos.json'),
      categoriesPath: path.join(projectRoot, 'data', 'categories.json'),
      outputPath: path.join(projectRoot, 'docs', 'data', 'videos.json'),
    });
    console.log(`ビルド完了: ${result.outputPath} (孤立ID: ${result.orphaned} 件)`);
  } catch (err) {
    console.error('ビルド失敗:', err.message);
    process.exit(1);
  }
};

/* istanbul ignore if */
if (require.main === module) {
  main();
}

module.exports = {
  buildSite,
  filterDeadVideos,
  updateLastUpdated,
  checkCategoryIntegrity,
};
