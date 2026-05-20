// YouTube Data API v3 モックデータ・ヘルパー（nock 用）
// 用途：tests/integration/* で search.list / videos.list / channels.list をインターセプトする

const YOUTUBE_API_BASE = 'https://www.googleapis.com';
const YOUTUBE_API_PATH = '/youtube/v3';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const formatDateUTC = (date) => date.toISOString();

const daysAgo = (n) => formatDateUTC(new Date(Date.now() - n * ONE_DAY_MS));

const makeVideoId = (prefix, i) => {
  const padded = String(i).padStart(11 - prefix.length, '0');
  return (prefix + padded).slice(0, 11);
};

// 1ジャンル分の架空動画IDセットを生成（11文字、英数字 + アンダーバー）
const makeVideoIds = (prefix, count) =>
  Array.from({ length: count }, (_, i) => makeVideoId(prefix, i));

const makeChannelId = (videoId) => `UC${videoId}_chan`.slice(0, 24);

// search.list レスポンス
const makeSearchResponse = (videoIds, options = {}) => ({
  kind: 'youtube#searchListResponse',
  pageInfo: { totalResults: videoIds.length, resultsPerPage: videoIds.length },
  items: videoIds.map((videoId, i) => ({
    kind: 'youtube#searchResult',
    id: { kind: 'youtube#video', videoId },
    snippet: {
      publishedAt: options.publishedAt || daysAgo(30),
      channelId: makeChannelId(videoId),
      channelTitle: options.channelTitle || `Channel ${i}`,
      title: options.titlePrefix
        ? `${options.titlePrefix} ${i}`
        : `Sample Video ${i}`,
      description: '',
    },
  })),
});

// videos.list レスポンス（snippet + contentDetails + statistics）
const makeVideosResponse = (videoIds, options = {}) => ({
  kind: 'youtube#videoListResponse',
  items: videoIds.map((videoId, i) => {
    const item = {
      kind: 'youtube#video',
      id: videoId,
      snippet: {
        publishedAt: options.publishedAt || daysAgo(30),
        channelId: makeChannelId(videoId),
        channelTitle: options.channelTitle || `Channel ${i}`,
        title: options.titlePrefix
          ? `${options.titlePrefix} ${i}`
          : `Sample Video ${i}`,
      },
      contentDetails: { duration: options.duration || 'PT15M30S' },
      statistics: {
        viewCount: String(options.viewCount ?? 10000),
        likeCount: String(options.likeCount ?? 100),
      },
    };
    return item;
  }),
});

// channels.list レスポンス（subscriberCount 取得用）
// hiddenSubscriberCount: true の場合 subscriberCount は含まれない
const makeChannelsResponse = (channelIds, options = {}) => ({
  kind: 'youtube#channelListResponse',
  items: channelIds.map((channelId) => {
    const stats = {};
    if (options.hiddenSubscriberCount) {
      stats.hiddenSubscriberCount = true;
    } else {
      stats.subscriberCount = String(options.subscriberCount ?? 10000);
      stats.hiddenSubscriberCount = false;
    }
    return {
      kind: 'youtube#channel',
      id: channelId,
      statistics: stats,
    };
  }),
});

// 死活チェック用：一部の videoId のみ返却（残りは「削除済み」扱い）
const makeVideosListPartial = (foundVideoIds) =>
  makeVideosResponse(foundVideoIds, { duration: 'PT5M0S' });

module.exports = {
  YOUTUBE_API_BASE,
  YOUTUBE_API_PATH,
  daysAgo,
  makeVideoId,
  makeVideoIds,
  makeChannelId,
  makeSearchResponse,
  makeVideosResponse,
  makeChannelsResponse,
  makeVideosListPartial,
};
