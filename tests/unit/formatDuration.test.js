const { formatDuration } = require('../../docs/app.js');

describe('formatDuration()', () => {
  test('UT-05-01: PT15M30S → "15:30"', () => {
    expect(formatDuration('PT15M30S')).toBe('15:30');
  });

  test('UT-05-02: PT1H5M30S → "1:05:30"', () => {
    expect(formatDuration('PT1H5M30S')).toBe('1:05:30');
  });

  test('UT-05-03: PT5M0S → "5:00"', () => {
    expect(formatDuration('PT5M0S')).toBe('5:00');
  });

  test('UT-05-04: PT30S → "0:30"', () => {
    expect(formatDuration('PT30S')).toBe('0:30');
  });

  test('UT-05-05: PT0S → "0:00"（エッジケース）', () => {
    expect(formatDuration('PT0S')).toBe('0:00');
  });

  test('UT-05-06: 不正フォーマットは "--:--" を返す', () => {
    expect(formatDuration('15分30秒')).toBe('--:--');
    expect(formatDuration('')).toBe('--:--');
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(undefined)).toBe('--:--');
    expect(formatDuration('PT')).toBe('--:--');
  });
});
