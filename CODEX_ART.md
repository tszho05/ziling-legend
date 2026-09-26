# Codex 美術任務：《字靈傳說》精靈素材

> 給 Codex 閱讀並執行。請用 `$generate2dsprite` 逐項生成下面的素材，處理成透明背景精靈表後，存到指定路徑。
> 遊戲會自動載入 `assets/sprites/` 裏的 PNG，取代目前的佔位圖，不需要改任何程式。

## 1. 專案背景

- 這是給小學四年級學生玩的 HD-2D 成語學習 JRPG（參考《歧路旅人》），網頁版，用 Three.js。
- 故事：每個成語都是守護「墨香鎮」的字靈；亂字魔把字靈打散，主角（字靈守護者的後人）向鎮民學回成語，最後打倒亂字魔。
- 鏡頭：俯角 18°、偏航 0°、翻滾 0°、FOV 32°，所以角色是「略帶俯視的正面／側面」。
- 地面、房屋、樹木是 3D 模型，**不用生成**。只生成角色、怪物和特效。

## 2. 統一風格（每張圖的提示都要包含）

```
hand-painted HD 2D fantasy game sprite, clean painterly shading with soft outlines, NOT pixel art,
cute 3-head-tall proportions (head about one third of total height), medieval fantasy,
warm bright cheerful palette, soft warm sunlight from upper left,
friendly look suitable for 10-year-old children, no text, no watermark
```

- generate2dsprite 參數：`art_style = clean_hd`，背景用預設的純洋紅 `#FF00FF`，之後去背。
- **同一角色的所有表要一致**：先為每個角色生成一張正面參考圖並確認，之後該角色的每張表都用這張圖做參考（reference = generated_image）。

## 3. 輸出規格（遊戲讀取方式，務必遵守）

- 輸出格式：**透明背景 PNG**，路徑見下表。
- 遊戲把整張圖**平均切成 cols × rows 格**，按「由左至右、由上至下」順序播放；所以每格大小必須完全相同，格與格之間不要留白線、不要標籤、不要邊框。
- 建議每格：角色與怪物 **256×256 px**；頭目 **384×384 px**；特效 **256×256 px**。
- **腳底對齊**：`anchor = feet`，腳底放在每格底邊往上約 4% 的位置，所有影格的腳底在同一條線上；主體佔格高約 85%，左右置中，任何部分都不可超出格子。
- 行走表（walk）：**4 列 × 4 欄**，列的順序固定為 **第 1 列向下（面向鏡頭）、第 2 列向左、第 3 列向右、第 4 列向上（背面）**，每列 4 格是一個走路循環。這正是 generate2dsprite `player_sheet` 的輸出順序。
- 戰鬥表（battle_idle / battle_attack）：**2×2**，側面，**英雄面向左**。攻擊表只畫身體和武器，**不要**包含刀光、火焰、箭矢等特效（特效另外生成）。攻擊表用 `scale_strategy = preserve`、`align = feet`，身體大小要和待機表一致。
- 怪物與頭目：**2×2** 待機循環，側面，**面向右**。
- NPC：**2×2** 待機循環（輕微呼吸／眨眼），面向鏡頭。
- 特效：**2×2**，四格是由開始到消失的過程。

## 4. 素材清單（共 23 張）

### 英雄（3 個職業，每個 3 張）

| 路徑 | 類型 | 格數 | 角色描述 |
|---|---|---|---|
| assets/sprites/hero_swordsman_walk.png | player_sheet 行走 | 4×4 | 少年劍士（男）：紅色短披風、皮革輕甲、長劍掛腰間、棕色短髮 |
| assets/sprites/hero_swordsman_battle_idle.png | idle，側面面向左 | 2×2 | 同一劍士，雙手持劍備戰 |
| assets/sprites/hero_swordsman_battle_attack.png | attack，側面面向左 | 2×2 | 同一劍士，舉劍向左下斬 |
| assets/sprites/hero_mage_walk.png | player_sheet 行走 | 4×4 | 少女法師（女）：深藍長袍、寬邊尖帽、頂端鑲藍寶石的木法杖 |
| assets/sprites/hero_mage_battle_idle.png | idle，側面面向左 | 2×2 | 同一法師，舉杖備戰 |
| assets/sprites/hero_mage_battle_attack.png | cast，側面面向左 | 2×2 | 同一法師，向左揮杖施法（不畫火焰） |
| assets/sprites/hero_archer_walk.png | player_sheet 行走 | 4×4 | 少女弓手（女）：綠色連帽斗篷、長弓、背上箭袋 |
| assets/sprites/hero_archer_battle_idle.png | idle，側面面向左 | 2×2 | 同一弓手，持弓備戰 |
| assets/sprites/hero_archer_battle_attack.png | shoot，側面面向左 | 2×2 | 同一弓手，向左拉弓放箭（不畫飛行中的箭） |

