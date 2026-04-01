# Buddy Generator

[English](#buddy-generator) | [繁體中文](#buddy-generator-中文)

Re-roll your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` companion pet. Choose the species, rarity, hat, eyes, and shininess you want — the tool finds a seed that produces it and writes it to your config.

## What is `/buddy`?

Claude Code 2.1.89 introduced `/buddy` — a virtual companion that lives in your terminal. Your companion's traits (species, rarity, stats, hat, eyes, shiny) are deterministically derived from your account identity, not random. This tool lets you re-roll those traits by finding a different seed value.

## Quick start

**Requires [Bun](https://bun.sh)** — Claude Code uses `Bun.hash` (wyhash) internally. Node.js will produce wrong results.

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Get the tool
git clone https://github.com/chris-yyau/buddy-generator.git
cd buddy-generator

# Run interactive mode
bun buddy.js
```

The interactive mode walks you through selecting traits, searches for a matching seed, and applies it:

```
  🥚 Buddy Generator

  Current: legendary dragon (shiny) via oauthAccount.accountUuid

  Rarity:
     0. any
     1. common    (60%)
     2. uncommon  (25%)
     3. rare      (10%)
     4. epic      (4%)
     5. legendary (1%)
  > 5

  Species:
     0. any
     1. duck          2. goose         3. blob
     4. cat           5. dragon        6. octopus
     7. owl           8. penguin       9. turtle
    10. snail        11. ghost        12. axolotl
    13. capybara     14. cactus       15. robot
    16. rabbit       17. mushroom     18. chonk
  > 5

  Shiny? (1% chance) [y/N]
  > y

  Hat:
     0. any
     1. crown
     2. tophat
     ...
  > 0

  Eye:
     0. any
     ...
  > 0

  Target: legendary  shiny  dragon

  Start searching? [y/N]
  > y
```

After the search completes, you pick your favorite result and the tool applies it automatically. Then restart Claude Code and run `/buddy hatch`.

## Other modes

```bash
# CLI search — specify traits as flags
bun buddy.js --species dragon --rarity legendary --shiny

# See your current companion and which config field is the seed
bun buddy.js --current

# Check what any seed produces
bun buddy.js --check 9ab738bf-fb82-40fb-917d-0020259c8408

# Manually apply a seed (backs up your config first)
bun buddy.js --apply f853b71e-3774-4bc7-b4a8-4cc0ed266f9f
```

Example `--current` output:

```
  Config:     ~/.claude.json
  Seed field: oauthAccount.accountUuid
  Seed value: 9ab738bf-fb82-40fb-917d-0020259c8408
  Format:     uuid
  Name:       Picklevein

  ┌────────────────────────────────────────┐
  │ ★★★★★ LEGENDARY         DRAGON        │
  │                                        │
  │                \^^^/                   │
  │               /^\  /^\                 │
  │              <  ◉  ◉  >                │
  │              (   ~~   )                │
  │               `-vvvv-´                 │
  │                                        │
  │  ✨ SHINY ✨                            │
  │                                        │
  │  DEBUGGING  █████████░  87             │
  │  PATIENCE   ████░░░░░░  44             │
  │  CHAOS      ████████░░  76             │
  │  WISDOM     ██████████ 100             │
  │  SNARK      ████████░░  78             │
  └────────────────────────────────────────┘
```

## How it works

Claude Code derives all companion traits deterministically from a single seed string:

```
seed + "friend-2026-401" → Bun.hash (wyhash) → SplitMix32 PRNG → traits
```

The seed is read from your `.claude.json` config:

```
oauthAccount.accountUuid ?? userID ?? "anon"
```

| Auth method | Seed field | Format |
|---|---|---|
| OAuth login (most users) | `oauthAccount.accountUuid` | UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) |
| API key | `userID` | 64-char hex string |
| Neither | `"anon"` | literal string |

The tool auto-detects which field your config uses and generates seeds in the matching format. Only `name` and `personality` come from an LLM call during `/buddy hatch` — everything else is a pure function of the seed.

## Available traits

| Trait | Values |
|---|---|
| **Species** (18) | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| **Rarity** | common (60%), uncommon (25%), rare (10%), epic (4%), legendary (1%) |
| **Shiny** | 1% chance, independent of rarity |
| **Eyes** | `·` `✦` `×` `◉` `@` `°` |
| **Hats** | crown, tophat, propeller, halo, wizard, beanie, tinyduck (common rarity always has no hat) |
| **Stats** | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK — stat budget scales with rarity |

## CLI reference

```
bun buddy.js [options]

Modes:
  (no flags)           Interactive — menus, search, pick, apply
  --check <seed>       Show what traits a seed value produces
  --current            Show your current companion and seed source
  --apply <seed>       Write a seed to your config (backs up first)

Filters:
  --species <name>     Target species
  --rarity <tier>      Target rarity (exact match)
  --eye <char>         Target eye style
  --hat <name>         Target hat type
  --shiny              Require shiny
  --min-stats <n>      Require ALL stats >= n

Options:
  --format uuid|hex    Override seed format (default: auto-detect from config)
  --max <n>            Max search iterations (default: 10,000,000)
  --count <n>          Number of results to find (default: 3)
```

## Notes

- **Auth refresh**: Claude Code may overwrite `accountUuid` on token renewal. Re-apply if your companion reverts.
- **Name & personality**: These are LLM-generated during `/buddy hatch` — the seed only controls species, rarity, stats, hat, eyes, and shiny.
- **Version**: Reverse-engineered from Claude Code 2.1.89. The salt or algorithm may change in future versions.

## License

MIT

---

# Buddy Generator 中文

重新抽卡你的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` 夥伴寵物。指定你想要的物種、稀有度、帽子、眼睛和閃光屬性——工具會找到對應的種子值並寫入你的配置。

## 什麼是 `/buddy`？

Claude Code 2.1.89 版本引入了 `/buddy`——一個住在你終端裡的虛擬夥伴。夥伴的所有特徵（物種、稀有度、屬性值、帽子、眼睛、閃光）都由你的帳戶身份確定性地派生，並非隨機。這個工具透過尋找不同的種子值來重新抽卡。

## 快速開始

**需要 [Bun](https://bun.sh)**——Claude Code 內部使用 `Bun.hash`（wyhash 演算法）。Node.js 會產生錯誤的結果。

```bash
# 安裝 Bun
curl -fsSL https://bun.sh/install | bash

# 取得工具
git clone https://github.com/chris-yyau/buddy-generator.git
cd buddy-generator

# 執行互動模式
bun buddy.js
```

互動模式會引導你選擇特徵、搜尋匹配的種子，並自動套用：

```
  🥚 Buddy Generator

  Current: legendary dragon (shiny) via oauthAccount.accountUuid

  Rarity:
     0. any
     1. common    (60%)
     2. uncommon  (25%)
     3. rare      (10%)
     4. epic      (4%)
     5. legendary (1%)
  > 5

  Species:
     0. any
     1. duck          2. goose         3. blob
     4. cat           5. dragon        6. octopus
     7. owl           8. penguin       9. turtle
    10. snail        11. ghost        12. axolotl
    13. capybara     14. cactus       15. robot
    16. rabbit       17. mushroom     18. chonk
  > 5

  Shiny? (1% chance) [y/N]
  > y

  Hat:
     0. any
     1. crown
     2. tophat
     ...
  > 0

  Eye:
     0. any
     ...
  > 0

  Target: legendary  shiny  dragon

  Start searching? [y/N]
  > y
```

搜尋完成後，選擇你最喜歡的結果，工具會自動套用。然後重啟 Claude Code 並執行 `/buddy hatch`。

## 其他模式

```bash
# CLI 搜尋——用參數指定特徵
bun buddy.js --species dragon --rarity legendary --shiny

# 查看當前夥伴和配置中的種子欄位
bun buddy.js --current

# 檢查任意種子會產生什麼
bun buddy.js --check 9ab738bf-fb82-40fb-917d-0020259c8408

# 手動套用種子（會先備份配置）
bun buddy.js --apply f853b71e-3774-4bc7-b4a8-4cc0ed266f9f
```

`--current` 輸出範例：

```
  Config:     ~/.claude.json
  Seed field: oauthAccount.accountUuid
  Seed value: 9ab738bf-fb82-40fb-917d-0020259c8408
  Format:     uuid
  Name:       Picklevein

  ┌────────────────────────────────────────┐
  │ ★★★★★ LEGENDARY         DRAGON        │
  │                                        │
  │                \^^^/                   │
  │               /^\  /^\                 │
  │              <  ◉  ◉  >                │
  │              (   ~~   )                │
  │               `-vvvv-´                 │
  │                                        │
  │  ✨ SHINY ✨                            │
  │                                        │
  │  DEBUGGING  █████████░  87             │
  │  PATIENCE   ████░░░░░░  44             │
  │  CHAOS      ████████░░  76             │
  │  WISDOM     ██████████ 100             │
  │  SNARK      ████████░░  78             │
  └────────────────────────────────────────┘
```

## 運作原理

Claude Code 從單一種子字串確定性地派生所有夥伴特徵：

```
種子 + "friend-2026-401" → Bun.hash (wyhash) → SplitMix32 PRNG → 特徵
```

種子從你的 `.claude.json` 配置檔中讀取：

```
oauthAccount.accountUuid ?? userID ?? "anon"
```

| 認證方式 | 種子欄位 | 格式 |
|---|---|---|
| OAuth 登入（大多數使用者） | `oauthAccount.accountUuid` | UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) |
| API 金鑰 | `userID` | 64 位十六進位字串 |
| 都沒有 | `"anon"` | 字面字串 |

工具會自動偵測你的配置使用哪個欄位，並以匹配的格式產生種子。只有 `name`（名字）和 `personality`（性格）來自 `/buddy hatch` 時的 LLM 呼叫——其他一切都是種子的純函數。

## 可用特徵

| 特徵 | 值 |
|---|---|
| **物種**（18 種） | duck（鴨）、goose（鵝）、blob（果凍）、cat（貓）、dragon（龍）、octopus（章魚）、owl（貓頭鷹）、penguin（企鵝）、turtle（龜）、snail（蝸牛）、ghost（幽靈）、axolotl（六角恐龍）、capybara（水豚）、cactus（仙人掌）、robot（機器人）、rabbit（兔）、mushroom（蘑菇）、chonk（胖墩） |
| **稀有度** | common 普通（60%）、uncommon 非凡（25%）、rare 稀有（10%）、epic 史詩（4%）、legendary 傳說（1%） |
| **閃光** | 1% 機率，與稀有度獨立 |
| **眼睛** | `·` `✦` `×` `◉` `@` `°` |
| **帽子** | crown（皇冠）、tophat（禮帽）、propeller（螺旋槳）、halo（光環）、wizard（巫師帽）、beanie（毛線帽）、tinyduck（小鴨子）。common 稀有度永遠沒有帽子 |
| **屬性** | DEBUGGING（除錯）、PATIENCE（耐心）、CHAOS（混亂）、WISDOM（智慧）、SNARK（毒舌）——屬性點數隨稀有度提升 |

## CLI 參考

```
bun buddy.js [選項]

模式：
  （無參數）             互動模式——選單、搜尋、選擇、套用
  --check <seed>       查看一個種子值會產生什麼特徵
  --current            查看當前夥伴和種子來源
  --apply <seed>       將種子寫入配置（會先備份）

篩選：
  --species <name>     目標物種
  --rarity <tier>      目標稀有度（精確匹配）
  --eye <char>         目標眼睛樣式
  --hat <name>         目標帽子類型
  --shiny              要求閃光
  --min-stats <n>      要求所有屬性 >= n

選項：
  --format uuid|hex    覆蓋種子格式（預設：自動偵測）
  --max <n>            最大搜尋迭代次數（預設：10,000,000）
  --count <n>          要找到的結果數量（預設：3）
```

## 注意事項

- **認證刷新**：Claude Code 在刷新令牌時可能會覆寫 `accountUuid`。如果你的夥伴恢復原樣，需要重新套用種子。
- **名字和性格**：這些是 `/buddy hatch` 時由 LLM 產生的——種子只控制物種、稀有度、屬性、帽子、眼睛和閃光。
- **版本**：基於 Claude Code 2.1.89 逆向工程。鹽值或演算法可能在未來版本中改變。

## 許可證

MIT
