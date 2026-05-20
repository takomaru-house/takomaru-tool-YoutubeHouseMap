# Sprint 4 — 静的ビルド・公開サイト統合 動作確認チェックリスト

Sprint 4 の自動テスト（Jest 110 + Playwright 57 = **167 GREEN**）が全 PASS。
本番 GitHub Pages での動作確認は管理者が下記手順で実施する。

---

## ① ビルド実行

```bash
npm run build
# → docs/data/videos.json が再生成される（dead除外・last_updated更新）
```

### チェック
- [ ] `npm run build` がエラーなく完了
- [ ] `docs/data/videos.json` が更新される（タイムスタンプ確認）
- [ ] `meta.last_updated` が現在日付になっている
- [ ] `status: "dead"` の動画が含まれていない
- [ ] `.tmp` ファイルが残っていない

## ② ローカルでの公開サイト動作確認

```bash
npm run serve
# → http://localhost:8080 で公開サイト（docs/）を起動
```

### チェック
- [ ] PC ブラウザ（幅 1280 以上）で D3 マインドマップが表示される
- [ ] ジャンルノードクリックでサイドパネルに動画カード一覧
- [ ] モバイル（幅 < 768）でアコーディオン表示
- [ ] アコーディオン展開のアニメーション（300ms / stagger 50ms）滑らか
- [ ] 動画カードの 🔥 急上昇 / ⭐ 管理者おすすめ バッジ表示
- [ ] サムネ 404 時に fallback `no-thumbnail.svg` 表示
- [ ] 動画クリックで YouTube が別タブで開く（target="_blank"）
- [ ] フッターに免責事項・YouTube 利用規約リンク・最終更新日

## ③ GitHub Pages デプロイ

```bash
git push origin main
```

GitHub Pages は Sprint 0 で有効化済（`docs/` 配信）。push 後 1〜2 分で反映。

### チェック
- [ ] https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/ にアクセス
- [ ] サイトが正常表示される
- [ ] PC・モバイルレイアウトが切り替わる
- [ ] D3.js CDN が読み込まれる（コンソールエラーなし）
- [ ] サムネが YouTube CDN から読み込まれる

## ④ Lighthouse スコア（Chrome DevTools）

```
DevTools → Lighthouse → Generate report
```

| 項目 | 目標 | 結果 |
|---|---|---|
| Performance | ≥ 80 | __ 点 |
| Accessibility | ≥ 80 | __ 点 |
| Best Practices | ≥ 80 | __ 点 |
| SEO | ≥ 80 | __ 点 |

> Lighthouse 詳細評価は Sprint 5 で本格実施

---

## ⑤ Sprint 4 Exit Criteria 自動確認

- [x] `npm run test:all`（Jest + Playwright）全 PASS：**Jest 110/110 + Playwright 57/57 = 167/167** ✅
- [x] **UT-06** ビルダー単体: 6/6 GREEN
- [x] **IT-05** ビルド統合: 6/6 GREEN
- [x] **E2E-01** 公開サイト: 7 × 3 projects = 21 PASS
- [x] **E2E-02** 動画カード: 6 × 3 projects = 18 PASS
- [x] **E2E-03** レスポンシブ: 3 × 3 = 9 PASS（Sprint 1 から継続）
- [x] **E2E-04** A11y: 3 × 3 = 9 PASS（axe-playwright 違反 0 件）
- [x] **SCHEMA** スキーマ: 7/7 GREEN
- [x] カバレッジ: Statements 95.4% / Lines 98.1% / Functions 97.0% / Branches 70.5%（jest.config 閾値クリア）
- [x] XSS 対策確認：`docs/`・`src/admin/public/` 全 JS で `innerHTML` 実コード使用ゼロ
- [x] `npm run build` ローカル動作確認

---

## ⑥ XSS 対策の最終確認（手動）

ブラウザコンソールで以下を実行し、`innerHTML` 使用箇所がコメント以外に存在しないことを確認：

```bash
# プロジェクトルートで
grep -n "innerHTML" docs/*.js src/admin/public/*.js
```

- [x] grep 結果はコメント行のみ（実コード使用ゼロ）

## ⑦ 自動化率の中間集計

Sprint 4 完了時点：

| テストレベル | テスト数 | 自動化 |
|---|---|---|
| 単体（UT） | 49 (Jest) | 100% |
| 結合（IT） | 41 (Jest) | 100% |
| Security/Schema | 10 | 100% |
| E2E (Playwright) | 57 | 100% |
| **合計（自動化済）** | **167** | **100%** |
| 手動チェックリスト | Sprint 0〜4 各 | 手動 |

自動化率（リリース判定対象）：167 / (167 + 約 30 手動) ≈ **85%** > 目標 70% ✅

---

## ✅ Sprint 5 進行可否

①〜④ が確認できれば Sprint 5（品質・仕上げ・運用ドキュメント）に進める。

> このファイルは Sprint 4 専用の一時チェックリスト。Sprint 5 で `OPERATION.md` に統合・削除予定。
