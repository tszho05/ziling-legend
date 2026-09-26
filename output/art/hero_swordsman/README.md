# 劍士行走表

依 `CODEX_ART.md` 製作；所有角色原畫與姿勢修正均使用內建 `image_gen`，Python 只作去背清理、等比例縮放、切格、對齊和匯出。

## 遊戲交付

- 正式檔案：`../../../assets/sprites/hero_swordsman_walk.png`
- 1024×1024 RGBA PNG，4 列 × 4 欄，每格 256×256。
- 列序：下、左、右、上；每方向四格，現有遊戲以 8 fps 播放。
- 所有格子的腳底邊界為 y=246，底部透明留白 10 px（3.90625%），符合遊戲預設 feet=0.04。
- 所有格子使用同一縮放比例，主體高度 201–217 px；沒有逐格縮放。
- 已檢查透明背景、格數、方向、換腳姿勢、完整輪廓、落地線與洋紅殘邊。零空格、零碰邊、零裁切、零洋紅殘邊；原始主體尺度 CV 約 0.0335。
- 遊戲程式與美術清單不需修改。仍需使用者重新整理遊戲，確認在實際場景中的大小和風格。

## 可重用參考與來源

- `reference.png`：已通過本次造型檢查的正面角色參考，後續劍士戰鬥動畫應沿用。
- `reference-initial-prompt.txt`、`reference-prompt.txt`：正面參考的生成與三頭身修正提示詞。
- `walk-prompt.txt`：四方向行走表提示詞。
- `walk-correction-prompt.txt`：側面擺臂和步伐修正提示詞。
- `back-step-prompt.txt`：最後一格背面換腳修正提示詞。
- `generated-sheet.png`：修正側面後的完整生成原圖。
- `back-step-before.png`、`back-step-corrected.png`：背面第四格修正前後。
- `source-assembled.png`：把修正後背面格按完整畫布比例縮回 313×313，替換第四列第四格；清除 alpha<8 的不可見雜點。原圖 1254×1254，切格使用左上 1252×1252；剩餘右側／底部 2 px 為透明背景。
- `draft-qc/`：淘汰的初稿，僅供追溯，不能作為交付素材。
- `processed/`：技能處理器輸出，腳底尚在預設留白位置。
- `delivery/`：最終 16 個影格、透明表、四方向條帶／GIF、合併預覽、接觸表與 `qc.json`。

## 後處理

先以 generate2dsprite 技能的 `scripts/generate2dsprite.py process` 處理 `source-assembled.png`，參數為：

```text
--target player --mode player_sheet --output-dir processed
--cell-size 256 --fit-scale 0.85 --align feet --shared-scale
--component-mode largest --trim-border 0 --edge-clean-depth 0
--strict-qc --max-body-scale-cv 0.08 --max-anchor-y-std 0.05
--duration 125 --prompt-file walk-prompt.txt
```

再執行 `finalize_walk.py --processor <generate2dsprite.py 的絕對路徑>`，保持同一尺度，把影格向下平移 9 px 到遊戲落地線，檢查輸出並存入正式路徑。`delivery/qc.json` 記錄最後的包圍框及留白。

`delivery/walk-preview.webp` 以每格 125 ms 顯示四方向並排；GIF 預覽交替使用 120/130 ms，以配合 GIF 的時間精度。正式遊戲使用 PNG，播放速度由現有程式控制。
