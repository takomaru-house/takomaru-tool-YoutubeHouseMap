// 急上昇判定ロジック
// 条件：登録者数 ≤ 20000 AND 再生数/登録者数 ≥ 0.3 AND 投稿日 直近1年以内
// ゼロ除算ガード・登録者数非公開ガードを必須実装。

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const SUBSCRIBER_THRESHOLD = 20000;
const ENGAGEMENT_THRESHOLD = 0.3;

const isTrending = (video) => {
  const api = video && video._tempApiData;
  if (!api) return false;

  const { subscriberCount, viewCount, publishedAt } = api;

  // null / undefined / 0 を一括 falsy 弾き（ゼロ除算ガード + 非公開ガード）
  if (!subscriberCount) return false;

  const engagementRate = viewCount / subscriberCount;
  const publishedDate = new Date(publishedAt);
  const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS);
  // 無効な日付（NaN）は比較が常に false になり isRecent=false → trending 除外される
  const isRecent = publishedDate >= oneYearAgo;

  return (
    subscriberCount <= SUBSCRIBER_THRESHOLD &&
    engagementRate >= ENGAGEMENT_THRESHOLD &&
    isRecent
  );
};

module.exports = { isTrending };
