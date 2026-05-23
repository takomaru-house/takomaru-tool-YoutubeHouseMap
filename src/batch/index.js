// バッチエントリポイント（schema v1.2 3階層対応）
// フロー:
//   1. categories.json + 前回 videos.json 読み込み
//   2. 各カテゴリ × グループ × ジャンルで fetchForGenre → trending タグ付与
//   3. 件数不足時は前回 auto 動画から補完（manual は draft に混入させない）
//   4. 全体で重複排除（カテゴリ order → グループ order → ジャンル order の前を優先）
//   5. _tempApiData を strip し、order を再付与
//   6. data/videos.draft.json をアトミック書き込み

const fs = require('fs').promises;
const path = require('path');
const { writeJsonAtomic } = require('../utils/fileUtils');
const { fetchForGenre } = require('./fetch');
const { isTrending } = require('./score');
const { deduplicateVideos } = require('./dedup');
const { classifyChannel } = require('./classifier');

const MAX_VIDEOS_PER_GENRE = 8;
const SCHEMA_VERSION = '1.2';

const readJSON = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
};

const readJSONOrDefault = async (filePath, defaultValue) => {
  try {
    return await readJSON(filePath);
  } catch (_err) {
    return defaultValue;
  }
};

const collectManualVideos = (videosData) => {
  const result = [];
  for (const cat of (videosData && videosData.categories) || []) {
    for (const grp of cat.groups || []) {
      for (const gnr of grp.genres || []) {
        for (const v of gnr.videos || []) {
          if (v.source === 'manual') {
            result.push({ categoryId: cat.id, groupId: grp.id, genreId: gnr.id, video: v });
          }
        }
      }
    }
  }
  return result;
};

const findPrevAutoVideos = (prev, catId, groupId, gnrId) => {
  const cat = ((prev && prev.categories) || []).find((c) => c.id === catId);
  if (!cat) return [];
  const grp = (cat.groups || []).find((g) => g.id === groupId);
  if (!grp) return [];
  const gnr = (grp.genres || []).find((g) => g.id === gnrId);
  if (!gnr) return [];
  return (gnr.videos || []).filter((v) => v.source === 'auto');
};

const formatDateYYYYMMDD = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const stripTempApiData = (video, order) => {
  const { _tempApiData, ...rest } = video;
  return { ...rest, order };
};

// チャンネル属性で各動画を CAT-01（individual / 施主目線）または CAT-02（company / 専門家目線）へ振り分け直す
// side="mixed" のカテゴリ（例：CAT-03 準備・資金）は専門家・施主混在で扱うため skip
const reclassifyByChannel = (data, overrides) => {
  const genreMap = {};
  for (const c of data.categories) {
    genreMap[c.id] = {};
    for (const g of c.groups) {
      for (const gn of g.genres) {
        genreMap[c.id][g.id + '/' + gn.id] = gn;
      }
    }
  }
  let moves = 0;
  for (const c of data.categories) {
    // mixed カテゴリは再分類対象外（専門家・施主が混在したまま）
    if (c.side === 'mixed') continue;
    for (const g of c.groups) {
      for (const gn of g.genres) {
        const keep = [];
        for (const v of gn.videos) {
          const expectedCat =
            classifyChannel(v.channelName, overrides) === 'company' ? 'CAT-02' : 'CAT-01';
          if (expectedCat === c.id) {
            keep.push(v);
          } else {
            const target = genreMap[expectedCat] && genreMap[expectedCat][g.id + '/' + gn.id];
            if (target) {
              target.videos.push(v);
              moves += 1;
            } else {
              keep.push(v);
            }
          }
        }
        gn.videos = keep;
      }
    }
  }
  return moves;
};

