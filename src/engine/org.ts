import type { DB, Org } from '../types'

export function orgById(db: DB, id: string | undefined | null): Org | undefined {
  if (!id) return undefined
  return db.orgs.find((o) => o.id === id)
}

export function ancestors(db: DB, orgId: string): Org[] {
  const out: Org[] = []
  let cur = orgById(db, orgId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    out.push(cur)
    cur = cur.parentId ? orgById(db, cur.parentId) : undefined
  }
  return out
}

export function descendantIds(db: DB, rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const o of db.orgs) {
      if (o.parentId && ids.has(o.parentId) && !ids.has(o.id)) {
        ids.add(o.id)
        grew = true
      }
    }
  }
  return ids
}

export function companyOf(db: DB, orgId: string): Org | undefined {
  return ancestors(db, orgId).find((o) => o.type === 'company')
}

export function orgPath(db: DB, orgId: string): string {
  return ancestors(db, orgId)
    .slice()
    .reverse()
    .map((o) => o.standardName)
    .join(' / ')
}

export function companies(db: DB): Org[] {
  return db.orgs.filter((o) => o.type === 'company' && o.status === 'active')
}

export function isUnder(db: DB, orgId: string, rootId: string): boolean {
  return descendantIds(db, rootId).has(orgId)
}
