// docs/data/videos.json が公開用スキーマ v1.1 に準拠していることを検証
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PUBLISHED_PATH = path.join(PROJECT_ROOT, 'docs', 'data', 'videos.json');

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DURATION_RE = /^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/;
const ALLOWED_STATUS = new Set(['active', 'dead']);
const ALLOWED_SOURCE = new Set(['auto', 'manual']);

const loadPublished = () => JSON.parse(fs.readFileSync(PUBLISHED_PATH, 'utf-8'));

const collectAllVideos = (data) => {
  const videos = [];
  for (const c of data.categories || []) {
    for (const g of c.genres || []) {
      for (const v of g.videos || []) videos.push(v);
    }
  }
  return videos;
};

describe('SCHEMA: 公開用 docs/data/videos.json スキーマ準拠', () => {
  test('SCHEMA-01: ルートに meta と categories を持つ', () => {
    const data = loadPublished();
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('categories');
    expect(Array.isArray(data.categories)).toBe(true);
  });

  test('SCHEMA-02: 全 videoId が 11 文字の正規表現に一致する', () => {
    const data = loadPublished();
    for (const v of collectAllVideos(data)) {
      expect(v.videoId).toMatch(VIDEO_ID_RE);
    }
  });

  test('SCHEMA-03: 全 publishedAt が YYYY-MM-DD 形式である', () => {
    const data = loadPublished();
    for (const v of collectAllVideos(data)) {
      expect(v.publishedAt).toMatch(DATE_RE);
    }
  });

  test('SCHEMA-04: 全 duration が ISO 8601（PT...）形式である', () => {
    const data = loadPublished();
    for (const v of collectAllVideos(data)) {
      expect(v.duration).toMatch(DURATION_RE);
    }
  });

  test('SCHEMA-05: 全 status が "active" または "dead"', () => {
    const data = loadPublished();
    for (const v of collectAllVideos(data)) {
      expect(ALLOWED_STATUS.has(v.status)).toBe(true);
    }
  });

  test('SCHEMA-06: 全 source が "auto" または "manual"', () => {
    const data = loadPublished();
    for (const v of collectAllVideos(data)) {
      expect(ALLOWED_SOURCE.has(v.source)).toBe(true);
    }
  });

  test('SCHEMA-07: schema_version が "1.1"', () => {
    const data = loadPublished();
    expect(data.meta.schema_version).toBe('1.1');
  });
});
