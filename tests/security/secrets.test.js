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

  test('SEC-04: ブラウザ実行JSで innerHTML を使用していない（XSS対策・E-14）', () => {
    // チャンネル名や動画タイトルなど外部データを innerHTML 経由で挿入すると XSS リスク
    // 全ブラウザ JS で textContent / DOM API のみ使用していることを静的検査
    const targetFiles = [
      path.join(PROJECT_ROOT, 'docs', 'app.js'),
      path.join(PROJECT_ROOT, 'src', 'admin', 'public', 'admin.js'),
    ];
    for (const file of targetFiles) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // 行頭コメント、ブロックコメント中の // / * は除外
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        // コード中の innerHTML 使用は許可しない
        expect(line).not.toMatch(/\.innerHTML\s*=/);
      }
    }
  });
});
