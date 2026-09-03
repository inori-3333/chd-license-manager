import type { DB, MappingCandidate, MappingKind, NameMapping } from '../types'

const ALIAS: Record<string, string> = {
  注安师: '注册安全工程师证',
  注安: '注册安全工程师证',
  注册安全工程师: '注册安全工程师证',
  生技部: '生产技术部',
  生技: '生产技术部',
  电修: '电气检修',
  电修技术员: '电气检修技术员',
  电修班: '电气检修班',
  继保班: '继保班',
  安监部: '安全监察部',
  设备部: '设备管理部',
  高处作业证: '高处作业证',
  高压证: '高压电工作业证',
  高压电工证: '高压电工作业证',
  低压电工证: '低压电工作业证',
  学习岗: '技术员（见习）',
  '技术员（学习岗）': '技术员（见习）',
}

export function normalizeName(s: string): string {
  return s
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, (ch) => (ch === '（' || ch === '(' ? '(' : ')'))
    .replace(/班组$/, '班')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const d = levenshtein(a, b)
  return 1 - d / Math.max(a.length, b.length)
}

export interface StdTarget {
  id: string
  name: string
  extra?: string
}

export function scoreCandidate(raw: string, target: StdTarget): MappingCandidate | null {
  const nRaw = normalizeName(raw)
  const nT = normalizeName(target.name)
  const alias = ALIAS[raw] || ALIAS[nRaw]
  let score = similarity(nRaw, nT)
  let reason = '字符串近似'
  if (nRaw === nT) {
    score = 1
    reason = '标准化名称完全一致'
  } else if (alias && normalizeName(alias) === nT) {
    score = 0.96
    reason = `别名词典：${raw} → ${alias}`
  } else if (nT.includes(nRaw) || nRaw.includes(nT)) {
    score = Math.max(score, 0.82)
    reason = '包含匹配'
  } else if (alias && similarity(normalizeName(alias), nT) > 0.8) {
    score = Math.max(score, 0.88)
    reason = `别名近似：${alias}`
  }
  if (score < 0.45) return null
  return { standardId: target.id, standardName: target.name, score, reason }
}

export function suggest(kind: MappingKind, raw: string, db: DB, scopeOrgId?: string | null): MappingCandidate[] {
  const targets: StdTarget[] =
    kind === 'job'
      ? db.jobs.filter((j) => j.status === 'active').map((j) => ({ id: j.id, name: j.name, extra: j.category }))
      : kind === 'certificate'
        ? db.certificates.filter((c) => c.status === 'active').map((c) => ({ id: c.id, name: c.name }))
        : db.orgs
            .filter((o) => o.status === 'active')
            .filter((o) => {
              if (!scopeOrgId) return true
              if (o.id === scopeOrgId) return false
              return o.parentId === scopeOrgId || ancestorsQuick(db, o.id).includes(scopeOrgId)
            })
            .map((o) => ({ id: o.id, name: o.standardName }))

  const scored = targets
    .map((t) => scoreCandidate(raw, t))
    .filter((x): x is MappingCandidate => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return scored
}

function ancestorsQuick(db: DB, orgId: string): string[] {
  const ids: string[] = []
  let cur = db.orgs.find((o) => o.id === orgId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    ids.push(cur.id)
    cur = cur.parentId ? db.orgs.find((o) => o.id === cur!.parentId) : undefined
  }
  return ids
}

export function autoMatch(
  kind: MappingKind,
  raw: string,
  db: DB,
  scopeOrgId?: string | null,
): { mapping: NameMapping | null; mode: 'code' | 'exact' | 'history' | 'none' } {
  const nRaw = normalizeName(raw)

  if (kind === 'org') {
    const byCode = db.orgs.find((o) => o.code === raw || o.code === nRaw)
    if (byCode) return { mapping: null, mode: 'code' }
  }

  const exact =
    kind === 'job'
      ? db.jobs.find((j) => j.status === 'active' && (j.name === raw || normalizeName(j.name) === nRaw))
      : kind === 'certificate'
        ? db.certificates.find((c) => c.status === 'active' && (c.name === raw || normalizeName(c.name) === nRaw))
        : db.orgs.find((o) => o.status === 'active' && (o.standardName === raw || normalizeName(o.standardName) === nRaw))
  if (exact) return { mapping: null, mode: 'exact' }

  const confirmed = db.mappings.filter(
    (m) =>
      m.kind === kind &&
      m.status === 'confirmed' &&
      (m.originalName === raw || normalizeName(m.originalName) === nRaw) &&
      m.standardId,
  )
  const local = scopeOrgId
    ? confirmed.find((m) => m.scopeKind === 'local' && m.scopeOrgId === scopeOrgId)
    : undefined
  const global = confirmed.find((m) => m.scopeKind === 'global')
  const hit = local || global
  if (hit) return { mapping: hit, mode: 'history' }

  return { mapping: null, mode: 'none' }
}

export function resolveStandardId(
  kind: MappingKind,
  raw: string,
  db: DB,
  scopeOrgId?: string | null,
): { id: string | null; auto: boolean; reason: string } {
  const nRaw = normalizeName(raw)
  if (kind === 'org') {
    const byCode = db.orgs.find((o) => o.code === raw || o.code === nRaw)
    if (byCode) return { id: byCode.id, auto: true, reason: '权威组织编码一致' }
  }
  const exact =
    kind === 'job'
      ? db.jobs.find((j) => j.status === 'active' && (j.name === raw || normalizeName(j.name) === nRaw))
      : kind === 'certificate'
        ? db.certificates.find((c) => c.status === 'active' && (c.name === raw || normalizeName(c.name) === nRaw))
        : db.orgs.find((o) => o.status === 'active' && (o.standardName === raw || normalizeName(o.standardName) === nRaw))
  if (exact) return { id: exact.id, auto: true, reason: '标准名称完全一致' }

  const confirmed = db.mappings.filter(
    (m) =>
      m.kind === kind &&
      m.status === 'confirmed' &&
      (m.originalName === raw || normalizeName(m.originalName) === nRaw) &&
      m.standardId,
  )
  const local = scopeOrgId
    ? confirmed.find((m) => m.scopeKind === 'local' && m.scopeOrgId === scopeOrgId)
    : undefined
  const global = confirmed.find((m) => m.scopeKind === 'global')
  const hit = local || global
  if (hit?.standardId) {
    return { id: hit.standardId, auto: true, reason: '已确认历史映射' }
  }
  return { id: null, auto: false, reason: '需人工确认' }
}
