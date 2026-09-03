export function nid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10)
  return `${prefix}_${rand}`
}

export function issueCode(seq: number): string {
  return `IS-${String(seq).padStart(5, '0')}`
}
