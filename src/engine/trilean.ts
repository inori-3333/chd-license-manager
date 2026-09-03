import type { Tri } from '../types'

export function and(a: Tri, b: Tri): Tri {
  if (a === 'false' || b === 'false') return 'false'
  if (a === 'unknown' || b === 'unknown') return 'unknown'
  return 'true'
}

export function or(a: Tri, b: Tri): Tri {
  if (a === 'true' || b === 'true') return 'true'
  if (a === 'unknown' || b === 'unknown') return 'unknown'
  return 'false'
}

export function not(a: Tri): Tri {
  if (a === 'true') return 'false'
  if (a === 'false') return 'true'
  return 'unknown'
}

export function andAll(values: Tri[]): Tri {
  return values.reduce<Tri>((acc, v) => and(acc, v), 'true')
}

export function orAll(values: Tri[]): Tri {
  return values.reduce<Tri>((acc, v) => or(acc, v), 'false')
}

export function fromBool(v: boolean): Tri {
  return v ? 'true' : 'false'
}
