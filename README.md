# loot-table-engine

A weighted, nested loot table system with JSON config and full scripted condition support.

Most loot engines handle the easy case: pick a random item with weights. This one handles the hard case: *should this item even be possible right now?* You can gate drops on flags, numeric comparisons, custom functions, and arbitrary boolean logic, all from JSON or code.

---

## Features

- Weighted random drops per table
- Multiple rolls per table, with optional uniqueness enforcement
- `mode: "all"` for tables where every entry is evaluated independently
- Nested table references (a drop can trigger a whole other table)
- Per-entry `chance` for secondary probability after a weighted pick
- Conditions via JSON (flags, comparisons, AND/OR/NOT trees) or custom JS functions
- A CLI for rolling and inspecting tables without writing any code
- Zero dependencies

---

## Install

```bash
npm install loot-table-engine
```

Or clone and use directly:

```bash
git clone https://github.com/yourname/loot-table-engine
cd loot-table-engine
node examples/basic_usage.js
```

---

## Quick Start

```js
import { LootEngine } from 'loot-table-engine'

const engine = new LootEngine({
  goblin: {
    entries: [
      { id: 'gold',   name: 'Gold Coin',   weight: 50, quantity: { min: 1, max: 8 } },
      { id: 'dagger', name: 'Iron Dagger', weight: 30 },
      { id: 'junk',   name: 'Pocket Lint', weight: 20 },
    ]
  }
})

engine.roll('goblin', {})
```

Output:
```js
[{ id: 'gold', name: 'Gold Coin', quantity: 4, meta: {} }]
```

---

## Conditions

Conditions let you gate individual entries on the state of the world when the roll happens. You pass that state as the second argument to `roll()` (the "context").

### Built-in condition types

**Flag check**
```json
{ "has_flag": "boss_killed_with_fire" }
```
Checks `context.flags` array for the given string.

**Key check**
```json
"is_night"
```
A plain string checks `context.is_night` for truthiness.

**Comparisons**
```json
{ "gte": { "key": "player_level", "value": 20 } }
```
Supports `eq`, `gt`, `gte`, `lt`, `lte`, and `in`.

**Boolean logic**
```json
{
  "and": [
    { "has_flag": "dragon_slain" },
    { "gte": { "key": "player_level", "value": 20 } }
  ]
}
```
`and`, `or`, and `not` all work and can be nested arbitrarily deep.

**Custom functions**
```json
{ "fn": "rogue_or_high_dex", "args": { "min_dex": 14 } }
```
Then register it in JS:
```js
engine.registerCondition('rogue_or_high_dex', (ctx, args) => {
  return ctx.class === 'rogue' || ctx.dex >= args.min_dex
})
```
This is how you handle anything that can't be expressed as a JSON comparison.

---

## Table Options

```json
{
  "chest_boss": {
    "rolls": 2,
    "mode": "weighted",
    "unique": true,
    "entries": [...]
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rolls` | integer | 1 | How many times to pick from this table |
| `mode` | `"weighted"` or `"all"` | `"weighted"` | `weighted` picks one entry per roll. `all` evaluates every entry with its own `chance`. |
| `unique` | boolean | false | Prevents the same `id` from appearing more than once in results |

---

## Entry Options

```json
{
  "id": "fire_tome",
  "name": "Tome of Embers",
  "weight": 25,
  "chance": 0.4,
  "quantity": { "min": 1, "max": 3 },
  "condition": { "has_flag": "boss_killed_with_fire" },
  "meta": { "element": "fire", "rarity": "rare" }
}
```

| Field | Description |
|-------|-------------|
| `id` | Identifier for the dropped item |
| `name` | Human-readable name (falls back to `id`) |
| `weight` | Relative weight for the weighted pick (default 1) |
| `chance` | After being picked, probability it actually drops (0 to 1, default 1) |
| `quantity` | Fixed number or `{ min, max }` range |
| `condition` | Any condition shape from the section above |
| `meta` | Arbitrary object attached to the result, untouched by the engine |

---

## Nested Tables

Set `type: "table_ref"` and point `ref` at another table id. The nested table is rolled and its results are merged into the current roll.

```json
{
  "chest_boss": {
    "mode": "all",
    "entries": [
      { "id": "weapon_slot", "type": "table_ref", "ref": "boss_weapons", "chance": 1 },
      { "id": "gem",         "name": "Sapphire",  "chance": 0.4 }
    ]
  }
}
```

---

## API

### `new LootEngine(tables?, options?)`

`tables` is an object where keys are table ids and values are table definitions. `options` accepts `rng` (a custom random function, e.g. a seeded one) and `seed` for documentation purposes.

### `engine.register(id, table)`

Registers a single table. Returns the engine for chaining.

### `engine.registerCondition(name, fn)`

Registers a custom condition handler. `fn` receives `(context, args)` and should return a boolean. Returns the engine for chaining.

### `engine.roll(tableId, context)`

Rolls a table and returns an array of drop objects. Each object has `id`, `name`, `quantity`, and `meta`.

### `engine.loadJSON(json)`

Loads multiple tables from a JSON string or parsed object.

### `engine.getTable(id)`

Returns the raw table definition, or `null` if not found.

### `engine.listTables()`

Returns an array of all registered table ids.

---

## CLI

```bash
# Roll a table
loot-engine roll examples/fantasy_rpg.json goblin_pouch

# Roll with context
loot-engine roll examples/fantasy_rpg.json chest_boss \
  --flags boss_killed_with_fire,dragon_slain \
  --ctx player_level=25

# Roll multiple times
loot-engine roll examples/fantasy_rpg.json goblin_pouch --rolls 10

# Show entry weights and conditions for a table
loot-engine inspect examples/fantasy_rpg.json merchant_daily

# List all tables in a file
loot-engine list examples/fantasy_rpg.json
```

---

## Running Tests

```bash
npm test
```

Uses Node's built-in test runner, no extra packages needed.

---

## JSON Schema

There's a schema at `schema/loot-table.schema.json` you can point your editor at for autocomplete and validation:

```json
{
  "$schema": "./node_modules/loot-table-engine/schema/loot-table.schema.json"
}
```

---

## License

MIT
