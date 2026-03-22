import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { LootEngine } from '../src/index.js'
import { resolveCondition } from '../src/conditions.js'
import { pickWeighted } from '../src/weighted.js'

describe('LootEngine setup', () => {
  test('registers tables from constructor', () => {
    const engine = new LootEngine({
      gold: { entries: [{ id: 'coin', weight: 1 }] }
    })
    assert.ok(engine.getTable('gold'))
  })

  test('throws on missing entries array', () => {
    assert.throws(() => {
      new LootEngine({ bad: { rolls: 1 } })
    }, /missing an entries array/)
  })

  test('loadJSON registers multiple tables', () => {
    const engine = new LootEngine()
    engine.loadJSON({ a: { entries: [] }, b: { entries: [] } })
    assert.deepEqual(engine.listTables(), ['a', 'b'])
  })
})

describe('weighted picker', () => {
  test('always picks from non-empty list', () => {
    const entries = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ]
    for (let i = 0; i < 50; i++) {
      const result = pickWeighted(entries)
      assert.ok(['a', 'b'].includes(result.id))
    }
  })

  test('returns null for empty list', () => {
    assert.equal(pickWeighted([]), null)
  })

  test('heavily weighted item dominates', () => {
    const entries = [
      { id: 'common', weight: 999 },
      { id: 'rare', weight: 1 },
    ]
    const counts = { common: 0, rare: 0 }
    for (let i = 0; i < 1000; i++) {
      counts[pickWeighted(entries).id]++
    }
    assert.ok(counts.common > 900, `expected common to dominate, got ${counts.common}`)
  })
})

describe('condition resolver', () => {
  test('string condition checks context key', () => {
    assert.equal(resolveCondition('has_key', { has_key: true }), true)
    assert.equal(resolveCondition('has_key', {}), false)
  })

  test('has_flag checks context.flags array', () => {
    const ctx = { flags: ['fire_kill', 'purified'] }
    assert.equal(resolveCondition({ has_flag: 'fire_kill' }, ctx), true)
    assert.equal(resolveCondition({ has_flag: 'missing' }, ctx), false)
  })

  test('and requires all to pass', () => {
    const ctx = { a: true, b: true }
    assert.equal(resolveCondition({ and: ['a', 'b'] }, ctx), true)
    assert.equal(resolveCondition({ and: ['a', 'c'] }, ctx), false)
  })

  test('or requires at least one', () => {
    const ctx = { a: true }
    assert.equal(resolveCondition({ or: ['a', 'b'] }, ctx), true)
    assert.equal(resolveCondition({ or: ['b', 'c'] }, ctx), false)
  })

  test('not inverts', () => {
    assert.equal(resolveCondition({ not: 'val' }, { val: false }), true)
    assert.equal(resolveCondition({ not: 'val' }, { val: true }), false)
  })

  test('gt/gte/lt/lte numeric comparisons', () => {
    const ctx = { level: 20 }
    assert.equal(resolveCondition({ gt:  { key: 'level', value: 19 } }, ctx), true)
    assert.equal(resolveCondition({ gte: { key: 'level', value: 20 } }, ctx), true)
    assert.equal(resolveCondition({ lt:  { key: 'level', value: 21 } }, ctx), true)
    assert.equal(resolveCondition({ lte: { key: 'level', value: 20 } }, ctx), true)
    assert.equal(resolveCondition({ gt:  { key: 'level', value: 20 } }, ctx), false)
  })

  test('eq matches exact value', () => {
    const ctx = { class: 'rogue' }
    assert.equal(resolveCondition({ eq: { key: 'class', value: 'rogue' } }, ctx), true)
    assert.equal(resolveCondition({ eq: { key: 'class', value: 'warrior' } }, ctx), false)
  })

  test('in checks membership', () => {
    const ctx = { zone: 'dungeon' }
    assert.equal(resolveCondition({ in: { key: 'zone', values: ['dungeon', 'cave'] } }, ctx), true)
    assert.equal(resolveCondition({ in: { key: 'zone', values: ['overworld'] } }, ctx), false)
  })

  test('fn calls custom handler', () => {
    const handlers = {
      high_dex: (ctx, args) => (ctx.dex ?? 0) >= args.min
    }
    assert.equal(resolveCondition({ fn: 'high_dex', args: { min: 15 } }, { dex: 16 }, handlers), true)
    assert.equal(resolveCondition({ fn: 'high_dex', args: { min: 15 } }, { dex: 10 }, handlers), false)
  })

  test('fn throws when handler is missing', () => {
    assert.throws(() => {
      resolveCondition({ fn: 'nonexistent' }, {}, {})
    }, /No custom condition registered/)
  })
})

describe('LootEngine rolling', () => {
  const tables = {
    simple: {
      entries: [
        { id: 'sword', weight: 1 }
      ]
    },
    conditional: {
      entries: [
        { id: 'fire_rune', weight: 1, condition: { has_flag: 'fire_kill' } },
        { id: 'plain_rock', weight: 1 }
      ]
    },
    multi_roll: {
      rolls: 3,
      entries: [
        { id: 'coin', weight: 1 }
      ]
    },
    all_mode: {
      mode: 'all',
      entries: [
        { id: 'always', weight: 1, chance: 1 },
        { id: 'half',   weight: 1, chance: 0.5 },
        { id: 'never',  weight: 1, chance: 0 }
      ]
    },
    unique_table: {
      rolls: 5,
      unique: true,
      entries: [{ id: 'item_a', weight: 1 }]
    },
    nested: {
      mode: 'all',
      entries: [
        { id: 'ref', type: 'table_ref', ref: 'simple', chance: 1 }
      ]
    }
  }

  const engine = new LootEngine(tables)

  test('rolls return items', () => {
    const result = engine.roll('simple', {})
    assert.equal(result.length, 1)
    assert.equal(result[0].id, 'sword')
  })

  test('conditional entry excluded when condition fails', () => {
    const result = engine.roll('conditional', {})
    assert.ok(result.every(r => r.id !== 'fire_rune'))
  })

  test('conditional entry included when condition passes', () => {
    const result = engine.roll('conditional', { flags: ['fire_kill'] })
    assert.ok(result.some(r => r.id === 'fire_rune'))
  })

  test('multi-roll produces correct count', () => {
    const result = engine.roll('multi_roll', {})
    assert.equal(result.length, 3)
  })

  test('all mode evaluates every entry', () => {
    const results = []
    for (let i = 0; i < 100; i++) {
      results.push(...engine.roll('all_mode', {}))
    }
    const ids = results.map(r => r.id)
    assert.ok(ids.includes('always'), '"always" should appear')
    assert.ok(!ids.includes('never'), '"never" should never appear')
  })

  test('unique flag deduplicates results', () => {
    const result = engine.roll('unique_table', {})
    assert.equal(result.length, 1)
  })

  test('table_ref resolves nested table', () => {
    const result = engine.roll('nested', {})
    assert.ok(result.some(r => r.id === 'sword'))
  })

  test('throws on unknown table', () => {
    assert.throws(() => engine.roll('fake_table', {}), /Unknown table/)
  })
})
