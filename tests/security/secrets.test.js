const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const walkFiles = (dir, predicate, results = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, results);
    } else if (predicate(entry.name, fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
};

describe('セキュリティチェック', () => {
  test('SEC-01: docs/ディレクトリにAPIキーまたはYouTube APIエンドポイントが含まれていない', () => {
    const docsDir = path.join(PROJECT_ROOT, 'docs');
    const files = walkFiles(docsDir, (name) =>
      /\.(js|html|css)$/i.test(name)
    );
    const API_KEY_PATTERN = /AIza[0-9A-Za-z_-]{30,}/;
    const GOOGLE_API_PATTERN = /googleapis\.com/;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(API_KEY_PATTERN);
      expect(content).not.toMatch(GOOGLE_API_PATTERN);
    }
  });

  test('SEC-02: .envファイルが.gitignoreに含まれている', () => {
    const gitignore = fs.readFileSync(
      path.join(PROJECT_ROOT, '.gitignore'),
      'utf-8'
    );
    expect(gitignore).toMatch(/^\.env(\s|$)/m);
  });

  test('SEC-03: data/videos.jsonに再生数・登録者数フィールドが存在しない', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'data', 'videos.json'),
      'utf-8'
    );
    expect(content).not.toMatch(/"viewCount"/);
    expect(content).not.toMatch(/"subscriberCount"/);
    expect(content).not.toMatch(/_tempApiData/);
  });
});
