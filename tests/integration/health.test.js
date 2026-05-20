const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const nock = require('nock');

const { checkHealth } = require('../../src/batch/health');
const {
  YOUTUBE_API_BASE,
  YOUTUBE_API_PATH,
  makeVideosListPartial,
} = require('../mocks/youtube-api');

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-test-'));
});

afterEach(async () => {
  nock.cleanAll();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('IT-03: 死活チェック統合テスト', () => {
  test('IT-03-01: 存在しない動画IDに status:"dead" が付与される', async () => {
    const aliveIds = ['aliveAAAAAA', 'aliveBBBBBB'];
    const deadIds = ['deadXXXXXXX', 'deadYYYYYYY'];
    const requested = [...aliveIds, ...deadIds];

    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosListPartial(aliveIds));

    const result = await checkHealth(requested, {
      apiKey: 'test-key',
      logDir: tmpDir,
      now: new Date('2026-05-20T00:00:00Z'),
    });

    expect(result.deadIds.sort()).toEqual(deadIds.sort());
  });

  test('IT-03-02: 存在する動画IDの status は "active" のまま（dead に含まれない）', async () => {
    const ids = ['aliveAAAAAA', 'aliveBBBBBB'];
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosListPartial(ids));

    const result = await checkHealth(ids, {
      apiKey: 'test-key',
      logDir: tmpDir,
      now: new Date('2026-05-20T00:00:00Z'),
    });

    expect(result.deadIds).toEqual([]);
  });

  test('IT-03-03: health-YYYY-MM-DD.log が生成される', async () => {
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosListPartial([]));

    await checkHealth(['ghostXXXXXX'], {
      apiKey: 'test-key',
      logDir: tmpDir,
      now: new Date('2026-05-20T00:00:00Z'),
    });

    const logPath = path.join(tmpDir, 'health-2026-05-20.log');
    const stat = await fs.stat(logPath);
    expect(stat.isFile()).toBe(true);
  });

  test('IT-03-04: ログに dead 動画一覧が記録される', async () => {
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosListPartial(['aliveAAAAAA']));

    await checkHealth(['aliveAAAAAA', 'deadXXXXXXX', 'deadYYYYYYY'], {
      apiKey: 'test-key',
      logDir: tmpDir,
      now: new Date('2026-05-20T00:00:00Z'),
    });

    const logPath = path.join(tmpDir, 'health-2026-05-20.log');
    const log = await fs.readFile(logPath, 'utf-8');
    expect(log).toMatch(/deadXXXXXXX/);
    expect(log).toMatch(/deadYYYYYYY/);
  });

  test('IT-03-05: 全動画が dead の場合も例外がスローされない', async () => {
    nock(YOUTUBE_API_BASE)
      .get(`${YOUTUBE_API_PATH}/videos`)
      .query(true)
      .reply(200, makeVideosListPartial([]));

    const allDeadIds = ['deadAAAAAAA', 'deadBBBBBBB', 'deadCCCCCCC'];
    await expect(
      checkHealth(allDeadIds, {
        apiKey: 'test-key',
        logDir: tmpDir,
        now: new Date('2026-05-20T00:00:00Z'),
      })
    ).resolves.not.toThrow();

    const logPath = path.join(tmpDir, 'health-2026-05-20.log');
    const log = await fs.readFile(logPath, 'utf-8');
    expect(log).toBeTruthy();
  });
});
