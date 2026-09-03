export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}

export function num(n: number | null | undefined): string {
  if (n == null) return '—'
  return String(n)
}

export function cls(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ')
}

export const ROLE_LABEL: Record<string, string> = {
  admin: '系统管理员',
  hr: 'HR',
  specialist: '专业规则维护人',
  unit: '基层单位管理员',
  reviewer: '整改复核人',
}

export const ISSUE_CLASS: Record<string, string> = {
  data_quality: '数据质量',
  risk: '风险预警',
  compliance: '合规问题',
}

export const ISSUE_STATUS: Record<string, string> = {
  open: '待整改',
  remediating: '整改中',
  pending_review: '待复核',
  closed: '已销项',
  resolved_pending_close: '已消除待销项',
}

export const RULE_STATUS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  pending_effective: '待生效',
  active: '生效中',
  expired: '已失效',
  rejected: '已驳回',
}

export const RULE_TYPE: Record<string, string> = {
  personal_mandatory: '个人强制持证',
  group_ratio: '群体比例',
  transition: '过渡期',
  new_post: '新上岗',
  incentive: '激励提升',
}

export const CERT_CAT: Record<string, string> = {
  national: '国家管控类',
  group: '集团管控类',
  incentive: '激励提升类',
}

export const JUDGE: Record<string, string> = {
  compliant: '合规',
  noncompliant: '不合规',
  undecidable: '无法判定',
  out_of_scope: '不在范围',
}

export const ITEM_STATUS: Record<string, string> = {
  satisfied: '已满足',
  missing: '应持未持',
  expired: '证书过期',
  review_overdue: '复审逾期',
  grade_insufficient: '等级不足',
  in_transition: '过渡期内',
  unknown: '无法判定',
}

export const MAP_KIND: Record<string, string> = {
  org: '组织',
  job: '岗位',
  certificate: '证书',
}
