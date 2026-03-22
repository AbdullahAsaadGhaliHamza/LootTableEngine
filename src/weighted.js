export function pickWeighted(entries, rng = Math.random) {
  if (entries.length === 0) return null

  const total = entries.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  let roll = rng() * total

  for (const entry of entries) {
    roll -= entry.weight ?? 1
    if (roll <= 0) return entry
  }

  return entries[entries.length - 1]
}

export function buildWeightMap(entries) {
  const total = entries.reduce((sum, e) => sum + (e.weight ?? 1), 0)
  return entries.map(e => ({
    ...e,
    probability: ((e.weight ?? 1) / total * 100).toFixed(2) + '%'
  }))
}
