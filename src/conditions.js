export function resolveCondition(condition, context, customHandlers = {}, tableId = '?') {
  if (typeof condition === 'function') {
    return condition(context)
  }

  if (typeof condition === 'string') {
    if (customHandlers[condition]) {
      return customHandlers[condition](context)
    }
    return Boolean(context[condition])
  }

  if (typeof condition !== 'object' || condition === null) {
    throw new Error(`Invalid condition in table "${tableId}": ${JSON.stringify(condition)}`)
  }

  if ('and' in condition) {
    return condition.and.every(c => resolveCondition(c, context, customHandlers, tableId))
  }

  if ('or' in condition) {
    return condition.or.some(c => resolveCondition(c, context, customHandlers, tableId))
  }

  if ('not' in condition) {
    return !resolveCondition(condition.not, context, customHandlers, tableId)
  }

  if ('eq' in condition) {
    return context[condition.eq.key] === condition.eq.value
  }

  if ('gt' in condition) {
    return (context[condition.gt.key] ?? 0) > condition.gt.value
  }

  if ('gte' in condition) {
    return (context[condition.gte.key] ?? 0) >= condition.gte.value
  }

  if ('lt' in condition) {
    return (context[condition.lt.key] ?? 0) < condition.lt.value
  }

  if ('lte' in condition) {
    return (context[condition.lte.key] ?? 0) <= condition.lte.value
  }

  if ('in' in condition) {
    const val = context[condition.in.key]
    return Array.isArray(condition.in.values) && condition.in.values.includes(val)
  }

  if ('has_flag' in condition) {
    const flags = context.flags ?? []
    return flags.includes(condition.has_flag)
  }

  if ('fn' in condition) {
    const handler = customHandlers[condition.fn]
    if (!handler) {
      throw new Error(`No custom condition registered for "${condition.fn}" (used in table "${tableId}")`)
    }
    return handler(context, condition.args ?? {})
  }

  throw new Error(`Unrecognized condition shape in table "${tableId}": ${JSON.stringify(condition)}`)
}
