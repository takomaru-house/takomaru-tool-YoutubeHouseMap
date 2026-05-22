// YouTube Data API v3 アクセスレイヤ
// - search.list / videos.list / channels.list を呼び出して 1ジャンル分の動画リストを返す
// - 指数バックオフリトライ（最大3回：1s → 2s → 4s）
// - グローバルブロックリスト除外 + videoId バリデーション

const { MIN_VIEW_COUNT } = require('./score');
const { parseDurationSeconds } = require('../utils/validation');

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const MAX_SEARCH_RESULTS = 10;
// 動画時間フィルタ: Shorts と超長尺を除外、4分〜40分のみ採用
const MIN_DURATION_SECONDS = 240;  // 4分
const MAX_DURATION_SECONDS = 2400; // 40分

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 指数バックオフリトライ（最大3回：1s → 2s → 4s、合計 4 回試行）
const withRetry = async (fn, options = {}) => {
  const { maxRetries = 3, initialDelayMs = 1000, sleep = defaultSleep } = options;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
};

const fetchJSON = async (baseUrl, params) => {
  const u = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString());
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${baseUrl}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const searchVideos = async (query, options) => {
  const { apiKey, sleep, maxResults = MAX_SEARCH_RESULTS } = options;
  const data = await withRetry(
    () =>
      fetchJSON(SEARCH_URL, {
        part: 'snippet',
        q: query,
        type: 'video',
        regionCode: 'JP',
        relevanceLanguage: 'ja',
        videoEmbeddable: 'true',
        // videoDuration は指定せず、取得後に ISO 8601 で厳密フィルタ（MIN/MAX_DURATION_SECONDS）
        safeSearch: 'strict',
        order: 'viewCount', // クエリ関連の動画を再生数多い順で取得（注文住宅初心者向け人気動画を優先）
        maxResults,
        key: apiKey,
      }),
    { sleep }
  );
  return (data.items || []).map((it) => ({
    videoId: it.id && it.id.videoId,
    channelId: it.snippet && it.snippet.channelId,
    channelTitle: it.snippet && it.snippet.channelTitle,
    title: it.snippet && it.snippet.title,
    publishedAt: it.snippet && it.snippet.publishedAt,
  }));
};

const fetchVideoDetails = async (videoIds, options) => {
  if (!videoIds.length) return [];
  const { apiKey, sleep } = options;
  const results = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await withRetry(
      () =>
        fetchJSON(VIDEOS_URL, {
          part: 'snippet,contentDetails,statistics',
          id: batch.join(','),
          key: apiKey,
        }),
      { sleep }
    );
    for (const item of data.items || []) {
      results.push({
        videoId: item.id,
        title: item.snippet && item.snippet.title,
        channelId: item.snippet && item.snippet.channelId,
        channelTitle: item.snippet && item.snippet.channelTitle,
        publishedAt: item.snippet && item.snippet.publishedAt,
        duration: item.contentDetails && item.contentDetails.duration,
        viewCount: parseInt((item.statistics && item.statistics.viewCount) || '0', 10),
      });
    }
  }
  return results;
};

const fetchChannelStats = async (channelIds, options) => {
  if (!channelIds.length) return {};
  const { apiKey, sleep } = options;
  const map = {};
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const data = await withRetry(
      () =>
        fetchJSON(CHANNELS_URL, {
          part: 'statistics',
          id: batch.join(','),
          key: apiKey,
        }),
      { sleep }
    );
    for (const item of data.items || []) {
      const stats = item.statistics || {};
      if (stats.hiddenSubscriberCount) {
        map[item.id] = { subscriberCount: null };
      } else {
        map[item.id] = {
          subscriberCount: parseInt(stats.subscriberCount, 10),
        };
      }
    }
  }
  return map;
};

// 1ジャンル分の動画リストを取得
// 戻り値: video[] with _tempApiData
const fetchForGenre = async (category, genre, options) => {
  const {
    apiKey,
    blockedChannelIds = [],
    blockedVideoIds = [],
    sleep,
  } = options;

  // メインクエリで検索
  let items = await searchVideos(genre.searchQuery, { apiKey, sleep });

  // 8件未満なら代替クエリで補完
  if (items.length < 8 && genre.searchQueryAlt) {
    const altItems = await searchVideos(genre.searchQueryAlt, { apiKey, sleep });
    items = [...items, ...altItems];
  }

  // videoId バリデーション
  items = items.filter((it) => it.videoId && VIDEO_ID_RE.test(it.videoId));

  // ブロックリスト除外
  const blockedChannelSet = new Set(blockedChannelIds);
  const blockedVideoSet = new Set(blockedVideoIds);
  items = items.filter(
    (it) => !blockedVideoSet.has(it.videoId) && !blockedChannelSet.has(it.channelId)
  );

  // 同一ジャンル内の重複排除
  const seen = new Set();
  items = items.filter((it) => {
    if (seen.has(it.videoId)) return false;
    seen.add(it.videoId);
    return true;
  });

  // 上位10件に絞る
  items = items.slice(0, MAX_SEARCH_RESULTS);

  if (items.length === 0) return [];

  // 動画詳細取得
  const videoIds = items.map((it) => it.videoId);
  const details = await fetchVideoDetails(videoIds, { apiKey, sleep });

  // 登録者数取得
  const channelIds = [...new Set(details.map((d) => d.channelId).filter(Boolean))];
  const channelStats = await fetchChannelStats(channelIds, { apiKey, sleep });

  // 統合 + フィルタ:
  //  - 最低再生数（MIN_VIEW_COUNT）
  //  - 動画時間レンジ（MIN_DURATION_SECONDS 〜 MAX_DURATION_SECONDS）で Shorts と超長尺を除外
  return details
    .filter((d) => (d.viewCount || 0) >= MIN_VIEW_COUNT)
    .filter((d) => {
      const sec = parseDurationSeconds(d.duration);
      return sec >= MIN_DURATION_SECONDS && sec <= MAX_DURATION_SECONDS;
    })
    .map((d) => {
    const publishedAtIso = d.publishedAt || '';
    const stats = channelStats[d.channelId];
    const subscriberCount = stats ? stats.subscriberCount : null;
    return {
      videoId: d.videoId,
      title: d.title || '',
      channelName: d.channelTitle || '',
      thumbnailUrl: `https://img.youtube.com/vi/${d.videoId}/hqdefault.jpg`,
      publishedAt: publishedAtIso.split('T')[0] || '',
      duration: d.duration || '',
      _tempApiData: {
        subscriberCount,
        viewCount: d.viewCount,
        publishedAt: publishedAtIso,
      },
    };
  });
};

module.exports = {
  withRetry,
  searchVideos,
  fetchVideoDetails,
  fetchChannelStats,
  fetchForGenre,
};
