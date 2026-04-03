#!/usr/bin/env bun
// buddy.js — Re-roll your Claude Code /buddy companion
//
// Seed chain (from Claude Code source):
//   oauthAccount.accountUuid ?? userID ?? "anon"
//   + "friend-2026-401" → hash → SplitMix32 → traits
//
// Hash function depends on how Claude Code was installed:
//   Compiled binary (Bun) → Bun.hash (wyhash)
//   npm package (Node.js) → FNV-1a
//
// Run without args for interactive mode, or pass --help for CLI usage.

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
const STAT_PRIMARY_BASE = 50
const STAT_PRIMARY_RANGE = 30
const STAT_SECONDARY_OFFSET = -10
const STAT_SECONDARY_RANGE = 15
const STAT_BASE_RANGE = 40
const SHINY_CHANCE = 0.01
const HEARTBEAT_MS = 5000
const DEFAULT_MAX = 10_000_000
const DEFAULT_COUNT = 3
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX64_RE = /^[0-9a-f]{64}$/i

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

// Claude Code uses Bun.hash (wyhash) when running as a compiled Bun binary,
// but falls back to FNV-1a when running as an npm package on Node.js.
// We auto-detect which one the user's Claude Code uses.

function fnv1a(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function wyhash(s) {
  if (typeof Bun === "undefined") {
    console.error("Error: wyhash mode requires Bun (https://bun.sh).")
    console.error("Install: curl -fsSL https://bun.sh/install | bash")
    process.exit(1)
  }
  return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
}

// Detect whether the user's Claude Code is a compiled Bun binary or Node.js
const BINARY_MAGICS = new Set([
  0xCFFAEDFE, // Mach-O 64-bit (little-endian header)
  0xFEEDFACF, // Mach-O 64-bit (big-endian header)
  0xFEEDFACE, // Mach-O 32-bit
  0xCAFEBABE, // Mach-O universal/fat binary
  0xBEBAFECA, // Mach-O universal/fat binary (swapped)
  0x7F454C46, // ELF
])

function detectClaudeHashMode() {
  const { execFileSync } = require("child_process")
  try {
    const claudePath = execFileSync("/usr/bin/which", ["claude"], { encoding: "utf-8" }).trim()
    if (!claudePath) return null
    const realPath = fs.realpathSync(claudePath)
    const header = Buffer.alloc(4)
    const fd = fs.openSync(realPath, "r")
    fs.readSync(fd, header, 0, 4, 0)
    fs.closeSync(fd)
    const magic = header.readUInt32BE(0)
    if (BINARY_MAGICS.has(magic)) return "wyhash"
    return "fnv1a"
  } catch {
    return null // detection failed — caller decides fallback
  }
}

let hashMode = null // set during parseArgs or auto-detected on first use
let hashExplicit = false // true when user passed --hash explicitly

let hashDetectionFailed = false

function resolveHashMode() {
  if (hashMode) return hashMode
  const detected = detectClaudeHashMode()
  if (detected) {
    hashMode = detected
  } else {
    hashMode = "fnv1a"
    hashDetectionFailed = true
    console.error(`\n  ${BOLD}⚠ Could not detect Claude Code installation type.${RESET}`)
    console.error(`  Defaulting to fnv1a (works everywhere). If results don't match /buddy,`)
    console.error(`  re-run with ${BOLD}--hash wyhash${RESET} (for compiled binary installs).\n`)
  }
  return hashMode
}

function seedHash(s) {
  resolveHashMode()
  return hashMode === "fnv1a" ? fnv1a(s) : wyhash(s)
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
  return Object.fromEntries(STAT_NAMES.map(name => {
    if (name === primary) return [name, Math.min(100, budget + STAT_PRIMARY_BASE + Math.floor(rng() * STAT_PRIMARY_RANGE))]
    if (name === secondary) return [name, Math.max(1, budget + STAT_SECONDARY_OFFSET + Math.floor(rng() * STAT_SECONDARY_RANGE))]
    return [name, budget + Math.floor(rng() * STAT_BASE_RANGE)]
  }))
}

function rollCompanion(seed) {
  const rng = splitmix32(seedHash(seed + SALT))
  const rarity = rollRarity(rng)
  const species = pick(rng, SPECIES)
  const eye = pick(rng, EYES)
  const hat = rarity === "common" ? "none" : pick(rng, HATS)
  const shiny = rng() < SHINY_CHANCE
  const stats = rollStats(rng, rarity)
  return { rarity, species, eye, hat, shiny, stats }
}

// ── ID generation ─────────────────────────────────────────────────────────
// Uses Math.random for speed in the search loop — cryptographic strength
// is unnecessary since we just need distinct candidate strings.

const HEX_CHARS = "0123456789abcdef"

function randomUUID() {
  const a = new Array(32)
  for (let i = 0; i < 32; i++) a[i] = HEX_CHARS[(Math.random() * 16) | 0]
  const s = a.join("")
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${HEX_CHARS[(Math.random() * 4 | 0) + 8]}${s.slice(17, 20)}-${s.slice(20, 32)}`
}

function randomHex64() {
  const a = new Array(64)
  for (let i = 0; i < 64; i++) a[i] = HEX_CHARS[(Math.random() * 16) | 0]
  return a.join("")
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
    const p = path.join(path.resolve(customDir), ".claude.json")
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
  try {
    return { path: p, data: JSON.parse(fs.readFileSync(p, "utf-8")) }
  } catch {
    console.error(`  Error: Could not parse ${p} — is it valid JSON?`)
    process.exit(1)
  }
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

function parsePositiveInt(str, flag) {
  const v = parseInt(str)
  if (!Number.isFinite(v) || v <= 0) { console.error(`  ${flag} requires a positive integer`); process.exit(1) }
  return v
}

function requireArg(args, i, flag) {
  const v = args[i]
  if (!v || v.startsWith("-")) { console.error(`  ${flag} requires an argument`); process.exit(1) }
  return v
}

function validateEnumOpts(opts) {
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
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { max: DEFAULT_MAX, count: DEFAULT_COUNT }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--species":    opts.species = args[++i]; break
      case "--rarity":     opts.rarity = args[++i]; break
      case "--eye":        opts.eye = args[++i]; break
      case "--hat":        opts.hat = args[++i]; break
      case "--shiny":      opts.shiny = true; break
      case "--min-stats":  opts.minStats = parsePositiveInt(args[++i], "--min-stats"); break
      case "--max":        opts.max = parsePositiveInt(args[++i], "--max"); break
      case "--count":      opts.count = parsePositiveInt(args[++i], "--count"); break
      case "--current":    opts.current = true; break
      case "--apply":      opts.apply = requireArg(args, ++i, "--apply"); break
      case "--format": {
        const fmt = args[++i]
        if (fmt !== "uuid" && fmt !== "hex") {
          console.error(`  Unknown format: ${fmt}\n  Available: uuid, hex`)
          process.exit(1)
        }
        opts.format = fmt
        break
      }
      case "--hash": {
        const mode = args[++i]
        if (mode !== "wyhash" && mode !== "fnv1a" && mode !== "auto") {
          console.error(`  Unknown hash mode: ${mode}\n  Available: auto, wyhash, fnv1a`)
          process.exit(1)
        }
        hashMode = mode === "auto" ? null : mode
        hashExplicit = mode !== "auto"
        break
      }
      case "--all":        opts.all = true; break
      case "--help": case "-h": opts.help = true; break
      default:
        if (args[i].startsWith("-")) {
          console.error(`  Unknown flag: ${args[i]}\n  Run with --help to see available options.`)
          process.exit(1)
        }
    }
  }

  validateEnumOpts(opts)
  return opts
}

function printHelp() {
  console.log(`
${BOLD}buddy${RESET} — Re-roll your Claude Code /buddy companion

${BOLD}Usage:${RESET}
  bun buddy.js                      Interactive mode (recommended)
  bun buddy.js [filters] [options]  CLI search mode

${BOLD}Modes:${RESET}
  --current            Show your current companion
  --apply <seed>       Write seed to both config fields (backs up first)
  --all                Find one seed for every species × rarity combo

${BOLD}Filters:${RESET}
  --species <name>     ${SPECIES.join(", ")}
  --rarity <tier>      ${RARITIES.join(", ")}
  --eye <char>         ${EYES.join("  ")}
  --hat <name>         ${HATS.join(", ")}
  --shiny              Require shiny
  --min-stats <n>      Require ALL stats >= n

${BOLD}Options:${RESET}
  --format uuid|hex    Force single format (default: searches both)
  --hash auto|wyhash|fnv1a  Hash function (default: auto-detect)
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

function modeCurrent() {
  const config = readConfig()
  if (!config) {
    console.error("  No .claude.json found")
    process.exit(1)
  }

  const { data } = config
  const uuid = data.oauthAccount?.accountUuid
  const uid = data.userID
  const raw = []
  if (uuid) raw.push({ source: "oauthAccount.accountUuid", value: uuid, format: "uuid" })
  if (uid) raw.push({ source: "userID", value: uid, format: "hex" })
  if (raw.length === 0) raw.push({ source: "anon", value: "anon", format: "uuid" })

  // Deduplicate seeds with the same value (e.g. after --apply writes both fields)
  const seeds = []
  const seen = new Map()
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  for (const s of raw) {
    const existing = seen.get(s.value)
    if (existing) {
      existing.sources.push(s.source)
      // Re-detect format from the actual value when merging
      existing.format = uuidRe.test(s.value) ? "uuid" : "hex"
    } else {
      const entry = { ...s, sources: [s.source] }
      seen.set(s.value, entry)
      seeds.push(entry)
    }
  }

  resolveHashMode()
  console.log(`\n  ${BOLD}Config:${RESET}     ${config.path}`)
  const hashLabel = hashExplicit ? "set via --hash"
    : hashDetectionFailed ? "unverified — use --hash if wrong"
    : hashMode === "fnv1a" ? "npm/Node.js Claude" : "compiled Bun Claude"
  console.log(`  ${BOLD}Hash:${RESET}       ${hashMode} ${DIM}(${hashLabel})${RESET}`)

  if (data.companion) {
    console.log(`  ${BOLD}Name:${RESET}       ${data.companion.name || "(none)"}`)
    const personality = data.companion.personality
    if (personality) {
      console.log(`  ${BOLD}Personality:${RESET} ${personality.slice(0, 72)}...`)
    }
  }

  for (const info of seeds) {
    const sourceLabel = info.sources.join(" + ")
    console.log(`\n  ${BOLD}Seed field:${RESET} ${sourceLabel}`)
    console.log(`  ${BOLD}Seed value:${RESET} ${info.value}`)
    console.log(`  ${BOLD}Format:${RESET}     ${info.format}`)
    printCard(info.value, rollCompanion(info.value), { label: `from ${sourceLabel}:` })
  }

  if (seeds.length > 1) {
    console.log(`  ${DIM}Multiple seeds found. Claude Code uses: accountUuid (OAuth) > userID > "anon"${RESET}`)
    console.log(`  ${DIM}Compare with /buddy output to see which seed your version uses.${RESET}`)
  }
}

function writeConfigAtomically(configPath, data) {
  const tmpPath = configPath + ".tmp-" + Date.now()
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n")
  fs.renameSync(tmpPath, configPath)
}

function modeApply(seed) {
  const config = readConfig()
  if (!config) {
    console.error("  No .claude.json found")
    process.exit(1)
  }

  if (!UUID_RE.test(seed) && !HEX64_RE.test(seed)) {
    console.error(`  Error: Seed must be a UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)`)
    console.error(`  or a 64-char hex string. Got: ${seed}`)
    process.exit(1)
  }

  const info = detectSeedInfo(config)
  const buddy = rollCompanion(seed)

  console.log(`\n  ${BOLD}Applying to:${RESET} ${config.path}`)
  console.log(`  ${BOLD}Current seed:${RESET} ${info.value} (${info.source})`)
  console.log(`  ${BOLD}New seed:${RESET}     ${seed}`)
  printCard(seed, buddy)

  // Write to BOTH fields so the buddy is the same regardless of auth type
  const { companion: _, ...rest } = config.data
  const newData = {
    ...rest,
    oauthAccount: { ...rest.oauthAccount, accountUuid: seed },
    userID: seed,
  }

  const backupPath = config.path + ".backup-" + Date.now()
  fs.copyFileSync(config.path, backupPath)
  console.log(`  ${DIM}Backup saved: ${backupPath}${RESET}`)
  console.log(`  ${DIM}Updated: oauthAccount.accountUuid + userID${RESET}`)

  writeConfigAtomically(config.path, newData)
  console.log(`\n  ${BOLD}Done!${RESET} Restart Claude Code and run ${BOLD}/buddy hatch${RESET}`)
  console.log(`  ${DIM}(name and personality are LLM-generated — they'll be unique each time)${RESET}`)
}

function describeFilters(opts) {
  const parts = []
  if (opts.species) parts.push(`species=${opts.species}`)
  if (opts.rarity) parts.push(`rarity=${opts.rarity}`)
  if (opts.eye) parts.push(`eye=${opts.eye}`)
  if (opts.hat) parts.push(`hat=${opts.hat}`)
  if (opts.shiny) parts.push("shiny=true")
  if (opts.minStats) parts.push(`all stats>=${opts.minStats}`)
  return parts
}

function modeSearch(opts) {
  const filters = describeFilters(opts)
  if (filters.length === 0) {
    console.error("  No filters specified. Use --help to see options.")
    process.exit(1)
  }

  const formats = opts.format ? [opts.format] : ["uuid", "hex"]
  const generators = { uuid: randomUUID, hex: randomHex64 }

  resolveHashMode()
  console.log(`\n  ${BOLD}buddy${RESET} — searching ${formats.join(" + ")} space ${DIM}(hash: ${hashMode})${RESET}`)
  console.log(`  ${DIM}Filters: ${filters.join(", ")}${RESET}`)
  console.log(`  ${DIM}Max: ${opts.max.toLocaleString()}, find: ${opts.count}${RESET}`)
  console.log()

  const results = []
  const startTime = performance.now()
  let lastReport = startTime

  for (let i = 0; i < opts.max; i++) {
    const now = performance.now()
    if (now - lastReport > HEARTBEAT_MS) {
      const rate = Math.round((i + 1) / ((now - startTime) / 1000))
      console.log(`  ${DIM}... ${(i + 1).toLocaleString()} checked (${rate.toLocaleString()}/s)${RESET}`)
      lastReport = now
    }

    const fmt = formats[i % formats.length]
    const seed = generators[fmt]()
    const rng = splitmix32(seedHash(seed + SALT))

    // Early rejection in PRNG consumption order
    const rarity = rollRarity(rng)
    if (opts.rarity && rarity !== opts.rarity) continue

    const species = pick(rng, SPECIES)
    if (opts.species && species !== opts.species) continue

    const eye = pick(rng, EYES)
    if (opts.eye && eye !== opts.eye) continue

    const hat = rarity === "common" ? "none" : pick(rng, HATS)
    if (opts.hat && hat !== opts.hat) continue

    const shiny = rng() < SHINY_CHANCE
    if (opts.shiny && !shiny) continue

    const stats = rollStats(rng, rarity)
    if (opts.minStats && !Object.values(stats).every(v => v >= opts.minStats)) continue

    const buddy = { rarity, species, eye, hat, shiny, stats }
    results.push({ seed, buddy, format: fmt })

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

function gatherTraits() {
  const want = {}
  const rarityExtras = { common: "60%", uncommon: "25%", rare: "10%", epic: "4%", legendary: "1%" }
  const rarity = selectOne("Rarity:", RARITIES, { extras: rarityExtras })
  if (rarity) want.rarity = rarity

  const species = selectOne("Species:", SPECIES, { columns: 3 })
  if (species) want.species = species

  if (confirm("Shiny? (1% chance)")) want.shiny = true

  if (rarity && rarity !== "common") {
    const hat = selectOne("Hat:", HATS.filter(h => h !== "none"))
    if (hat) want.hat = hat
  }

  const eye = selectOne("Eye:", EYES)
  if (eye) want.eye = eye

  return want
}

// Returns true if the user wants to reroll, false if done (applied or exited).
function pickAndApplyResult(results) {
  if (results.length === 0) return false

  let chosen = null
  if (results.length === 1) {
    console.log(`\n  Apply this companion? [y/N/r=reroll]`)
    const raw = prompt(`  ${DIM}>${RESET} `).toLowerCase()
    if (raw === "r" || raw === "reroll") return true
    if (raw === "y" || raw === "yes") chosen = results[0]
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
    console.log(`    ${DIM}r.${RESET} reroll`)

    const raw = prompt(`  ${DIM}>${RESET} `).toLowerCase()
    if (raw === "r" || raw === "reroll") return true
    const n = parseInt(raw)
    if (n >= 1 && n <= results.length) chosen = results[n - 1]
  }

  if (!chosen) {
    console.log(`  ${DIM}No changes made.${RESET}`)
    return false
  }

  modeApply(chosen.seed)
  return false
}

function modeInteractive() {
  console.log(`\n  ${BOLD}🥚 Buddy Generator${RESET}`)

  const config = readConfig()
  if (config) {
    const info = detectSeedInfo(config)
    const current = rollCompanion(info.value)
    console.log(`\n  ${DIM}Current: ${current.rarity} ${current.species}${current.shiny ? " (shiny)" : ""} via ${info.source}${RESET}`)
  }

  const want = gatherTraits()

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

  while (true) {
    const results = modeSearch({ ...want, max: DEFAULT_MAX, count: DEFAULT_COUNT })
    const reroll = pickAndApplyResult(results)
    if (!reroll) break
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

const opts = parseArgs()

if (opts.help)         { printHelp(); process.exit(0) }
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
