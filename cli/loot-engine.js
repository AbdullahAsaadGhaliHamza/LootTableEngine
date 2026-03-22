#!/usr/bin/env node

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { LootEngine, buildWeightMap } from '../src/index.js'

const args = process.argv.slice(2)

function help() {
  console.log(`
loot-engine <command> [options]

Commands:
  roll <file> <table> [--rolls N] [--ctx key=value,key=value] [--flags flag1,flag2]
  inspect <file> <table>
  list <file>

Examples:
  loot-engine roll examples/fantasy_rpg.json goblin_pouch
  loot-engine roll examples/fantasy_rpg.json chest_boss --flags boss_killed_with_fire --ctx player_level=25
  loot-engine inspect examples/fantasy_rpg.json merchant_daily
  loot-engine list examples/fantasy_rpg.json
`)
}

function parseCtx(ctxArg, flagsArg) {
  const ctx = {}

  if (ctxArg) {
    ctxArg.split(',').forEach(pair => {
      const [k, v] = pair.split('=')
      if (!k) return
      const num = Number(v)
      ctx[k.trim()] = isNaN(num) ? v.trim() : num
    })
  }

  if (flagsArg) {
    ctx.flags = flagsArg.split(',').map(f => f.trim())
  }

  return ctx
}

function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const cmd = args[0]

if (!cmd || cmd === '--help' || cmd === '-h') {
  help()
  process.exit(0)
}

if (cmd === 'list') {
  const file = args[1]
  if (!file) { console.error('Usage: loot-engine list <file>'); process.exit(1) }
  const tables = JSON.parse(readFileSync(resolve(file), 'utf8'))
  const engine = new LootEngine(tables)
  console.log(engine.listTables().join('\n'))
  process.exit(0)
}

if (cmd === 'inspect') {
  const file = args[1]
  const tableId = args[2]
  if (!file || !tableId) { console.error('Usage: loot-engine inspect <file> <table>'); process.exit(1) }

  const tables = JSON.parse(readFileSync(resolve(file), 'utf8'))
  const engine = new LootEngine(tables)
  const table = engine.getTable(tableId)

  if (!table) { console.error(`Table "${tableId}" not found`); process.exit(1) }

  const mapped = buildWeightMap(table.entries.filter(e => e.type !== 'table_ref'))

  console.log(`\nTable: ${tableId}`)
  if (table.description) console.log(`Description: ${table.description}`)
  console.log(`Rolls: ${table.rolls ?? 1}  Mode: ${table.mode ?? 'weighted'}  Unique: ${table.unique ?? false}\n`)

  const rows = mapped.map(e => ({
    id: e.id ?? e.ref,
    weight: e.weight ?? 1,
    probability: e.probability,
    chance: e.chance ?? 1,
    condition: e.condition ? JSON.stringify(e.condition) : 'none'
  }))

  console.table(rows)
  process.exit(0)
}

if (cmd === 'roll') {
  const file = args[1]
  const tableId = args[2]
  if (!file || !tableId) { console.error('Usage: loot-engine roll <file> <table>'); process.exit(1) }

  const tables = JSON.parse(readFileSync(resolve(file), 'utf8'))
  const engine = new LootEngine(tables)

  const ctxArg = getArg('--ctx')
  const flagsArg = getArg('--flags')
  const rollCount = parseInt(getArg('--rolls') ?? '1', 10)
  const context = parseCtx(ctxArg, flagsArg)

  console.log(`\nRolling "${tableId}" x${rollCount}`)
  if (Object.keys(context).length > 0) console.log('Context:', context)
  console.log()

  for (let i = 0; i < rollCount; i++) {
    const result = engine.roll(tableId, context)
    console.log(`Roll ${i + 1}:`, result.length === 0 ? '(nothing)' : result)
  }
  process.exit(0)
}

console.error(`Unknown command: ${cmd}`)
help()
process.exit(1)
