# Sprint 0 — 管理者による手動タスクチェックリスト

Sprint 0 の Exit Criteria のうち、Claude が自動実行できない・実行すべきでない手動タスクをここに集約する。
すべてチェックが入ったら Sprint 1 に進める。

---

## ① 検索クエリ24本の人手検証（FR-06）

`data/categories.json` の全クエリ（2カテゴリ × 12ジャンル = 24本）を実際に YouTube で検索し、
**注文住宅初心者にとって意図通りの動画が返ってくるか**を目視で確認する。

### 確認手順
1. 各クエリを https://www.youtube.com/results?search_query=... にコピペして上位10件を眺める
2. 以下の観点で許容可否を判断：
   - 注文住宅に関連する内容か（無関係な動画が混ざりすぎていないか）
   - スパム的・誇大広告的なチャンネルが上位を独占していないか
   - 「施主目線/専門家目線」の意図に沿っているか
3. 問題のあるクエリは `searchQuery` または `searchQueryAlt` を `data/categories.json` で調整する

### チェックリスト

#### CAT-01 施主目線

- [ ] GNR-01 間取り：`注文住宅 間取り 施主 体験談`
- [ ] GNR-02 外壁：`注文住宅 外壁 施主 選び方`
- [ ] GNR-03 屋根：`注文住宅 屋根 施主 選び方`
- [ ] GNR-04 風呂：`注文住宅 お風呂 施主 体験談`
- [ ] GNR-05 トイレ：`注文住宅 トイレ 施主 体験談`
- [ ] GNR-06 キッチン：`注文住宅 キッチン 施主 体験談`
- [ ] GNR-07 床：`注文住宅 床材 施主 体験談`
- [ ] GNR-08 リビング：`注文住宅 リビング 施主 体験談`
- [ ] GNR-09 ダイニング：`注文住宅 ダイニング 施主 体験談`
- [ ] GNR-10 照明計画：`注文住宅 照明 施主 体験談`
- [ ] GNR-11 庭：`注文住宅 外構 庭 施主 体験談`
- [ ] GNR-12 ランドリールーム：`注文住宅 ランドリールーム 施主 体験談`

#### CAT-02 専門家目線

- [ ] GNR-01 間取り：`注文住宅 間取り 設計士 プロ`
- [ ] GNR-02 外壁：`注文住宅 外壁 工務店 おすすめ`
- [ ] GNR-03 屋根：`注文住宅 屋根 工務店 おすすめ`
- [ ] GNR-04 風呂：`注文住宅 お風呂 設計士 おすすめ`
- [ ] GNR-05 トイレ：`注文住宅 トイレ 設計士 おすすめ`
- [ ] GNR-06 キッチン：`注文住宅 キッチン 設計士 おすすめ`
- [ ] GNR-07 床：`注文住宅 床材 工務店 おすすめ`
- [ ] GNR-08 リビング：`注文住宅 リビング 設計士 間取り`
- [ ] GNR-09 ダイニング：`注文住宅 ダイニング 設計士 おすすめ`
- [ ] GNR-10 照明計画：`注文住宅 照明計画 設計士 解説`
- [ ] GNR-11 庭：`注文住宅 外構 工務店 おすすめ`
- [ ] GNR-12 ランドリールーム：`注文住宅 ランドリールーム 設計士 解説`

---

## ② GitHub Pages の有効化

リポジトリ設定変更（外部に見える操作）のため、ユーザー本人が GitHub の Web UI で実施する。

### 手順
1. https://github.com/inumaru-kazuya/takomaru-tool-YoutubeHouseMap/settings/pages を開く
2. **Source** を `Deploy from a branch` に設定
3. **Branch** を `main` / フォルダを `/docs` に設定
4. `Save` をクリック
5. 1〜2分後に表示される公開URL（`https://inumaru-kazuya.github.io/takomaru-tool-YoutubeHouseMap/`）にアクセスし、
   「Hello World — Sprint 0 基盤構築中」と免責フッターが表示されることを確認

### チェック
- [ ] GitHub Pages が有効化された
- [ ] 公開URLで `docs/index.html` の内容が表示される

---

## ③ Sprint 0 Exit Criteria 最終確認

- [x] `npm test` 全GREEN（22ケース：UT-03 + UT-04 + SEC）  ← 自動確認済み
- [x] `npx playwright test --list` で3プロジェクト認識  ← 自動確認済み
- [x] Playwright スモークテスト 3/3 PASS（chromium-desktop / chromium-mobile / boundary-768） ← 自動確認済み
- [x] `git log -p` にAPIキー混入なし  ← 自動確認済み
- [ ] **検索クエリ24本の人手検証完了**（上記 ①）
- [ ] **GitHub Pages で Hello World 表示**（上記 ②）

すべて ✅ になったら Sprint 1（UIプロトタイプ・アニメーション）に進める。

---

> このファイルは Sprint 0 専用の一時チェックリスト。Sprint 5 で本格的な `OPERATION.md` を作成する際に統合・削除予定。
