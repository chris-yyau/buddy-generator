#!/usr/bin/env bun
// buddy.js — Re-roll your Claude Code /buddy companion
//
// Seed chain (from the 2.1.89 binary):
//   oauthAccount.accountUuid ?? userID ?? "anon"
//   + "friend-2026-401" → Bun.hash (wyhash) → SplitMix32 → traits
//
// Run without args for interactive mode, or pass --help for CLI usage.
// Requires Bun — Claude Code uses Bun.hash, not FNV-1a.

const fs = require("fs")
const path = require("path")
const os = require("os")

// ── Constants (extracted from Claude Code 2.1.89 binary) ──────────────────

const SALT = "friend-2026-401"

const SPECIES = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
]

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const EYES = ["·", "✦", "×", "◉", "@", "°"]
const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"]
const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"]
const STAT_BUDGETS = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }

const RARITY_STARS = {
  common: "★", uncommon: "★★", rare: "★★★", epic: "★★★★", legendary: "★★★★★",
}

// Species ASCII art — frame 0 only. {E} is replaced with the eye character.
const SPECIES_ART = {
  duck:      ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--´    "],
  goose:     ["            ", "     ({E}>    ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
  blob:      ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (      )  ", "   `----´   "],
  cat:       ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  ω  )   ", '  (")_(")   '],
  dragon:    ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-´  "],
  octopus:   ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
  owl:       ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   `----´   "],
  penguin:   ["            ", "  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---´     "],
  turtle:    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "  ``    ``  "],
  snail:     ["            ", " {E}    .--.  ", "  \\  ( @ )  ", "   \\_`--´   ", "  ~~~~~~~   "],
  ghost:     ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~`~``~`~  "],
  axolotl:   ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  ( .--. )  ", "  (_/  \\_)  "],
  capybara:  ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------´  "],
  cactus:    ["            ", " n  ____  n ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
  robot:     ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------´  "],
  rabbit:    ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", '  (")__(")  '],
  mushroom:  ["            ", " .-o-OO-o-. ", "(__________)","   |{E}  {E}|   ", "   |____|   "],
  chonk:     ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------´  "],
}

const HAT_ART = {
  none:      "",
  crown:     "   \\^^^/    ",
  tophat:    "   [___]    ",
  propeller: "    -+-     ",
  halo:      "   (   )    ",
  wizard:    "    /^\\     ",
  beanie:    "   (___)    ",
  tinyduck:  "    ,>      ",
}

// ── Hash & PRNG ───────────────────────────────────────────────────────────

function bunHash(s) {
  if (typeof Bun === "undefined") {
    console.error("Error: This tool requires Bun (https://bun.sh).")
    console.error("Claude Code uses Bun.hash (wyhash) — Node.js FNV-1a produces wrong results.")
    console.error("\nInstall: curl -fsSL https://bun.sh/install | bash")
    process.exit(1)
  }
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
}

// SplitMix32 — exact match of Claude Code binary
function splitmix32(seed) {
  let state = seed >>> 0
  return function () {
    state = (state + 0x6d2b79f5) | 0
    let q = Math.imul(state ^ (state >>> 15), 1 | state)
    q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function rollRarity(rng) {
  let roll = rng() * 100
  for (const r of RARITIES) {
    roll -= RARITY_WEIGHTS[r]
    if (roll < 0) return r
  }
  return "common"
}

function rollStats(rng, rarity) {
  const budget = STAT_BUDGETS[rarity]
  const primary = pick(rng, STAT_NAMES)
  let secondary = pick(rng, STAT_NAMES)
  while (secondary === primary) secondary = pick(rng, STAT_NAMES)
  const stats = {}
  for (const name of STAT_NAMES) {
    if (name === primary) stats[name] = Math.min(100, budget + 50 + Math.floor(rng() * 30))
    else if (name === secondary) stats[name] = Math.max(1, budget - 10 + Math.floor(rng() * 15))
    else stats[name] = budget + Math.floor(rng() * 40)
  }
  return stats
}

function rollCompanion(seed) {
  const rng = splitmix32(bunHash(seed + SALT))
  const rarity = rollRarity(rng)
  const species = pick(rng, SPECIES)
  const eye = pick(rng, EYES)
  const hat = rarity === "common" ? "none" : pick(rng, HATS)
  const shiny = rng() < 0.01
  const stats = rollStats(rng, rarity)
  return { rarity, species, eye, hat, shiny, stats }
}

// ── ID generation ─────────────────────────────────────────────────────────
// Uses Math.random for speed in the search loop — cryptographic strength
// is unnecessary since we just need distinct candidate strings.

const HEX_CHARS = "0123456789abcdef"

function randomUUID() {
  let s = ""
  for (let i = 0; i < 32; i++) s += HEX_CHARS[(Math.random() * 16) | 0]
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${HEX_CHARS[(Math.random() * 4 | 0) + 8]}${s.slice(17, 20)}-${s.slice(20, 32)}`
}

function randomHex64() {
  let s = ""
  for (let i = 0; i < 64; i++) s += HEX_CHARS[(Math.random() * 16) | 0]
  return s
}

// ── Display ───────────────────────────────────────────────────────────────

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const ITALIC = "\x1b[3m"
const SHINY_FG = "\x1b[93m"

const RARITY_COLORS = {
  common: "\x1b[90m",
  uncommon: "\x1b[32m",
  rare: "\x1b[35m",
  epic: "\x1b[33m",
  legendary: "\x1b[38;5;208m",
}

const CARD_W = 40

function statBar(value, width = 10) {
  const filled = Math.min(width, Math.round(value / 100 * width))
  return "█".repeat(filled) + "░".repeat(width - filled)
}

function padAnsi(text, width) {
  const visible = text.replace(/\x1b\[[0-9;]*m/g, "")
  return text + " ".repeat(Math.max(0, width - visible.length))
}

function renderBody(species, eye, hat) {
  const art = SPECIES_ART[species] || SPECIES_ART.blob
  const lines = art.map(line => line.replace(/\{E\}/g, eye))
  if (hat !== "none" && !lines[0].trim()) {
    const copy = [...lines]
    copy[0] = HAT_ART[hat] || lines[0]
    return copy
  }
  return lines
}

function printCard(seed, buddy, { label } = {}) {
  const c = RARITY_COLORS[buddy.rarity]
  const rarityTag = `${buddy.stars || RARITY_STARS[buddy.rarity]} ${BOLD}${buddy.rarity.toUpperCase()}${RESET}${c}`
  const speciesTag = `${BOLD}${buddy.species.toUpperCase()}${RESET}${c}`

  console.log()
  if (label) console.log(`  ${DIM}${label}${RESET}`)
  console.log(`  ${DIM}seed: ${seed}${RESET}`)
  console.log(`  ┌${"─".repeat(CARD_W)}┐`)
  console.log(`  │ ${c}${padAnsi(rarityTag, 24)}${padAnsi(speciesTag, 14)}${RESET} │`)
  console.log(`  │${" ".repeat(CARD_W)}│`)

  const body = renderBody(buddy.species, buddy.eye, buddy.hat)
  for (const line of body) {
    const padded = line.length >= CARD_W ? line : " ".repeat(Math.floor((CARD_W - line.length) / 2)) + line + " ".repeat(Math.ceil((CARD_W - line.length) / 2))
    console.log(`  │${c}${padded.slice(0, CARD_W)}${RESET}│`)
  }

  console.log(`  │${" ".repeat(CARD_W)}│`)

  if (buddy.shiny) {
    const shinyLine = `  ${SHINY_FG}${BOLD}✨ SHINY ✨${RESET}`
    console.log(`  │${padAnsi(shinyLine, CARD_W)}│`)
  }

  console.log(`  │${" ".repeat(CARD_W)}│`)
  for (const name of STAT_NAMES) {
    const val = buddy.stats[name]
    const bar = statBar(val)
    const line = `  ${name.padEnd(10)} ${bar} ${String(val).padStart(3)}`
    console.log(`  │${line.padEnd(CARD_W)}│`)
  }
  console.log(`  └${"─".repeat(CARD_W)}┘`)
  console.log()
}

// ── Config ────────────────────────────────────────────────────────────────

function findConfig() {
  const customDir = process.env.CLAUDE_CONFIG_DIR
  if (customDir) {
    const p = path.join(customDir, ".claude.json")
    return fs.existsSync(p) ? p : null
  }
  const p1 = path.join(os.homedir(), ".claude", ".claude.json")
  const p2 = path.join(os.homedir(), ".claude.json")
  if (fs.existsSync(p1)) return p1
  if (fs.existsSync(p2)) return p2
  return null
}

function readConfig() {
  const p = findConfig()
  if (!p) return null
  return { path: p, data: JSON.parse(fs.readFileSync(p, "utf-8")) }
}

// Detect which config field is the active seed
function detectSeedInfo(config) {
  if (!config) return { source: "anon", value: "anon", format: "hex" }
  const { data } = config
  const uuid = data.oauthAccount?.accountUuid
  const uid = data.userID
  if (uuid) return { source: "oauthAccount.accountUuid", value: uuid, format: "uuid" }
  if (uid) return { source: "userID", value: uid, format: "hex" }
  return { source: "anon", value: "anon", format: "uuid" }
}

// ── CLI ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { max: 10_000_000, count: 3 }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--species":    opts.species = args[++i]; break
      case "--rarity":     opts.rarity = args[++i]; break
      case "--eye":        opts.eye = args[++i]; break
      case "--hat":        opts.hat = args[++i]; break
      case "--shiny":      opts.shiny = true; break
      case "--min-stats": {
        const v = parseInt(args[++i])
        if (!Number.isFinite(v) || v <= 0) { console.error("  --min-stats requires a positive integer"); process.exit(1) }
        opts.minStats = v
        break
      }
      case "--max": {
        const v = parseInt(args[++i])
        if (!Number.isFinite(v) || v <= 0) { console.error("  --max requires a positive integer"); process.exit(1) }
        opts.max = v
        break
      }
      case "--count": {
        const v = parseInt(args[++i])
        if (!Number.isFinite(v) || v <= 0) { console.error("  --count requires a positive integer"); process.exit(1) }
        opts.count = v
        break
      }
      case "--check": {
        const v = args[++i]
        if (!v || v.startsWith("-")) { console.error("  --check requires a seed argument"); process.exit(1) }
        opts.check = v
        break
      }
      case "--current":    opts.current = true; break
      case "--apply": {
        const v = args[++i]
        if (!v || v.startsWith("-")) { console.error("  --apply requires a seed argument"); process.exit(1) }
        opts.apply = v
        break
      }
      case "--format": {
        const fmt = args[++i]
        if (fmt !== "uuid" && fmt !== "hex") {
          console.error(`  Unknown format: ${fmt}\n  Available: uuid, hex`)
          process.exit(1)
        }
        opts.format = fmt
        break
      }
      case "--help": case "-h": opts.help = true; break
      default:
        if (args[i].startsWith("-")) {
          console.error(`  Unknown flag: ${args[i]}\n  Run with --help to see available options.`)
          process.exit(1)
        }
    }
  }

  // Validate enum inputs
  if (opts.species && !SPECIES.includes(opts.species)) {
    console.error(`  Unknown species: ${opts.species}\n  Available: ${SPECIES.join(", ")}`)
    process.exit(1)
  }
  if (opts.rarity && !RARITIES.includes(opts.rarity)) {
    console.error(`  Unknown rarity: ${opts.rarity}\n  Available: ${RARITIES.join(", ")}`)
    process.exit(1)
  }
  if (opts.eye && !EYES.includes(opts.eye)) {
    console.error(`  Unknown eye: ${opts.eye}\n  Available: ${EYES.join(" ")}`)
    process.exit(1)
  }
  if (opts.hat && !HATS.includes(opts.hat)) {
    console.error(`  Unknown hat: ${opts.hat}\n  Available: ${HATS.join(", ")}`)
    process.exit(1)
  }

  return opts
}

function printHelp() {
  console.log(`
${BOLD}buddy${RESET} — Re-roll your Claude Code /buddy companion

${BOLD}Usage:${RESET}
  bun buddy.js                      Interactive mode (recommended)
  bun buddy.js [filters] [options]  CLI search mode

${BOLD}Modes:${RESET}
  --check <seed>       Show what a seed produces
  --current            Show your current companion
  --apply <seed>       Write seed to config (backs up first)

${BOLD}Filters:${RESET}
  --species <name>     ${SPECIES.join(", ")}
  --rarity <tier>      ${RARITIES.join(", ")}
  --eye <char>         ${EYES.join("  ")}
  --hat <name>         ${HATS.join(", ")}
  --shiny              Require shiny
  --min-stats <n>      Require ALL stats >= n

${BOLD}Options:${RESET}
  --format uuid|hex    Override seed format (default: auto-detect)
  --max <n>            Max iterations (default: 10,000,000)
  --count <n>          Results to find (default: 3)

${BOLD}Examples:${RESET}
  bun buddy.js
  bun buddy.js --species dragon --rarity legendary --shiny
  bun buddy.js --current
  bun buddy.js --apply <seed>
`)
}

// ── Modes ─────────────────────────────────────────────────────────────────

function modeCheck(seed) {
  console.log(`\n  ${BOLD}Checking seed:${RESET} ${seed}`)
  printCard(seed, rollCompanion(seed))
}

function modeCurrent() {
  const config = readConfig()
  if (!config) {
    console.error("  No .claude.json found")
    process.exit(1)
  }

  const info = detectSeedInfo(config)
  console.log(`\n  ${BOLD}Config:${RESET}     ${config.path}`)
  console.log(`  ${BOLD}Seed field:${RESET} ${info.source}`)
  console.log(`  ${BOLD}Seed value:${RESET} ${info.value}`)
  console.log(`  ${BOLD}Format:${RESET}     ${info.format}`)

  if (config.data.companion) {
    console.log(`  ${BOLD}Name:${RESET}       ${config.data.companion.name || "(none)"}`)
    const personality = config.data.companion.personality
    if (personality) {
      console.log(`  ${BOLD}Personality:${RESET} ${personality.slice(0, 72)}...`)
    }
  }

  printCard(info.value, rollCompanion(info.value), { label: "derived bones:" })

  if (info.source === "oauthAccount.accountUuid") {
    console.log(`  ${DIM}Seed source is accountUuid (OAuth). Changing userID alone has no effect.${RESET}`)
  }
}

function modeApply(seed) {
  const config = readConfig()
  if (!config) {
    console.error("  No .claude.json found")
    process.exit(1)
  }

  const info = detectSeedInfo(config)
  const buddy = rollCompanion(seed)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const HEX64_RE = /^[0-9a-f]{64}$/i
  const isUuid = UUID_RE.test(seed)

  if (!isUuid && !HEX64_RE.test(seed)) {
    console.error(`  Error: Seed must be a UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)`)
    console.error(`  or a 64-char hex string. Got: ${seed}`)
    process.exit(1)
  }

  console.log(`\n  ${BOLD}Applying to:${RESET} ${config.path}`)
  console.log(`  ${BOLD}Current seed:${RESET} ${info.value} (${info.source})`)
  console.log(`  ${BOLD}New seed:${RESET}     ${seed}`)
  printCard(seed, buddy)

  // Validate format matches current auth method
  if (info.format === "uuid" && !isUuid) {
    console.error(`  Error: Your config uses ${info.source} (UUID format) but you provided a hex seed.`)
    console.error(`  Use --format uuid when searching, or provide a UUID-format seed.`)
    process.exit(1)
  }
  if (info.format === "hex" && isUuid) {
    console.error(`  Error: Your config uses ${info.source} (hex format) but you provided a UUID seed.`)
    console.error(`  Use --format hex when searching, or provide a hex-format seed.`)
    process.exit(1)
  }

  // Backup
  const backupPath = config.path + ".backup-" + Date.now()
  fs.copyFileSync(config.path, backupPath)
  console.log(`  ${DIM}Backup saved: ${backupPath}${RESET}`)

  const { data } = config

  // Apply to the field that detectSeedInfo identified as active
  if (info.source === "oauthAccount.accountUuid") {
    data.oauthAccount.accountUuid = seed
    console.log(`  ${DIM}Updated: oauthAccount.accountUuid${RESET}`)
  } else {
    data.userID = seed
    console.log(`  ${DIM}Updated: userID${RESET}`)
  }

  // Remove cached companion so /buddy hatch regenerates
  delete data.companion

  fs.writeFileSync(config.path, JSON.stringify(data, null, 2) + "\n")
  console.log(`\n  ${BOLD}Done!${RESET} Restart Claude Code and run ${BOLD}/buddy hatch${RESET}`)
  console.log(`  ${DIM}(name and personality are LLM-generated — they'll be unique each time)${RESET}`)
}

function modeSearch(opts) {
  const filters = []
  if (opts.species) filters.push(`species=${opts.species}`)
  if (opts.rarity) filters.push(`rarity=${opts.rarity}`)
  if (opts.eye) filters.push(`eye=${opts.eye}`)
  if (opts.hat) filters.push(`hat=${opts.hat}`)
  if (opts.shiny) filters.push("shiny=true")
  if (opts.minStats) filters.push(`all stats>=${opts.minStats}`)

  if (filters.length === 0) {
    console.error("  No filters specified. Use --help to see options.")
    process.exit(1)
  }

  // Determine seed format
  let format = opts.format
  if (!format) {
    const config = readConfig()
    const info = config ? detectSeedInfo(config) : { format: "uuid" }
    format = info.format
    if (config) {
      console.log(`  ${DIM}Detected auth: ${info.source} → generating ${format} seeds${RESET}`)
    }
  }

  const generateSeed = format === "hex" ? randomHex64 : randomUUID

  console.log(`\n  ${BOLD}buddy${RESET} — searching ${format} space`)
  console.log(`  ${DIM}Filters: ${filters.join(", ")}${RESET}`)
  console.log(`  ${DIM}Max: ${opts.max.toLocaleString()}, find: ${opts.count}${RESET}`)
  console.log()

  const results = []
  const startTime = performance.now()
  let lastReport = startTime

  for (let i = 0; i < opts.max; i++) {
    // Progress heartbeat every 5s — runs on every iteration including misses
    const now = performance.now()
    if (now - lastReport > 5000) {
      const rate = Math.round((i + 1) / ((now - startTime) / 1000))
      console.log(`  ${DIM}... ${(i + 1).toLocaleString()} checked (${rate.toLocaleString()}/s)${RESET}`)
      lastReport = now
    }

    const seed = generateSeed()
    const rng = splitmix32(bunHash(seed + SALT))

    // Early rejection in PRNG consumption order
    const rarity = rollRarity(rng)
    if (opts.rarity && rarity !== opts.rarity) continue

    const species = pick(rng, SPECIES)
    if (opts.species && species !== opts.species) continue

    const eye = pick(rng, EYES)
    if (opts.eye && eye !== opts.eye) continue

    const hat = rarity === "common" ? "none" : pick(rng, HATS)
    if (opts.hat && hat !== opts.hat) continue

    const shiny = rng() < 0.01
    if (opts.shiny && !shiny) continue

    const stats = rollStats(rng, rarity)
    if (opts.minStats && !Object.values(stats).every(v => v >= opts.minStats)) continue

    const buddy = { rarity, species, eye, hat, shiny, stats }
    results.push({ seed, buddy })

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
    console.log(`  ${BOLD}Match #${results.length}${RESET} after ${(i + 1).toLocaleString()} attempts (${elapsed}s)`)
    printCard(seed, buddy)

    if (results.length >= opts.count) break
  }

  const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(1)
  if (results.length === 0) {
    console.log(`  No match in ${opts.max.toLocaleString()} attempts (${totalElapsed}s)`)
  } else {
    console.log(`  ${BOLD}Found ${results.length} match(es) in ${totalElapsed}s${RESET}`)
  }

  return results
}

// ── Interactive mode ──────────────────────────────────────────────────────

function prompt(msg) {
  process.stdout.write(msg)
  const buf = Buffer.alloc(256)
  const n = fs.readSync(0, buf, 0, 256)
  return buf.toString("utf-8", 0, n).trim()
}

function selectOne(title, items, { columns = 1, allowAny = true, extras } = {}) {
  console.log(`\n  ${BOLD}${title}${RESET}`)

  const entries = []
  if (allowAny) entries.push({ num: 0, name: "any", extra: "" })
  for (let i = 0; i < items.length; i++) {
    const extra = extras?.[items[i]] ? `  ${DIM}(${extras[items[i]]})${RESET}` : ""
    entries.push({ num: i + 1, name: items[i], extra })
  }

  if (columns === 1) {
    for (const e of entries) console.log(`    ${DIM}${String(e.num).padStart(2)}.${RESET} ${e.name}${e.extra}`)
  } else {
    for (let i = 0; i < entries.length; i += columns) {
      const row = entries.slice(i, i + columns)
        .map(e => `${DIM}${String(e.num).padStart(2)}.${RESET} ${e.name.padEnd(12)}${e.extra}`)
        .join("  ")
      console.log(`    ${row}`)
    }
  }

  while (true) {
    const raw = prompt(`  ${DIM}>${RESET} `)
    if (!raw) continue

    const n = parseInt(raw)
    if (!isNaN(n)) {
      if (allowAny && n === 0) return null
      if (n >= 1 && n <= items.length) return items[n - 1]
    }

    const match = items.find(i => i.toLowerCase() === raw.toLowerCase())
    if (match) return match
    if (allowAny && raw.toLowerCase() === "any") return null

    console.log(`    ${DIM}invalid, try again${RESET}`)
  }
}

function confirm(msg) {
  const raw = prompt(`\n  ${BOLD}${msg}${RESET} [y/N] `)
  return raw.toLowerCase() === "y" || raw.toLowerCase() === "yes"
}

function modeInteractive() {
  console.log(`\n  ${BOLD}🥚 Buddy Generator${RESET}`)

  // Show current companion first
  const config = readConfig()
  if (config) {
    const info = detectSeedInfo(config)
    const current = rollCompanion(info.value)
    console.log(`\n  ${DIM}Current: ${current.rarity} ${current.species}${current.shiny ? " (shiny)" : ""} via ${info.source}${RESET}`)
  }

  const want = {}

  // Rarity
  const rarityExtras = { common: "60%", uncommon: "25%", rare: "10%", epic: "4%", legendary: "1%" }
  const rarity = selectOne("Rarity:", RARITIES, { extras: rarityExtras })
  if (rarity) want.rarity = rarity

  // Species
  const species = selectOne("Species:", SPECIES, { columns: 3 })
  if (species) want.species = species

  // Shiny
  if (confirm("Shiny? (1% chance)")) want.shiny = true

  // Hat (only for non-common)
  if (rarity && rarity !== "common") {
    const hat = selectOne("Hat:", HATS.filter(h => h !== "none"))
    if (hat) want.hat = hat
  }

  // Eye
  const eye = selectOne("Eye:", EYES)
  if (eye) want.eye = eye

  // Summary
  const parts = []
  if (want.rarity) parts.push(RARITY_COLORS[want.rarity] + want.rarity + RESET)
  if (want.shiny) parts.push(`${SHINY_FG}shiny${RESET}`)
  if (want.species) parts.push(want.species)
  if (want.hat) parts.push(`hat:${want.hat}`)
  if (want.eye) parts.push(`eye:${want.eye}`)

  if (parts.length === 0) {
    console.log(`\n  ${DIM}No traits selected — nothing to search for.${RESET}`)
    process.exit(0)
  }

  console.log(`\n  ${BOLD}Target:${RESET} ${parts.join("  ")}`)

  if (!confirm("Start searching?")) {
    console.log(`  ${DIM}Cancelled.${RESET}`)
    process.exit(0)
  }

  // Build opts and delegate to search
  const searchOpts = { ...want, max: 10_000_000, count: 3 }
  const results = modeSearch(searchOpts)

  if (results.length === 0) return

  // Let user pick which one to apply
  let chosen = null
  if (results.length === 1) {
    if (confirm("Apply this companion?")) chosen = results[0]
  } else {
    console.log(`\n  ${BOLD}Which one do you want?${RESET}`)
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const traits = [r.buddy.rarity, r.buddy.species]
      if (r.buddy.shiny) traits.push("shiny")
      if (r.buddy.hat !== "none") traits.push(`hat:${r.buddy.hat}`)
      traits.push(`eye:${r.buddy.eye}`)
      console.log(`    ${DIM}${i + 1}.${RESET} ${traits.join(" ")}  ${DIM}${r.seed.slice(0, 18)}...${RESET}`)
    }
    console.log(`    ${DIM}0.${RESET} none (exit)`)

    const raw = prompt(`  ${DIM}>${RESET} `)
    const n = parseInt(raw)
    if (n >= 1 && n <= results.length) chosen = results[n - 1]
  }

  if (!chosen) {
    console.log(`  ${DIM}No changes made.${RESET}`)
    return
  }

  modeApply(chosen.seed)
}

// ── Main ──────────────────────────────────────────────────────────────────

const opts = parseArgs()

if (opts.help)         { printHelp(); process.exit(0) }
if (opts.check)        { modeCheck(opts.check); process.exit(0) }
if (opts.current)      { modeCurrent(); process.exit(0) }
if (opts.apply)        { modeApply(opts.apply); process.exit(0) }

// No flags at all → interactive mode
const hasFilters = opts.species || opts.rarity || opts.eye || opts.hat || opts.shiny || opts.minStats
if (!hasFilters) {
  modeInteractive()
} else {
  const results = modeSearch(opts)
  for (const r of results) {
    console.log(`  ${DIM}Apply: bun buddy.js --apply ${r.seed}${RESET}`)
  }
}