const runBatch = async (options) => {
  const {
    categoriesPath,
    prevVideosPath,
    draftPath,
    apiKey,
    logger = console,
    sleep,
    now = new Date(),
  } = options;

  const config = await readJSON(categoriesPath);
  const prev = await readJSONOrDefault(prevVideosPath, {
    meta: { last_updated: '', schema_version: SCHEMA_VERSION },
    categories: [],
  });

  const prevManualVideos = collectManualVideos(prev);
  logger.log(`前回 manual 動画保護対象: ${prevManualVideos.length} 件（次回マージ時に保護されます）`);

  const draftCategories = [];
  const insufficientGenres = [];

  for (const cat of config.categories) {
    const newGroups = [];
    for (const grp of cat.groups) {
      const newGenres = [];
      for (const gnr of grp.genres) {
        let videos = [];
        try {
          videos = await fetchForGenre(cat, gnr, {
            apiKey,
            blockedChannelIds: (config.globalSettings && config.globalSettings.blockedChannelIds) || [],
            blockedVideoIds: (config.globalSettings && config.globalSettings.blockedVideoIds) || [],
            sleep,
          });
        } catch (err) {
          logger.error(`fetchForGenre failed ${cat.id}/${grp.id}/${gnr.id}: ${err.message}`);
          videos = [];
        }

        videos = videos.map((v) => ({
          ...v,
          tags: isTrending(v) ? ['trending'] : [],
          source: 'auto',
          status: 'active',
        }));

        if (videos.length < MAX_VIDEOS_PER_GENRE) {
          const prevAuto = findPrevAutoVideos(prev, cat.id, grp.id, gnr.id);
          const existingIds = new Set(videos.map((v) => v.videoId));
          for (const pv of prevAuto) {
            if (existingIds.has(pv.videoId)) continue;
            videos.push({ ...pv });
            existingIds.add(pv.videoId);
            if (videos.length >= MAX_VIDEOS_PER_GENRE) break;
          }
        }

        if (videos.length < MAX_VIDEOS_PER_GENRE) {
          insufficientGenres.push(`${cat.id}/${grp.id}/${gnr.id}: ${videos.length}件`);
        }

        videos = videos.slice(0, MAX_VIDEOS_PER_GENRE);
        videos = videos.map((v, i) => stripTempApiData(v, i + 1));

        newGenres.push({ id: gnr.id, name: gnr.name, order: gnr.order, videos });
      }
      newGroups.push({ id: grp.id, name: grp.name, order: grp.order, genres: newGenres });
    }
    draftCategories.push({ id: cat.id, name: cat.name, order: cat.order, groups: newGroups });
  }

  let draftData = {
    meta: {
      last_updated: formatDateYYYYMMDD(now),
      schema_version: SCHEMA_VERSION,
    },
    categories: draftCategories,
  };

  // チャンネル属性で再分類（施主目線/専門家目線への振り分け）
  const overrides =
    (config.globalSettings && config.globalSettings.channelOverrides) || {};
  const reclassifyMoves = reclassifyByChannel(draftData, overrides);
  if (reclassifyMoves > 0) {
    logger.log(`チャンネル属性で ${reclassifyMoves} 件の動画をカテゴリ間で移動`);
  }

  draftData = deduplicateVideos(draftData);

  // 再分類後にジャンルが 8件超になっている可能性 → 再 slice + order 再付与
  for (const c of draftData.categories) {
    for (const g of c.groups) {
      for (const gn of g.genres) {
        gn.videos = gn.videos
          .slice(0, MAX_VIDEOS_PER_GENRE)
          .map((v, i) => ({ ...v, order: i + 1 }));
      }
    }
  }

  // dedup後にorderフィールドを除去（公開データには不要、categories.jsonが正本）
  draftData = {
    ...draftData,
    categories: draftData.categories.map((c) => {
      const { order: _co, ...rest } = c;
      return {
        ...rest,
        groups: (c.groups || []).map((g) => {
          const { order: _go, ...gRest } = g;
          return {
            ...gRest,
            genres: (g.genres || []).map((gn) => {
              const { order: _gno, ...gnRest } = gn;
              return gnRest;
            }),
          };
        }),
      };
    }),
  };

  if (insufficientGenres.length > 0) {
    logger.warn(`件数不足ジャンル:\n${insufficientGenres.join('\n')}`);
  }

  await writeJsonAtomic(draftPath, draftData);

  return {
    draftPath,
    prevManualCount: prevManualVideos.length,
    insufficientGenres,
  };
};

/* istanbul ignore next : CLI 起動 */
const main = async () => {
  require('dotenv').config();
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY 環境変数が設定されていません。.env を確認してください。');
    process.exit(1);
  }
  const projectRoot = path.join(__dirname, '..', '..');
  try {
    const result = await runBatch({
      categoriesPath: path.join(projectRoot, 'data', 'categories.json'),
      prevVideosPath: path.join(projectRoot, 'data', 'videos.json'),
      draftPath: path.join(projectRoot, 'data', 'videos.draft.json'),
      apiKey,
    });
    console.log(`バッチ完了：${result.draftPath}`);
    console.log(`件数不足: ${result.insufficientGenres.length} 件`);
  } catch (err) {
    console.error('バッチ実行に失敗:', err.message);
    process.exit(1);
  }
};

/* istanbul ignore if */
if (require.main === module) {
  main();
}

module.exports = { runBatch };
