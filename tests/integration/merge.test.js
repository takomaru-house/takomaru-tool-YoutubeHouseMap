const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { mergeDraft } = require('../../src/admin/merge');
const { writeJsonAtomic } = require('../../src/utils/fileUtils');

const makeVideo = (overrides = {}) => ({
  videoId: 'autoXXXXXXX',
  title: 'auto video',
  channelName: 'auto ch',
  thumbnailUrl: 'https://img.youtube.com/vi/autoXXXXXXX/hqdefault.jpg',
  publishedAt: '2025-06-01',
  duration: 'PT10M',
  tags: [],
  source: 'auto',
  status: 'active',
  order: 1,
  ...overrides,
});

const makeManual = (videoId) =>
  makeVideo({
    videoId,
    source: 'manual',
    tags: ['manual'],
    title: `manual ${videoId}`,
  });

// 3階層コンテナ：CAT-01 / GRP-A / GNR-01
const makeContainer = (videos) => ({
  meta: { last_updated: '2026-05-20', schema_version: '1.2' },
  categories: [
    {
      id: 'CAT-01',
      name: '施主目線',
      groups: [
        {
          id: 'GRP-A',
          name: '計画・間取り',
          genres: [{ id: 'GNR-01', name: '間取り', videos }],
        },
      ],
    },
  ],
});

describe('IT-02: draft → 本番マージフロー (v1.2 3階層)', () => {
  test('IT-02-01: 承認後に draft の auto 内容が videos.json に反映される', () => {
    const prev = makeContainer([]);
    const draft = makeContainer([
      makeVideo({ videoId: 'draftA00001' }),
      makeVideo({ videoId: 'draftB00002' }),
    ]);

    const merged = mergeDraft(prev, draft);

    const ids = merged.categories[0].groups[0].genres[0].videos.map((v) => v.videoId);
    expect(ids).toEqual(['draftA00001', 'draftB00002']);
  });

  test('IT-02-02: マージ後も manual 動画が保持される（最重要）', () => {
    const prev = makeContainer([makeManual('manualAAAAAA'), makeManual('manualBBBBBB')]);
    const draft = makeContainer([
      makeVideo({ videoId: 'draftA00001' }),
      makeVideo({ videoId: 'draftB00002' }),
    ]);

    const merged = mergeDraft(prev, draft);
    const videos = merged.categories[0].groups[0].genres[0].videos;
    const sources = videos.map((v) => v.source);
    const ids = videos.map((v) => v.videoId);

    expect(ids).toContain('manualAAAAAA');
    expect(ids).toContain('manualBBBBBB');
    expect(sources.filter((s) => s === 'manual')).toHaveLength(2);
  });

  test('IT-02-03: マージ後に draft の auto 動画が正しく上書き反映される', () => {
    const prev = makeContainer([
      makeVideo({ videoId: 'autoOld0001', title: 'old title' }),
    ]);
    const draft = makeContainer([
      makeVideo({ videoId: 'autoOld0001', title: 'new title from draft' }),
    ]);

    const merged = mergeDraft(prev, draft);
    const target = merged.categories[0].groups[0].genres[0].videos.find(
      (v) => v.videoId === 'autoOld0001'
    );
    expect(target.title).toBe('new title from draft');
  });

  test('IT-02-04: prev で dead 状態だった動画は draft の auto 更新後も dead を保持', () => {
    const prev = makeContainer([
      makeVideo({ videoId: 'deadVideo01', status: 'dead' }),
    ]);
    const draft = makeContainer([
      makeVideo({ videoId: 'deadVideo01', status: 'active', title: 'draft refresh' }),
    ]);

    const merged = mergeDraft(prev, draft);
    const target = merged.categories[0].groups[0].genres[0].videos.find(
      (v) => v.videoId === 'deadVideo01'
    );
    expect(target.status).toBe('dead');
    expect(target.title).toBe('draft refresh');
  });

  test('IT-02-05: マージ結果がアトミック書き込みで永続化できる（writeJsonAtomic 経由）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'merge-atomic-'));
    const targetPath = path.join(tmpDir, 'videos.json');
    try {
      const prev = makeContainer([makeManual('keepManual1')]);
      const draft = makeContainer([makeVideo({ videoId: 'draftA00001' })]);
      const merged = mergeDraft(prev, draft);

      await writeJsonAtomic(targetPath, merged);

      const written = JSON.parse(await fs.readFile(targetPath, 'utf-8'));
      const ids = written.categories[0].groups[0].genres[0].videos.map((v) => v.videoId);
      expect(ids).toContain('keepManual1');
      expect(ids).toContain('draftA00001');
      await expect(fs.access(targetPath + '.tmp')).rejects.toThrow();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
