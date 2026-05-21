# OPERATION.md — 注文住宅YouTube動画マップ 運用マニュアル

管理者向け運用手順をまとめたドキュメント。日常運用・障害対応・セキュリティ事故対応を一元化。

---

## 目次

1. [初期セットアップ（1回のみ）](#1-初期セットアップ1回のみ)
2. [月次更新フロー（標準運用）](#2-月次更新フロー標準運用)
3. [動画手動追加・削除（随時）](#3-動画手動追加削除随時)
4. [ブロックリスト管理](#4-ブロックリスト管理)
5. [カテゴリ・ジャンル構成変更](#5-カテゴリジャンル構成変更)
6. [死活チェック（任意）](#6-死活チェック任意)
7. [APIキー漏洩時の緊急対応](#7-apiキー漏洩時の緊急対応)
8. [障害対応・トラブルシューティング](#8-障害対応トラブルシューティング)
9. [品質計測（Lighthouse / クロスブラウザ）](#9-品質計測lighthouse--クロスブラウザ)

---

## 1. 初期セットアップ（1回のみ）

### 1.1 YouTube Data API キー取得

1. https://console.cloud.google.com でプロジェクト作成
2. APIs & Services → ライブラリ → **YouTube Data API v3** を有効化
3. 認証情報 → 「APIキー」作成
4. 作成後すぐに **APIキー制限**を設定（必須）：
   - **アプリケーションの制限**：制限なし（バッチ実行 PC が固定 IP でない場合）
   - **API の制限**：「キーを制限」→ YouTube Data API v3 のみ
5. ローカルに `.env` を作成：

```bash
cp .env.example .env
# .env を編集
```

```
YOUTUBE_API_KEY=AIzaSy...（取得したキー）
ADMIN_PORT=3000
```

> ⚠️ `.env` は `.gitignore` で除外済み。**絶対にコミットしない**。

### 1.2 GitHub Pages 有効化

1. https://github.com/inumaru-kazuya/takomaru-tool-YoutubeHouseMap/settings/pages
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/docs`
4. **Save** → 1〜2分後に `https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/` で公開

### 1.3 検索クエリ品質の人手検証

`data/categories.json` の各 `searchQuery` / `searchQueryAlt` を YouTube で実検索し、注文住宅初心者向けに適切な動画が返ってくるかを目視確認。問題があればクエリを修正。

---

## 2. 月次更新フロー（GitHub Actions で自動化済み）

### 2.1 自動化フロー

毎月 1 日 9:00 JST に **GitHub Actions が自動実行**：

```
GitHub Actions cron (毎月1日 09:00 JST)
        ↓
  npm run batch（YouTube Data API 呼び出し）
        ↓
  data/videos.draft.json 生成
        ↓
  Sanity check（動画数 ≥ 50 件）
        ↓
  mergeDraft（manual 動画保護）→ data/videos.json
        ↓
  npm run build → docs/data/videos.json
        ↓
  git commit & push origin main
        ↓
  GitHub Pages 自動デプロイ
```

ワークフロー定義：`.github/workflows/monthly-batch.yml`

### 2.2 事前準備（1回のみ）

**GitHub Secrets に APIキー登録**：

1. https://github.com/inumaru-kazuya/takomaru-tool-YoutubeHouseMap/settings/secrets/actions を開く
2. **「New repository secret」**
3. Name: `YOUTUBE_API_KEY`
4. Secret: `.env` ファイルの値と同じ APIキー
5. **Save**

> ⚠️ Secrets はリポジトリ管理者だけが見られる。GitHub Actions 実行時のみ環境変数として渡される（ログ・コードベースには表示されない）

### 2.3 手動実行（任意のタイミングで）

定期 cron を待たずに即実行したい場合：

1. https://github.com/inumaru-kazuya/takomaru-tool-YoutubeHouseMap/actions/workflows/monthly-batch.yml を開く
2. 右上の **「Run workflow」** ボタン
3. **「Run workflow」** 確定

数分後にコミット・デプロイ完了。

### 2.4 異常検知

Sanity check で **動画数が 50 件未満** の場合、job は fail し **マージは行われません**（公開データは前回のまま）：
- API クォータ枯渇
- 検索クエリの誤設定
- 閾値（再生数 ≥ 3000 等）が厳しすぎる

の可能性。`Actions` タブでログ確認 → 原因特定。

### 2.5 ローカル手動実行（緊急時のみ）

GitHub Actions が使えない・部分修正したい場合は、従来通りローカルから：

```bash
npm run admin   # 管理 UI 起動（任意：差分プレビュー用）
npm run batch   # バッチ実行 → draft 生成
# 管理UIで承認 → 自動マージ → ビルド → デプロイ
```

### 2.99 詳細手順（ローカル手動実行）

> 通常は GitHub Actions 自動実行で完結。以下はローカルから運用する場合の参考手順。

#### Step 1: 管理 UI 起動

```bash
npm run admin
# → http://127.0.0.1:3000 を開く（localhost 限定で公開）
```

#### Step 2: バッチ実行

「▶ バッチ実行（draft 生成）」ボタンを押下。
- 24 クエリ（2カテゴリ × 12ジャンル）の API 呼び出し（約 2,900 unit / 1日無料枠 10,000 unit の29%）
- 約 30 秒〜1 分で完了
- 件数不足ジャンル（< 8 件）が WARN ログに出る

#### Step 3: draft レビュー

「バッチ結果プレビュー」セクションに差分が表示される：
- `[+ 新規]` 新たに追加される動画
- `[更新]` 既存 auto 動画の更新

#### Step 4: 承認 or 差し戻し

- **承認**：`data/videos.json` にマージ。**manual 動画は保護**される（draft に混入していないため）。
- **差し戻し**：`data/videos.draft.json` を破棄、`videos.json` は変更なし。

#### Step 5: ビルド

承認後、コマンドラインで：

```bash
npm run build
# → docs/data/videos.json が更新される
```

#### Step 6: デプロイ

```bash
git add data/videos.json docs/data/videos.json
git commit -m "Monthly update: YYYY-MM"
git push origin main
```

1〜2 分後に GitHub Pages に反映される。

### 2.3 公開後の確認

- https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/ で表示確認
- タブ切替（専門家目線 / 施主目線）が動作する
- マインドマップのジャンルをクリック→動画カードが表示される

### 2.4 自動チェック（任意）

```bash
BASE_URL=https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/ \
  npx playwright test public-site.spec.js responsive.spec.js tabs.spec.js
```

39/39 PASS で本番動作確認完了。

---

## 3. 動画手動追加・削除（随時）

### 3.1 手動追加

管理 UI（`npm run admin`）の「動画手動追加」フォームから：
1. YouTube URL（`https://www.youtube.com/watch?v=...` / 短縮URL `https://youtu.be/...`）または 11文字 videoID を入力
2. カテゴリ・グループ・ジャンルを選択
3. 「⭐ manual 動画として追加」をクリック

`source: "manual"` / `tags: ["manual"]` が自動付与され、**月次バッチで上書きされません**。

### 3.2 削除・並び替え

動画一覧の各行で：
- 「↑」「↓」ボタンで順序変更
- 「削除」ボタンで削除（確認ダイアログあり）

`data/videos.json` に即時反映、ビルド後に公開サイトへ反映。

---

## 4. ブロックリスト管理

不適切な動画・チャンネルをブロックリストに追加すると、**月次バッチで除外**されます。

管理 UI 「ブロックリスト」セクションで：
- **種別**：チャンネルID / videoID を選択
- **ID**：YouTube の channelId（`UCxxxx...`）または videoId（11文字）を入力
- 「追加」で `data/categories.json` の `globalSettings.blockedChannelIds` / `blockedVideoIds` に保存

削除も一覧の「削除」ボタンから可能。

> 既に `videos.json` に取り込まれた動画は手動削除が必要（自動で消えるわけではない）。

---

## 5. カテゴリ・ジャンル構成変更

`data/categories.json` を直接編集し、`data/videos.json` の構造も同期する必要があります。**スキーマを変える場合は schema_version も上げる**（v1.2 → v1.3 など）。

### 5.1 検索クエリの変更

`searchQuery` / `searchQueryAlt` のみの変更なら影響範囲は次回バッチのみ。`videos.json` 修正不要。

### 5.2 新規ジャンル追加

`categories.json` に追加 → 次回バッチで自動的に新ジャンルへの取得が始まる。
`videos.json` にも空ジャンル `{ "id": "GNR-XX", "name": "...", "videos": [] }` を追加することを推奨。

---

## 6. 死活チェック（任意）

削除・非公開になった動画を検出して `status: "dead"` を付与。`build.js` で公開データから除外される。

```bash
# 例：videos.json の全動画IDで実行
node -e "
const fs = require('fs');
const { checkHealth } = require('./src/batch/health');
require('dotenv').config();
const data = JSON.parse(fs.readFileSync('./data/videos.json', 'utf-8'));
const ids = data.categories.flatMap(c => c.groups.flatMap(g => g.genres.flatMap(gn => gn.videos.map(v => v.videoId))));
checkHealth(ids, { apiKey: process.env.YOUTUBE_API_KEY, logDir: 'logs' })
  .then(r => console.log('dead:', r.deadIds));
"
```

結果は `logs/health-YYYY-MM-DD.log` に保存。dead 動画は管理 UI から手動削除推奨。

---

## 7. APIキー漏洩時の緊急対応

`.env` を誤ってコミットした、ログに表示された、共有 PC に残った 等の場合：

### 即時対応（5 分以内）

1. **Google Cloud Console** → 該当 API キー を **削除 or 無効化**
   - https://console.cloud.google.com/apis/credentials
2. **新しい API キーを発行**し、API制限を再設定
3. ローカル `.env` を新キーで上書き

### git 履歴から完全削除（コミット済みの場合）

```bash
# 漏洩したコミットを特定
git log --all -p | grep -E "AIza[0-9A-Za-z_-]{30,}"

# BFG Repo-Cleaner or git filter-repo で履歴書き換え
# 例: BFG
java -jar bfg.jar --replace-text passwords.txt .git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force --all
```

> ⚠️ `git push --force` はリモート履歴を書き換える破壊的操作。GitHub 上の他のクローン保持者にも影響することを通知。

### 確認

```bash
# git 全履歴で APIキーパターンが検出されないこと
git log --all -p | grep -E "AIza[0-9A-Za-z_-]{30,}" || echo "[OK] No API keys"
```

自動テスト SEC-01〜SEC-04 が全て GREEN であることも確認。

---

## 8. 障害対応・トラブルシューティング

### 8.1 公開サイトが 404

- GitHub Pages 設定が無効化された可能性
- リポジトリ Settings → Pages で `Source: main / /docs` を確認
- 一度別ブランチに切替 → main に戻すと再ビルドされる場合あり

### 8.2 JSONロード失敗

公開サイトで「データの読み込みに失敗しました」表示：
- `docs/data/videos.json` が壊れている可能性 → `npm run build` で再生成
- ブラウザコンソールでネットワークエラーを確認
- 5秒タイムアウトの場合は GitHub Pages の応答遅延

### 8.3 バッチが API クォータエラー

「quotaExceeded」エラーが返る場合：
- 1日の無料枠 10,000 unit を消費した
- Google Cloud Console で次の日まで待機
- または有料プラン検討（個人用途なら不要）

### 8.4 バッチが特定ジャンルだけ取得失敗

- searchQuery を変更（より一般的な単語に）
- searchQueryAlt が機能しているか確認
- 該当ジャンルの動画が YouTube 上で本当に少ない場合は時間を置いて再実行

### 8.5 manual 動画が消えた

通常は起こりませんが、確認：
- `git log -p data/videos.json` で履歴を確認
- バックアップから復元（`git checkout HEAD~1 -- data/videos.json`）
- 自動テスト `IT-02-02` で manual 保護を再検証

### 8.6 死活チェックで誤って active 動画が dead に

`videos.list` API 制限の可能性。`logs/health-YYYY-MM-DD.log` で詳細確認。
誤判定なら手動で `data/videos.json` の `status: "dead"` → `"active"` に戻し、`writeJsonAtomic` 経由で書き込み（管理 UI からはできないので直接編集 + コミット）。

---

## 9. 品質計測（Lighthouse / クロスブラウザ）

### 9.1 Lighthouse スコア確認

Chrome DevTools → Lighthouse → Generate report：

| 指標 | 目標 | 現状想定 |
|---|---|---|
| Performance | ≥ 80 | 静的サイトなので 90+ 想定 |
| Accessibility | ≥ 80 | axe-playwright 0 違反なので 90+ 想定 |
| Best Practices | ≥ 80 | — |
| SEO | ≥ 80 | meta / OGP / Twitter Card 設定済 |

### 9.2 クロスブラウザ確認

公開URL を以下のブラウザで確認（タブ切替・マインドマップ・アコーディオン・動画カード）：

- [ ] Chrome（最新）
- [ ] Safari（Mac）
- [ ] Firefox（最新）
- [ ] iPhone Safari
- [ ] Android Chrome

問題があれば Issue 化。

### 9.3 自動テスト最終実行

```bash
bash scripts/run-tests.sh
```

または個別に：

```bash
npm test                  # Jest 111 ケース
npx playwright test       # Playwright 66 ケース × 3 projects
npm run test:coverage     # カバレッジ確認
```

カバレッジ目標：Statements ≥ 85%（現状 95.5%）。

---

## 参考

- 設計仕様：`01-要求/Spec.md`
- 実装指示書：`CLAUDE.md`
- テスト計画：`02-テスト/02-テスト計画.md`
