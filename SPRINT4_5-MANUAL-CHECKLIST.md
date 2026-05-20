# Sprint 4.5 — 構造改修（3階層 + 左右マインドマップ）動作確認チェックリスト

スキーマ v1.1 → **v1.2** 破壊的変更。カテゴリ → グループ → ジャンル の3階層化、
マインドマップを「専門家目線 左 / 施主目線 右」の左右分割レイアウトに。

---

## ① ローカル動作確認

```bash
npm run build && npm run serve
# → http://localhost:8080 で公開サイトを起動
```

### PC（幅 ≥ 768px）
- [ ] マインドマップで **中央 ROOT** から左右に分岐
- [ ] 左側：**専門家目線 (CAT-02)** の枝
- [ ] 右側：**施主目線 (CAT-01)** の枝
- [ ] 各カテゴリの直下に 4 グループ（計画・間取り / 水回り / 外装 / 内装・設備）
- [ ] 各グループから 2〜4 ジャンルへ分岐
- [ ] **水回りグループ**に風呂・トイレ・キッチン・ランドリールームの4葉
- [ ] ジャンルノードクリックでサイドパネル表示（既存挙動）
- [ ] ズーム・パン・リセット動作

### モバイル（幅 < 768px）
- [ ] アコーディオン 3階層表示：
  - Lv1：カテゴリ
  - Lv2：グループ（インデント・色違い）
  - Lv3：ジャンル（さらにインデント）
- [ ] それぞれ 300ms ease-in-out アニメ
- [ ] 動画 0 件のジャンル・グループは非表示

## ② 本番（GitHub Pages）

```bash
git push origin main
# → 1〜2分後に https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/ に反映
```

- [ ] PC で左右分割マインドマップを確認
- [ ] モバイル（スマホ）でアコーディオン 3階層を確認

## ③ 管理画面（npm run admin）

- [ ] 動画一覧が `カテゴリ → グループ → ジャンル` の3階層で表示される
- [ ] 件数ハイライト（赤<5 / 黄<8）がジャンル単位で表示
- [ ] 動画手動追加に **カテゴリ・グループ・ジャンル** の3プルダウン
- [ ] カテゴリ変更でグループ選択肢が更新
- [ ] グループ変更でジャンル選択肢が更新
- [ ] 動画追加・削除・並び替え動作

---

## ④ Sprint 4.5 Exit Criteria 自動確認

- [x] **schema_version = "1.2"** に更新
- [x] `data/categories.json`：4グループ × ジャンル12 = 24クエリ構造
- [x] `data/videos.json` + `docs/data/videos.json`：3階層化
- [x] Jest **110/110 GREEN**（dedup/batch/merge/admin-api/build/schema/security/fileUtils/validation/formatDuration）
- [x] Playwright **57/57 PASS**（responsive/public-site/video-card/accessibility × 3 projects）
- [x] カバレッジ：Statements 95.5% / Lines 98.8% / Functions 97.9% / Branches 70.7%
- [x] axe-playwright 違反 0 件
- [x] `npm run build` 動作確認

---

## ✅ Sprint 5 進行可否

①〜③ が確認できれば **Sprint 5（品質・仕上げ・運用ドキュメント）** に進む。

> このファイルは Sprint 4.5 専用の一時チェックリスト。Sprint 5 で `OPERATION.md` に統合・削除予定。