### 墨香鎮 NPC

| 路徑 | 格數 | 角色描述 |
|---|---|---|
| assets/sprites/npc_scholar.png | 2×2 | 學者：灰藍長袍、圓眼鏡、手捧古書 |
| assets/sprites/npc_merchant.png | 2×2 | 商人：大肚子、綠色圍裙、布帽、笑容滿面 |
| assets/sprites/npc_guard.png | 2×2 | 衛兵：銀色盔甲、手持長槍 |
| assets/sprites/npc_granny.png | 2×2 | 老婆婆：紫色披肩、白髮髻、木拐杖 |
| assets/sprites/npc_child.png | 2×2 | 小孩：約 8 歲、橙色短衣、活潑 |
| assets/sprites/npc_chief.png | 2×2 | 鎮長：白色長鬍子、深紅斗篷、手持捲軸 |

### 郊區怪物（側面，面向右，可愛不嚇人）

| 路徑 | 格數 | 描述 |
|---|---|---|
| assets/sprites/monster_slime.png | 2×2 | 史萊姆：半透明墨綠色果凍，身上有墨水斑點，彈跳待機 |
| assets/sprites/monster_wolf.png | 2×2 | 野狼：灰色、紅眼、低頭警戒 |
| assets/sprites/monster_goblin.png | 2×2 | 哥布林：綠皮膚、尖耳、破布衣、手持木棒、腋下夾着搶來的書 |
| assets/sprites/monster_boss.png | 2×2（每格 384） | 頭目「亂字魔」：一本巨大的黑紫色魔書，書頁張開像嘴巴，兩隻發紅光的眼睛，周圍飄浮着紫色的亂碼文字碎片，體型比其他怪物大很多；有威嚴但不要太恐怖 |

### 戰鬥特效

| 路徑 | 類型 | 格數 | 描述 |
|---|---|---|---|
| assets/sprites/fx_slash.png | fx | 2×2 | 白色帶淡金色的弧形刀光 |
| assets/sprites/fx_fire.png | impact | 2×2 | 火球命中的橙紅火焰爆炸 |
| assets/sprites/fx_arrow.png | projectile | 2×2 | 帶金色光尾的箭矢 |
| assets/sprites/fx_heal.png | fx | 2×2 | 綠色和金色光點由下往上升起 |

## 5. 建議次序

1. 先做 `hero_swordsman_walk.png`，完成後告訴使用者在瀏覽器重新整理試看，確認大小、腳底位置、風格都滿意再繼續。
2. 其餘英雄 → NPC → 怪物 → 頭目 → 特效。
3. 每張完成後做 QC：格數正確、每格同大、主體沒有碰到格邊、腳底對齊、背景完全透明（沒有洋紅殘邊）。

## 6. 可選：更流暢的行走（6 格）

4 格行走在遊戲中已經足夠（另外程式會加上輕微上下彈動）。如果使用者想更流暢：
- 每個方向各生成一張 **2×3（6 格）** 行走表，分別 QC；
- 再把四個方向按 下、左、右、上 組合成 **4 列 × 6 欄** 的單一 PNG，存到同一路徑；
- 並把 `js/data/assets.js` 裏對應的 `cols: 4` 改成 `cols: 6`。

## 7. 大小微調

如角色在遊戲中太大或太小、或浮在半空，改 `js/data/assets.js` 對應項目的 `height`（整格高度，單位是地磚）或 `feet`（腳底離格子底邊的比例），不要重新生成圖。
