// 死活チェック：YouTube Data API videos.list で動画IDの存在確認
// レスポンスに含まれない videoId は dead として認識し、ログを出力する

const fs = require('fs').promises;
const path = require('path');
const { withRetry } = require('./fetch');

const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

const formatDateYYYYMMDD = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildLogContent = (deadIds, dateStr, totalCount) => {
  const lines = [
    `[${dateStr}] 死活チェック実行`,
    `総数: ${totalCount}件 / dead: ${deadIds.length}件`,
    '',
    deadIds.length > 0 ? '【削除・非公開になった動画】' : '【削除・非公開動画なし】',
    ...deadIds.map((id) => `- ${id}`),
    '',
  ];
  return lines.join('\n');
};

const fetchVideosListIds = async (videoIds, apiKey, sleep) => {
  const u = new URL(VIDEOS_URL);
  u.searchParams.set('part', 'id');
  u.searchParams.set('id', videoIds.join(','));
  u.searchParams.set('key', apiKey);
  const res = await fetch(u.toString());
  /* istanbul ignore if : 同等分岐は fetch.js の fetchJSON 経由で IT-01-07/08 でカバー済み */
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status} ${VIDEOS_URL}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const checkHealth = async (videoIds, options) => {
  const { apiKey, logDir, now = new Date(), sleep } = options;

  const foundIds = new Set();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    if (batch.length === 0) continue;
    const data = await withRetry(
      () => fetchVideosListIds(batch, apiKey, sleep),
      { sleep }
    );
    for (const item of data.items || []) {
      foundIds.add(item.id);
    }
  }

  const deadIds = videoIds.filter((id) => !foundIds.has(id));

  const dateStr = formatDateYYYYMMDD(now);
  const logPath = path.join(logDir, `health-${dateStr}.log`);
  const logContent = buildLogContent(deadIds, dateStr, videoIds.length);
  await fs.writeFile(logPath, logContent, 'utf-8');

  return { deadIds, logPath };
};

module.exports = { checkHealth };
