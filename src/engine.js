import { resolveCondition } from './conditions.js'
import { pickWeighted } from './weighted.js'

export class LootEngine {
  constructor(tables = {}, options = {}) {
    this.tables = {}
    this.customConditions = {}
    this.seed = options.seed ?? null
    this.rng = options.rng ?? Math.random

    for (const [id, table] of Object.entries(tables)) {
      this.register(id, table)
    }
  }

  register(id, table) {
    if (!table || typeof table !== 'object') {
      throw new Error(`Table "${id}" must be an object`)
    }
    if (!Array.isArray(table.entries)) {
      throw new Error(`Table "${id}" is missing an entries array`)
    }
    this.tables[id] = table
    return this
  }

  registerCondition(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error(`Condition handler for "${name}" must be a function`)
    }
    this.customConditions[name] = fn
    return this
  }

  roll(tableId, context = {}) {
    const table = this.tables[tableId]
    if (!table) throw new Error(`Unknown table: "${tableId}"`)

    const results = []
    const rolls = table.rolls ?? 1

    for (let i = 0; i < rolls; i++) {
      const drops = this._rollTable(table, context, tableId)
      results.push(...drops)
    }

    if (table.unique) {
      const seen = new Set()
      return results.filter(item => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    }

    return results
  }

  _rollTable(table, context, tableId) {
    const eligible = table.entries.filter(entry => {
      if (!entry.condition) return true
      return resolveCondition(entry.condition, context, this.customConditions, tableId)
    })

    if (eligible.length === 0) return []

    const results = []

    if (table.mode === 'all') {
      for (const entry of eligible) {
        if (this.rng() <= (entry.chance ?? 1)) {
          results.push(...this._resolveEntry(entry, context))
        }
      }
    } else {
      const picked = pickWeighted(eligible, this.rng)
      if (picked) {
        if (this.rng() <= (picked.chance ?? 1)) {
          results.push(...this._resolveEntry(picked, context))
        }
      }
    }

    return results
  }

  _resolveEntry(entry, context) {
    if (entry.type === 'table_ref') {
      return this.roll(entry.ref, context)
    }

    const qty = this._resolveQuantity(entry.quantity)

    return [{
      id: entry.id,
      name: entry.name ?? entry.id,
      quantity: qty,
      meta: entry.meta ?? {}
    }]
  }

  _resolveQuantity(quantity) {
    if (!quantity) return 1
    if (typeof quantity === 'number') return quantity
    if (typeof quantity === 'object' && quantity.min !== undefined) {
      const min = quantity.min
      const max = quantity.max ?? min
      return Math.floor(this.rng() * (max - min + 1)) + min
    }
    return 1
  }

  loadJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json
    for (const [id, table] of Object.entries(data)) {
      this.register(id, table)
    }
    return this
  }

  getTable(id) {
    return this.tables[id] ?? null
  }

  listTables() {
    return Object.keys(this.tables)
  }
}
