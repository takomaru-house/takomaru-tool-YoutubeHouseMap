# 🏠 注文住宅YouTube動画マップ

注文住宅を検討し始めた初心者向けに、YouTube動画をカテゴリ × グループ × ジャンル別にマッピングしてナビゲーションする Web サイト。

**公開URL**：https://takomaru-house.github.io/takomaru-tool-YoutubeHouseMap/

---

## 構成

- **公開サイト**（`docs/`）：GitHub Pages で配信する完全な静的サイト（HTML/CSS/Vanilla JS + D3.js）
- **ローカル管理ツール**（`src/`）：YouTube Data API バッチ取得 + 管理 Web UI + 静的ビルダー
- **データ**（`data/`）：カテゴリ定義 + 動画データ JSON（schema v1.2）

データフロー：
```
YouTube API ─[npm run batch]→ data/videos.draft.json
                                    ↓
                              管理UIで承認
                                    ↓
                              data/videos.json
                                    ↓
                            [npm run build]
                                    ↓
                       docs/data/videos.json ─[git push]→ GitHub Pages
```

## カテゴリ・グループ・ジャンル構造（schema v1.2）

| カテゴリ | グループ | ジャンル |
|---|---|---|
| 専門家目線（CAT-02）/ 施主目線（CAT-01）共通 | 計画・間取り（GRP-A）| 間取り / リビング / ダイニング |
| | 水回り（GRP-B）| 風呂 / トイレ / キッチン / ランドリールーム |
| | 外装（GRP-C）| 外壁 / 屋根 / 庭 |
| | 内装・設備（GRP-D）| 床 / 照明計画 |

公開サイトでは「専門家目線 / 施主目線」をタブで切替（初期：施主目線）。

## セットアップ

```bash
git clone https://github.com/takomaru-house/takomaru-tool-YoutubeHouseMap.git
cd takomaru-tool-YoutubeHouseMap
npm install
npx playwright install chromium

# 環境変数を設定（バッチ・管理UI でのみ必要、公開サイトでは不要）
cp .env.example .env
# .env を編集して YOUTUBE_API_KEY を設定（取得方法は OPERATION.md 参照）
```

要件：Node.js ≥ 18

## コマンド一覧

| コマンド | 用途 |
|---|---|
| `npm run batch` | YouTube API でデータ取得 → `data/videos.draft.json` 生成 |
| `npm run admin` | 管理 Web UI 起動（http://127.0.0.1:3000、localhost 限定） |
| `npm run build` | `data/videos.json` → `docs/data/videos.json` ビルド |
| `npm run serve` | 公開サイトをローカル起動（http://localhost:8080） |
| `npm test` | Jest（単体・結合・セキュリティ・スキーマ） |
| `npm run test:coverage` | カバレッジ付きテスト |
| `npm run test:e2e` | Playwright E2E |
| `npm run test:all` | Jest + Playwright 全実行 |
| `bash scripts/run-tests.sh` | 全テスト段階実行（CI想定） |

## 運用手順

月次バッチ実行・承認フロー・APIキー漏洩時対応・障害対応は **[OPERATION.md](./OPERATION.md)** を参照してください。

## 開発者向け

### ディレクトリ構成

```
/
├── docs/                       # GitHub Pages 配信
│   ├── index.html / style.css / app.js
│   ├── images/no-thumbnail.svg
│   └── data/videos.json        # ビルド生成物
├── src/
│   ├── batch/                  # npm run batch
│   │   ├── index.js  (runBatch)
│   │   ├── fetch.js  (YouTube API + リトライ)
│   │   ├── score.js  (急上昇判定)
│   │   ├── dedup.js  (重複排除)
│   │   └── health.js (死活チェック)
│   ├── builder/build.js        # npm run build
│   ├── admin/                  # npm run admin
│   │   ├── server.js  (Express, localhost限定)
│   │   ├── merge.js   (draft→本番マージ)
│   │   └── public/    (管理UI HTML/CSS/JS)
│   └── utils/                  # 共通ユーティリティ
├── data/
│   ├── categories.json         # カテゴリ・グループ・ジャンル定義
│   ├── videos.json             # 本番データ
│   └── videos.draft.json       # バッチ出力（承認前）
├── tests/
│   ├── unit/                   # Jest 単体
│   ├── integration/            # Jest 結合
│   ├── security/               # Jest セキュリティ
│   ├── schema/                 # Jest スキーマ検証
│   ├── e2e/                    # Playwright E2E
│   └── mocks/youtube-api.js
├── scripts/run-tests.sh
├── CLAUDE.md                   # 実装指示書（Sprint計画含む）
├── OPERATION.md                # 運用マニュアル
└── README.md                   # このファイル
```

### スキーマ v1.2 データ構造

```json
{
  "meta": { "last_updated": "YYYY-MM-DD", "schema_version": "1.2" },
  "categories": [
    {
      "id": "CAT-01", "name": "施主目線", "order": 2, "side": "right",
      "groups": [
        {
          "id": "GRP-A", "name": "計画・間取り", "order": 1,
          "genres": [
            {
              "id": "GNR-01", "name": "間取り", "order": 1,
              "videos": [
                {
                  "videoId": "...", "title": "...", "channelName": "...",
                  "thumbnailUrl": "https://img.youtube.com/vi/.../hqdefault.jpg",
                  "publishedAt": "YYYY-MM-DD", "duration": "PT15M30S",
                  "tags": ["trending"|"manual"], "source": "auto"|"manual",
                  "status": "active"|"dead", "order": 1
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### テスト品質

| 指標 | 値 |
|---|---|
| Jest テスト | 111 ケース全 GREEN |
| Playwright E2E | 66 ケース全 PASS（3 projects: chromium-desktop / chromium-mobile / boundary-768） |
| カバレッジ Statements | 95.5% |
| カバレッジ Lines | 98.8% |
| axe-playwright A11y 違反 | 0 件 |
| エッジケース対応 | 16/16（うち14件自動・2件手動） |

### コントリビュート

実装方針は `CLAUDE.md` を参照（12 ルール + Sprint 計画 + データスキーマ）。

## ライセンス

UNLICENSED（個人運営・非商用）

## 法的事項

本サイトは Google および YouTube とは無関係の独立したサービスです。
動画の権利は各動画制作者に帰属します。
Powered by YouTube Data API。
