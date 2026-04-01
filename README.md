# Buddy Generator

Re-roll your Claude Code `/buddy` companion. Pick what you want, get a seed, apply it.

```
  🥚 Buddy Generator

  Rarity:
     1. common    (60%)    2. uncommon  (25%)
     3. rare      (10%)    4. epic      (4%)
     5. legendary (1%)
  > 5

  Species:
     1. duck       2. goose      3. blob       4. cat
     5. dragon     6. octopus    7. owl        8. penguin
     ...
  > 5

  Shiny? (1% chance) [y/N] > y

  Searching...

  Match #1 after 108,263 attempts (0.0s)
  ┌────────────────────────────────────────┐
  │ ★★★★★ LEGENDARY         DRAGON        │
  │               (   )                    │
  │             /^\  /^\                   │
  │            <  ✦  ✦  >                  │
  │            (   ~~   )                  │
  │             `-vvvv-´                   │
  │  ✨ SHINY ✨                            │
  │  DEBUGGING  █████░░░░░  48             │
  │  PATIENCE   █████████░  89             │
  │  WISDOM     ██████████ 100             │
  └────────────────────────────────────────┘

  Which one do you want?
     1. legendary dragon shiny hat:halo eye:✦
     2. legendary dragon shiny hat:crown eye:°
     3. legendary dragon shiny hat:wizard eye:×
     0. none (exit)
  > 1

  Done! Restart Claude Code and run /buddy hatch
```

## Install

Requires [Bun](https://bun.sh) — the same runtime Claude Code uses. Node.js produces wrong results.

```bash
curl -fsSL https://bun.sh/install | bash
```

## Usage

```bash
# Interactive — walk through menus, pick your favorite, auto-apply
bun buddy.js

# CLI — specify traits directly
bun buddy.js --species dragon --rarity legendary --shiny

# Inspect what you currently have
bun buddy.js --current

# Check what any seed produces
bun buddy.js --check <uuid-or-hex>

# Apply a seed from a previous search
bun buddy.js --apply <seed>
```

After applying, restart Claude Code and run `/buddy hatch`.

## How it works

Claude Code derives companion traits (species, rarity, stats, shiny, hat, eyes) deterministically from a seed string. Only the name and personality come from an LLM call during hatching.

```
seed + "friend-2026-401"  →  Bun.hash (wyhash)  →  SplitMix32 PRNG  →  traits
```

The seed is read from your config at runtime:

```
oauthAccount.accountUuid  ??  userID  ??  "anon"
```

Most users authenticate via OAuth, so the seed is `accountUuid` (a UUID). API-key users fall back to `userID` (a 64-char hex string). This tool detects which one you have and generates seeds in the matching format.

## Traits

| | Options |
|---|---|
| **Species** | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| **Rarity** | common 60%, uncommon 25%, rare 10%, epic 4%, legendary 1% |
| **Shiny** | 1% independent of rarity |
| **Eyes** | `·` `✦` `×` `◉` `@` `°` |
| **Hats** | crown, tophat, propeller, halo, wizard, beanie, tinyduck (common = none) |
| **Stats** | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |

## CLI reference

```
bun buddy.js [options]

Modes:
  (no flags)           Interactive — menus + auto-apply
  --check <seed>       Show traits for a seed
  --current            Show your current companion
  --apply <seed>       Write seed to config (backs up first)

Filters (for non-interactive search):
  --species <name>     Filter by species
  --rarity <tier>      Filter by exact rarity
  --eye <char>         Filter by eye style
  --hat <name>         Filter by hat
  --shiny              Require shiny

Options:
  --format uuid|hex    Override seed format (default: auto-detect)
  --max <n>            Max search iterations (default: 10M)
  --count <n>          Results to find (default: 3)
```

## Notes

- **Auth refresh**: Claude Code may overwrite `accountUuid` on token renewal. Re-apply if your companion reverts.
- **Name/personality**: LLM-generated during `/buddy hatch` — not controlled by the seed.
- **Tested on**: Claude Code 2.1.89. Salt or algorithm may change in future versions.

## License

MIT
