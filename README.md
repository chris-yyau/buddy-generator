# Buddy Generator

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
