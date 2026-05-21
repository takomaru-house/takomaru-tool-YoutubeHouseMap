const {
  validateVideoId,
  validatePublishedAt,
  validateDuration,
  parseDurationSeconds,
} = require('../../src/utils/validation');

describe('validateVideoId()', () => {
  test('UT-04-01: 11文字の英数字はtrue', () => {
    expect(validateVideoId('abcDEF12345')).toBe(true);
  });

  test('UT-04-02: ハイフン・アンダーバーを含む11文字はtrue', () => {
    expect(validateVideoId('abc-DEF_123')).toBe(true);
  });

  test('UT-04-03: 10文字はfalse（短すぎ）', () => {
    expect(validateVideoId('abcDEF1234')).toBe(false);
  });

  test('UT-04-04: 12文字はfalse（長すぎ）', () => {
    expect(validateVideoId('abcDEF123456')).toBe(false);
  });

  test('UT-04-05: 記号を含む11文字はfalse', () => {
    expect(validateVideoId('abc!DEF1234')).toBe(false);
  });

  test('UT-04-06: 空文字はfalse', () => {
    expect(validateVideoId('')).toBe(false);
  });

  test('UT-04-07: nullはfalse', () => {
    expect(validateVideoId(null)).toBe(false);
  });
});

describe('validatePublishedAt()', () => {
  test('UT-04-08: YYYY-MM-DD形式はtrue', () => {
    expect(validatePublishedAt('2024-01-01')).toBe(true);
  });

  test('UT-04-09: YYYY/MM/DD形式はfalse', () => {
    expect(validatePublishedAt('2024/01/01')).toBe(false);
  });

  test('UT-04-10: 存在しない日付（2024-02-30）はfalse', () => {
    expect(validatePublishedAt('2024-02-30')).toBe(false);
  });
});

describe('validateDuration()', () => {
  test('UT-04-11: PT15M30S形式はtrue', () => {
    expect(validateDuration('PT15M30S')).toBe(true);
  });

  test('UT-04-12: PT1H5M30S形式はtrue（時間含む）', () => {
    expect(validateDuration('PT1H5M30S')).toBe(true);
  });

  test('UT-04-13: PT30S形式はtrue（分なし）', () => {
    expect(validateDuration('PT30S')).toBe(true);
  });

  test('UT-04-14: 不正な文字列はfalse', () => {
    expect(validateDuration('15分30秒')).toBe(false);
  });
});

describe('parseDurationSeconds()', () => {
  test('UT-04-15: PT15M30S → 930 秒', () => {
    expect(parseDurationSeconds('PT15M30S')).toBe(930);
  });

  test('UT-04-16: PT1H5M30S → 3930 秒（時間含む）', () => {
    expect(parseDurationSeconds('PT1H5M30S')).toBe(3930);
  });

  test('UT-04-17: PT45S → 45 秒（Shorts相当）', () => {
    expect(parseDurationSeconds('PT45S')).toBe(45);
  });

  test('UT-04-18: PT4M0S → 240 秒（最低基準ちょうど）', () => {
    expect(parseDurationSeconds('PT4M0S')).toBe(240);
  });

  test('UT-04-19: PT40M0S → 2400 秒（最大基準ちょうど）', () => {
    expect(parseDurationSeconds('PT40M0S')).toBe(2400);
  });

  test('UT-04-20: 不正フォーマットは 0 を返す', () => {
    expect(parseDurationSeconds('15分30秒')).toBe(0);
    expect(parseDurationSeconds('PT')).toBe(0);
    expect(parseDurationSeconds('')).toBe(0);
    expect(parseDurationSeconds(null)).toBe(0);
    expect(parseDurationSeconds(undefined)).toBe(0);
  });
});
