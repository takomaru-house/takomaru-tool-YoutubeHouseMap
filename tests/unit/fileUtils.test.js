const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { writeJsonAtomic } = require('../../src/utils/fileUtils');

describe('writeJsonAtomic()', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'writeJsonAtomic-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('UT-03-01: 正常なデータが正しくファイルに書き込まれる', async () => {
    const filePath = path.join(tmpDir, 'output.json');
    const data = { foo: 'bar', count: 3 };

    await writeJsonAtomic(filePath, data);

    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual(data);
  });

  test('UT-03-02: 一時ファイル（.tmp）が書き込み後に存在しない', async () => {
    const filePath = path.join(tmpDir, 'output.json');
    const tmpPath = filePath + '.tmp';

    await writeJsonAtomic(filePath, { ok: true });

    await expect(fs.access(tmpPath)).rejects.toThrow();
  });

  test('UT-03-03: 書き込み中断後に元ファイルが破損していない', async () => {
    const filePath = path.join(tmpDir, 'existing.json');
    const original = { original: true };
    await fs.writeFile(filePath, JSON.stringify(original), 'utf-8');

    const spy = jest
      .spyOn(fs, 'writeFile')
      .mockRejectedValueOnce(new Error('simulated write failure'));

    await expect(writeJsonAtomic(filePath, { updated: true })).rejects.toThrow();

    spy.mockRestore();

    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual(original);
  });

  test('UT-03-04: 日本語文字列を含むJSONが正しく書き込まれる', async () => {
    const filePath = path.join(tmpDir, 'japanese.json');
    const data = { title: '注文住宅 間取り', channel: 'マイホームちゃんねる🏠' };

    await writeJsonAtomic(filePath, data);

    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content)).toEqual(data);
  });

  test('UT-03-05: 書き込み先ディレクトリが存在しない場合にエラーをthrow', async () => {
    const filePath = path.join(tmpDir, 'no', 'such', 'dir', 'output.json');

    await expect(writeJsonAtomic(filePath, { x: 1 })).rejects.toThrow();
  });
});
