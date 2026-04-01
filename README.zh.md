# Buddy Generator

重新抽卡你的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `/buddy` 伙伴宠物。指定你想要的物种、稀有度、帽子、眼睛和闪光属性——工具会找到对应的种子值并写入你的配置。

## 什么是 `/buddy`？

Claude Code 2.1.89 版本引入了 `/buddy`——一个住在你终端里的虚拟伙伴。伙伴的所有特征（物种、稀有度、属性值、帽子、眼睛、闪光）都由你的账户身份确定性地派生，并非随机。这个工具通过寻找不同的种子值来重新抽卡。

## 快速开始

**需要 [Bun](https://bun.sh)**——Claude Code 内部使用 `Bun.hash`（wyhash 算法）。Node.js 会产生错误的结果。

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 获取工具
git clone https://github.com/chris-yyau/buddy-generator.git
cd buddy-generator

# 运行交互模式
bun buddy.js
```

交互模式会引导你选择特征、搜索匹配的种子，并自动应用：

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

搜索完成后，选择你最喜欢的结果，工具会自动应用。然后重启 Claude Code 并运行 `/buddy hatch`。

## 其他模式

```bash
# CLI 搜索——用参数指定特征
bun buddy.js --species dragon --rarity legendary --shiny

# 查看当前伙伴和配置中的种子字段
bun buddy.js --current

# 检查任意种子会产生什么
bun buddy.js --check 9ab738bf-fb82-40fb-917d-0020259c8408

# 手动应用种子（会先备份配置）
bun buddy.js --apply f853b71e-3774-4bc7-b4a8-4cc0ed266f9f
```

`--current` 输出示例：

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

## 运作原理

Claude Code 从单一种子字符串确定性地派生所有伙伴特征：

```
种子 + "friend-2026-401" → Bun.hash (wyhash) → SplitMix32 PRNG → 特征
```

种子从你的 `.claude.json` 配置文件中读取：

```
oauthAccount.accountUuid ?? userID ?? "anon"
```

| 认证方式 | 种子字段 | 格式 |
|---|---|---|
| OAuth 登录（大多数用户） | `oauthAccount.accountUuid` | UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) |
| API 密钥 | `userID` | 64 位十六进制字符串 |
| 都没有 | `"anon"` | 字面字符串 |

工具会自动检测你的配置使用哪个字段，并以匹配的格式生成种子。只有 `name`（名字）和 `personality`（性格）来自 `/buddy hatch` 时的 LLM 调用——其他一切都是种子的纯函数。

## 可用特征

| 特征 | 值 |
|---|---|
| **物种**（18 种） | duck（鸭）、goose（鹅）、blob（果冻）、cat（猫）、dragon（龙）、octopus（章鱼）、owl（猫头鹰）、penguin（企鹅）、turtle（龟）、snail（蜗牛）、ghost（幽灵）、axolotl（六角恐龙）、capybara（水豚）、cactus（仙人掌）、robot（机器人）、rabbit（兔）、mushroom（蘑菇）、chonk（胖墩） |
| **稀有度** | common 普通（60%）、uncommon 非凡（25%）、rare 稀有（10%）、epic 史诗（4%）、legendary 传说（1%） |
| **闪光** | 1% 概率，与稀有度独立 |
| **眼睛** | `·` `✦` `×` `◉` `@` `°` |
| **帽子** | crown（皇冠）、tophat（礼帽）、propeller（螺旋桨）、halo（光环）、wizard（巫师帽）、beanie（毛线帽）、tinyduck（小鸭子）。common 稀有度永远没有帽子 |
| **属性** | DEBUGGING（调试）、PATIENCE（耐心）、CHAOS（混乱）、WISDOM（智慧）、SNARK（毒舌）——属性点数随稀有度提升 |

## CLI 参考

```
bun buddy.js [选项]

模式：
  （无参数）             交互模式——菜单、搜索、选择、应用
  --check <seed>       查看一个种子值会产生什么特征
  --current            查看当前伙伴和种子来源
  --apply <seed>       将种子写入配置（会先备份）

筛选：
  --species <name>     目标物种
  --rarity <tier>      目标稀有度（精确匹配）
  --eye <char>         目标眼睛样式
  --hat <name>         目标帽子类型
  --shiny              要求闪光
  --min-stats <n>      要求所有属性 >= n

选项：
  --format uuid|hex    覆盖种子格式（默认：自动检测）
  --max <n>            最大搜索迭代次数（默认：10,000,000）
  --count <n>          要找到的结果数量（默认：3）
```

## 注意事项

- **认证刷新**：Claude Code 在刷新令牌时可能会覆盖 `accountUuid`。如果你的伙伴恢复原样，需要重新应用种子。
- **名字和性格**：这些是 `/buddy hatch` 时由 LLM 生成的——种子只控制物种、稀有度、属性、帽子、眼睛和闪光。
- **版本**：基于 Claude Code 2.1.89 逆向工程。盐值或算法可能在未来版本中改变。

## 许可证

MIT
