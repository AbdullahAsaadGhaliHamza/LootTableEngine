import { LootEngine } from '../src/index.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tables = JSON.parse(readFileSync(join(__dirname, 'fantasy_rpg.json'), 'utf8'))

const engine = new LootEngine(tables)

engine.registerCondition('rogue_or_high_dex', (ctx, args) => {
  return ctx.class === 'rogue' || (ctx.dex ?? 0) >= (args.min_dex ?? 14)
})

console.log('=== Goblin Pouch ===')
console.log(engine.roll('goblin_pouch', {}))

console.log('\n=== Common Chest (2 rolls, unique) ===')
console.log(engine.roll('chest_common', {}))

console.log('\n=== Boss Chest (normal player) ===')
const normalCtx = {
  flags: ['dragon_slain'],
  player_level: 22,
}
console.log(engine.roll('chest_boss', normalCtx))

console.log('\n=== Boss Chest (fire mage, killed boss with fire) ===')
const fireMageCtx = {
  flags: ['boss_killed_with_fire', 'purified_altar', 'dragon_slain'],
  player_level: 25,
}
console.log(engine.roll('chest_boss', fireMageCtx))

console.log('\n=== Merchant Daily Stock ===')
const merchantCtx = {
  bounty: 500,
  flags: ['guild_contact_met'],
}
console.log(engine.roll('merchant_daily', merchantCtx))

console.log('\n=== Trap Reward (rogue player) ===')
const rogueCtx = { class: 'rogue', dex: 16 }
console.log(engine.roll('dungeon_trap_reward', rogueCtx))

console.log('\n=== Trap Reward (warrior, low dex) ===')
const warriorCtx = { class: 'warrior', dex: 9 }
console.log(engine.roll('dungeon_trap_reward', warriorCtx))
