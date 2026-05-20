const { isTrending } = require('../../src/batch/score');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * ONE_DAY_MS).toISOString();

const makeVideo = (overrides = {}) => ({
  videoId: 'abcDEF12345',
  title: 't',
  channelName: 'c',
  _tempApiData: {
    subscriberCount: 10000,
    viewCount: 5000,
    publishedAt: daysAgo(30),
  },
  ...overrides,
});

describe('isTrending()', () => {
  test('UT-01-01: 急上昇条件を全て満たす動画はtrue', () => {
    const v = makeVideo();
    expect(isTrending(v)).toBe(true);
  });

  test('UT-01-02: 登録者数ちょうど20000人はtrue（境界値）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 20000,
        viewCount: 6000,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(true);
  });

  test('UT-01-03: エンゲージメント率ちょうど0.3はtrue（境界値）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 10000,
        viewCount: 3000,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(true);
  });

  test('UT-01-04: 投稿日が364日前はtrue（境界値内）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 10000,
        viewCount: 5000,
        publishedAt: daysAgo(364),
      },
    });
    expect(isTrending(v)).toBe(true);
  });

  test('UT-01-05: 登録者数0はfalse（ゼロ除算ガード）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 0,
        viewCount: 10000,
        publishedAt: daysAgo(30),
      },
    });
    expect(() => isTrending(v)).not.toThrow();
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-06: 登録者数nullはfalse（非公開ガード）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: null,
        viewCount: 50000,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-07: 登録者数undefinedはfalse（非公開ガード）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: undefined,
        viewCount: 50000,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-08: 登録者数20001人はfalse（境界値超え）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 20001,
        viewCount: 10000,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-09: エンゲージメント率0.29はfalse（境界値未満）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 10000,
        viewCount: 2900,
        publishedAt: daysAgo(30),
      },
    });
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-10: 投稿日が366日前はfalse（境界値超え）', () => {
    const v = makeVideo({
      _tempApiData: {
        subscriberCount: 10000,
        viewCount: 5000,
        publishedAt: daysAgo(366),
      },
    });
    expect(isTrending(v)).toBe(false);
  });

  test('UT-01-11: _tempApiDataが存在しない場合はfalse', () => {
    const v = { videoId: 'abcDEF12345', title: 't', channelName: 'c' };
    expect(() => isTrending(v)).not.toThrow();
    expect(isTrending(v)).toBe(false);
  });
});
