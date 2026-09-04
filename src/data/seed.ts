import type {
  Assignment,
  CertHolding,
  DB,
  NameMapping,
  Person,
  PersonWorkScope,
  Rule,
  Snapshot,
  StandardJob,
  WarningScheme,
} from '../types'
import { calculateAll } from '../engine/calculate'
import { suggest } from '../engine/standardize'
import positions from './positions.json'
import { classifyPosition, isHvCategory, shouldLeaveUnmapped, type PositionRow } from './positions'

const WARN: WarningScheme = {
  expiryEnabled: true,
  expiryNodes: [180, 90, 30, 7],
  reviewEnabled: true,
  reviewNodes: [90, 30, 7],
  transitionNodes: [30, 7],
}

const AS_OF = '2026-09-03'

export const DEMO = {
  missingScope: 'demo_missingScope',
  finance: 'demo_finance',
  missingCert: 'demo_missingCert',
  exp180: 'demo_exp180',
  exp90: 'demo_exp90',
  exp30: 'demo_exp30',
  exp7: 'demo_exp7',
  expired: 'demo_expired',
  review: 'demo_review',
  transition: 'demo_transition',
  unmappedCert: 'demo_unmappedCert',
  concurrent: 'demo_concurrent',
  unmappedJob: 'demo_unmappedJob',
} as const

const DEMO_NAMES: Record<string, string> = {
  [DEMO.missingScope]: '郑华',
  [DEMO.finance]: '高明',
  [DEMO.missingCert]: '王芳',
  [DEMO.exp180]: '刘洋',
  [DEMO.exp90]: '陈静',
  [DEMO.exp30]: '赵磊',
  [DEMO.exp7]: '孙浩',
  [DEMO.expired]: '周敏',
  [DEMO.review]: '吴迪',
  [DEMO.transition]: '罗斌',
  [DEMO.unmappedCert]: '朱琳',
  [DEMO.concurrent]: '冯军',
  [DEMO.unmappedJob]: '李强',
}

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜'.split('')
const GIVEN = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '华', '文', '斌']

function generatedName(i: number): string {
  const s = SURNAMES[i % SURNAMES.length]
  const g = GIVEN[Math.floor(i / SURNAMES.length) % GIVEN.length]
  const round = Math.floor(i / (SURNAMES.length * GIVEN.length))
  return round === 0 ? s + g : `${s}${g}${round + 1}`
}

function deptType(name: string): 'department' | 'workshop' {
  if (/车间|分场|队|中心/.test(name)) return 'workshop'
  return 'department'
}

export function buildSeed(): DB {
  const rows = positions as PositionRow[]
  const clsOf = rows.map((p) => classifyPosition(p))

  const pick = (pred: (p: PositionRow, i: number) => boolean, used: Set<number>) => {
    const i = rows.findIndex((p, idx) => !used.has(idx) && pred(p, idx))
    if (i >= 0) used.add(i)
    return i
  }
  const used = new Set<number>()
  const idx = {
    unmappedJob: pick((p) => shouldLeaveUnmapped(p.j), used),
    finance: pick((p, i) => clsOf[i].category === '财务管理' && p.c === 'A公司', used),
    missingScope: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category) && !shouldLeaveUnmapped(p.j), used),
    missingCert: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category) && !shouldLeaveUnmapped(p.j), used),
    exp180: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    exp90: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    exp30: pick((p, i) => isHvCategory(clsOf[i].category), used),
    exp7: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    expired: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    review: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    transition: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
    unmappedCert: pick((p, i) => p.c === 'A公司' && clsOf[i].category === '安全管理', used),
    concurrent: pick((p, i) => p.c === 'A公司' && isHvCategory(clsOf[i].category), used),
  }
  if (idx.finance < 0) idx.finance = pick((p, i) => clsOf[i].category === '财务管理', used)
  if (idx.unmappedCert < 0) idx.unmappedCert = pick((p, i) => clsOf[i].category === '安全管理', used)
  if (idx.unmappedJob < 0) idx.unmappedJob = pick((p) => /学习岗|见习/.test(p.j), used)

  const demoByRow = new Map<number, string>()
  const assignDemo = (row: number, id: string) => {
    if (row >= 0) demoByRow.set(row, id)
  }
  assignDemo(idx.missingScope, DEMO.missingScope)
  assignDemo(idx.finance, DEMO.finance)
  assignDemo(idx.missingCert, DEMO.missingCert)
  assignDemo(idx.exp180, DEMO.exp180)
  assignDemo(idx.exp90, DEMO.exp90)
  assignDemo(idx.exp30, DEMO.exp30)
  assignDemo(idx.exp7, DEMO.exp7)
  assignDemo(idx.expired, DEMO.expired)
  assignDemo(idx.review, DEMO.review)
  assignDemo(idx.transition, DEMO.transition)
  assignDemo(idx.unmappedCert, DEMO.unmappedCert)
  assignDemo(idx.concurrent, DEMO.concurrent)
  assignDemo(idx.unmappedJob, DEMO.unmappedJob)

  const users = [
    { id: 'u_admin', name: '陈管理员', role: 'admin' as const, title: '系统管理员' },
    { id: 'u_hr', name: '李人资', role: 'hr' as const, title: '人力资源部' },
    { id: 'u_spec', name: '王专工', role: 'specialist' as const, title: '电气专业规则维护人' },
    { id: 'u_unit', name: '赵班长', role: 'unit' as const, orgScopeId: 'org_co_A公司', title: 'A公司基层管理员' },
    { id: 'u_rev', name: '钱安全', role: 'reviewer' as const, title: '整改复核人' },
  ]

  const orgs: DB['orgs'] = [
    {
      id: 'org_root',
      parentId: null,
      code: 'GRP',
      type: 'group',
      standardName: '能源控股集团',
      originalName: '能源控股集团',
      effectiveFrom: '2010-01-01',
      effectiveTo: null,
      status: 'active',
    },
  ]
  const companyIds = new Map<string, string>()
  const deptIds = new Map<string, string>()
  const teamIds = new Map<string, string>()
  for (const p of rows) {
    if (!companyIds.has(p.c)) {
      const id = `org_co_${p.c}`
      companyIds.set(p.c, id)
      orgs.push({
        id,
        parentId: 'org_root',
        code: p.c.replace(/公司$/, ''),
        type: 'company',
        standardName: p.c,
        originalName: p.c,
        effectiveFrom: '2012-01-01',
        effectiveTo: null,
        status: 'active',
      })
    }
    const dk = `${p.c}/${p.d}`
    if (p.d && !deptIds.has(dk)) {
      const id = `org_dept_${p.c}_${p.d}`
      deptIds.set(dk, id)
      orgs.push({
        id,
        parentId: companyIds.get(p.c)!,
        code: `${p.c.replace(/公司$/, '')}-${p.d}`,
        type: deptType(p.d),
        standardName: p.d,
        originalName: p.d,
        effectiveFrom: '2012-01-01',
        effectiveTo: null,
        status: 'active',
      })
    }
    const tk = `${p.c}/${p.d}/${p.t}`
    if (p.t && !teamIds.has(tk)) {
      const id = `org_team_${p.c}_${p.d}_${p.t}`
      teamIds.set(tk, id)
      orgs.push({
        id,
        parentId: deptIds.get(dk)!,
        code: `${p.c.replace(/公司$/, '')}-${p.d}-${p.t}`,
        type: 'team',
        standardName: p.t,
        originalName: p.t,
        effectiveFrom: '2012-01-01',
        effectiveTo: null,
        status: 'active',
      })
    }
  }

  const jobs: StandardJob[] = []
  const jobKey = (category: string, name: string) => `${category}::${name}`
  const jobIds = new Map<string, string>()
  rows.forEach((p, i) => {
    if (shouldLeaveUnmapped(p.j)) return
    const cls = clsOf[i]
    const key = jobKey(cls.category, p.j)
    if (jobIds.has(key)) return
    const id = `job_${jobIds.size + 1}`
    jobIds.set(key, id)
    jobs.push({
      id,
      name: p.j,
      major: cls.major,
      category: cls.category,
      sequence: cls.sequence,
      isProduction: cls.isProduction,
      tags: [cls.major],
      status: 'active',
      effectiveFrom: '2020-01-01',
      effectiveTo: null,
    })
  })

  const workScopeTags = [
    { id: 'ws_hv', name: '高压电气作业', group: '电气' },
    { id: 'ws_lv', name: '低压电气作业', group: '电气' },
    { id: 'ws_cable', name: '电力电缆作业', group: '电气' },
    { id: 'ws_relay', name: '继电保护作业', group: '电气' },
    { id: 'ws_test', name: '电气试验', group: '电气' },
    { id: 'ws_height', name: '高处作业', group: '安监' },
    { id: 'ws_crane_d', name: '起重司机', group: '起重' },
    { id: 'ws_crane_c', name: '起重指挥', group: '起重' },
    { id: 'ws_fork', name: '叉车操作', group: '特种' },
    { id: 'ws_h2', name: '氢系统操作', group: '特种' },
    { id: 'ws_confine', name: '有限空间作业', group: '安监' },
    { id: 'ws_se', name: '特种设备安全管理', group: '安监' },
    { id: 'ws_safety', name: '专职安全监督', group: '安监' },
    { id: 'ws_tech', name: '技术监督专责', group: '监督' },
  ]

  const certificates = [
    { id: 'cert_hv', name: '高压电工作业证', category: 'national' as const, subCategory: '特种作业', series: 'electrical', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_lv', name: '低压电工作业证', category: 'national' as const, subCategory: '特种作业', series: 'electrical_lv', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_height', name: '高处作业证', category: 'national' as const, subCategory: '特种作业', series: 'height', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_crane_c', name: '起重指挥证', category: 'national' as const, subCategory: '特种作业', series: 'crane', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_fork', name: '叉车操作证', category: 'national' as const, subCategory: '特种作业', series: 'fork', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_cse', name: '注册安全工程师证', category: 'group' as const, subCategory: '执业资格', series: 'cse', grade: '中级', gradeOrder: 2, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_cse_h', name: '注册安全工程师证（高级）', category: 'group' as const, subCategory: '执业资格', series: 'cse', grade: '高级', gradeOrder: 3, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_se', name: '特种设备安全管理证', category: 'group' as const, subCategory: '特种设备', series: 'se_mgmt', grade: null, gradeOrder: null, hasExpiry: true, needsReview: true, warning: WARN, status: 'active' as const },
    { id: 'cert_eng_m', name: '中级工程师职称', category: 'incentive' as const, subCategory: '职称', series: 'engineer', grade: '中级', gradeOrder: 2, hasExpiry: false, needsReview: false, warning: { ...WARN, expiryEnabled: false }, status: 'active' as const },
    { id: 'cert_eng_h', name: '高级工程师职称', category: 'incentive' as const, subCategory: '职称', series: 'engineer', grade: '高级', gradeOrder: 3, hasExpiry: false, needsReview: false, warning: { ...WARN, expiryEnabled: false }, status: 'active' as const },
  ]

  const people: Person[] = []
  const assignments: Assignment[] = []
  const personWorkScopes: PersonWorkScope[] = []
  const holdings: CertHolding[] = []
  const seqByCo = new Map<string, number>()

  rows.forEach((p, i) => {
    const cls = clsOf[i]
    const demoId = demoByRow.get(i)
    const personId = demoId ?? `p_${String(i + 1).padStart(4, '0')}`
    const n = (seqByCo.get(p.c) ?? 0) + 1
    seqByCo.set(p.c, n)
    const prefix = p.c.replace(/公司$/, '') || 'X'
    const employeeNo = `${prefix}${String(n).padStart(3, '0')}`
    const name = demoId && DEMO_NAMES[demoId] ? DEMO_NAMES[demoId] : generatedName(i)
    people.push({
      id: personId,
      employeeNo,
      name,
      idMasked: '**************',
      status: 'active',
      source: '岗位示例表.xlsx',
    })

    const orgId = p.t ? teamIds.get(`${p.c}/${p.d}/${p.t}`)! : deptIds.get(`${p.c}/${p.d}`)!
    const unmapped = shouldLeaveUnmapped(p.j) || demoId === DEMO.unmappedJob
    const stdId = unmapped ? null : jobIds.get(jobKey(cls.category, p.j)) ?? null
    const startDate = demoId === DEMO.transition ? '2026-08-01' : i % 9 === 0 ? '2022-03-01' : '2018-01-01'
    assignments.push({
      id: `asg_${personId}`,
      personId,
      orgId,
      originalOrgName: p.t || p.d,
      originalJobName: p.j || '(空)',
      standardJobId: stdId,
      jobStdStatus: stdId ? 'mapped' : 'unmapped',
      kind: 'primary',
      startDate,
      endDate: null,
      source: '岗位示例表.xlsx',
    })
    if (demoId === DEMO.concurrent) {
      assignments.push({
        id: `asg_${personId}_c`,
        personId,
        orgId,
        originalOrgName: p.t || p.d,
        originalJobName: '起重指挥（兼岗）',
        standardJobId: stdId,
        jobStdStatus: stdId ? 'mapped' : 'unmapped',
        kind: 'concurrent',
        startDate: '2020-01-01',
        endDate: null,
        source: 'seed-overlay',
      })
    }

    const skipScope = demoId === DEMO.missingScope || unmapped
    if (!skipScope) {
      const tags: string[] = []
      if (isHvCategory(cls.category)) tags.push('ws_hv')
      if (cls.category === '安全管理') tags.push('ws_safety')
      if (/焊工/.test(p.j)) tags.push('ws_height')
      if (/起重/.test(p.j) || demoId === DEMO.concurrent) tags.push('ws_crane_c')
      tags.forEach((tagId, k) => {
        personWorkScopes.push({
          id: `ws_${personId}_${k}`,
          personId,
          tagId,
          source: 'seed-confirmed',
          confirmed: true,
          confirmedBy: '赵班长',
          confirmedAt: '2026-01-15T00:00:00.000Z',
          startDate: demoId === DEMO.transition ? '2026-08-01' : '2020-01-01',
          endDate: null,
        })
      })
    }

    const hold = (
      id: string,
      certId: string | null,
      originalName: string,
      mapped: boolean,
      obtainedAt: string,
      validTo: string | null,
      reviewDate: string | null,
      hasExpiry = true,
    ) => {
      holdings.push({
        id,
        personId,
        standardCertId: certId,
        originalName,
        certStdStatus: mapped ? 'mapped' : 'unmapped',
        certNo: `${(certId ?? 'X').toUpperCase()}-${employeeNo}`,
        issuer: '省级应急管理部门',
        obtainedAt,
        validFrom: obtainedAt,
        validTo: hasExpiry ? validTo : null,
        reviewDate,
        registerStatus: '有效',
        source: 'seed',
      })
    }

    if (demoId === DEMO.exp180) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2017-03-01', '2027-03-02', '2026-12-01')
    else if (demoId === DEMO.exp90) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2016-08-01', '2026-12-02', '2026-10-01')
    else if (demoId === DEMO.exp30) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2021-05-01', '2026-10-03', '2026-09-20')
    else if (demoId === DEMO.exp7) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2015-10-01', '2026-09-10', '2026-09-08')
    else if (demoId === DEMO.expired) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2014-02-01', '2026-08-01', '2026-07-01')
    else if (demoId === DEMO.review) hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2013-09-01', '2027-09-01', '2026-07-01')
    else if (demoId === DEMO.unmappedCert) hold(`h_${personId}`, null, '注安师', false, '2019-05-01', '2028-05-01', '2027-05-01')
    else if (demoId === DEMO.concurrent) {
      hold(`h_${personId}_hv`, 'cert_hv', '高压电工作业证', true, '2018-04-01', '2028-04-01', '2027-04-01')
      hold(`h_${personId}_cr`, 'cert_crane_c', '起重指挥证', true, '2020-02-01', '2028-02-01', '2027-02-01')
    } else if (demoId === DEMO.missingCert || demoId === DEMO.missingScope || demoId === DEMO.transition || demoId === DEMO.unmappedJob) {
      /* no HV cert */
    } else if (isHvCategory(cls.category) && !unmapped) {
      hold(`h_${personId}`, 'cert_hv', '高压电工作业证', true, '2019-06-01', '2028-06-01', '2027-06-01')
    }

    if (cls.category === '安全管理' && demoId !== DEMO.unmappedCert && !unmapped) {
      const give = p.c !== 'A公司' || i % 3 === 0
      if (give) hold(`h_${personId}_cse`, 'cert_cse', '注册安全工程师证', true, '2020-04-01', '2028-04-01', '2027-04-01')
    }
    if (/焊工/.test(p.j) && demoId !== DEMO.unmappedJob) {
      hold(`h_${personId}_ht`, 'cert_height', '高处作业证', true, '2021-01-01', '2028-01-01', '2027-01-01')
    }
    if (cls.isProduction && i % 11 === 0 && demoId !== DEMO.unmappedJob) {
      hold(`h_${personId}_eng`, 'cert_eng_m', '中级工程师职称', true, '2018-01-01', null, null, false)
    }
  })

  const pendingNames = new Map<string, { kind: NameMapping['kind']; originalName: string; scopeOrgId: string | null; usage: number }>()
  rows.forEach((p, i) => {
    if (shouldLeaveUnmapped(p.j) || demoByRow.get(i) === DEMO.unmappedJob) {
      const name = p.j || '(空)'
      const cur = pendingNames.get('job:' + name) ?? { kind: 'job' as const, originalName: name, scopeOrgId: companyIds.get(p.c) ?? null, usage: 0 }
      cur.usage += 1
      pendingNames.set('job:' + name, cur)
    }
  })
  pendingNames.set('cert:注安师', { kind: 'certificate', originalName: '注安师', scopeOrgId: null, usage: 1 })

  const mappings: NameMapping[] = [
    ...[...pendingNames.values()].map((m, i): NameMapping => ({
      id: `map_pending_${i}`,
      kind: m.kind,
      originalName: m.originalName,
      standardId: null,
      standardName: null,
      scopeKind: m.scopeOrgId ? 'local' : 'global',
      scopeOrgId: m.scopeOrgId,
      source: 'manual',
      status: 'pending',
      usageCount: m.usage,
      candidates: [],
      history: [{ at: '2026-09-01T01:00:00.000Z', by: 'system', action: 'create_pending' }],
    })),
    {
      id: 'map_hist_hv',
      kind: 'certificate',
      originalName: '高压电工证',
      standardId: 'cert_hv',
      standardName: '高压电工作业证',
      scopeKind: 'global',
      scopeOrgId: null,
      source: 'manual',
      confirmedBy: '李人资',
      confirmedAt: '2025-11-02T08:00:00.000Z',
      status: 'confirmed',
      usageCount: 14,
      candidates: [],
      history: [{ at: '2025-11-02T08:00:00.000Z', by: '李人资', action: 'confirm' }],
    },
  ]

  const rules: Rule[] = [
    {
      id: 'rule_hv_v1',
      code: 'R-HV',
      name: '高压电气作业强制持证',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_hv',
      status: 'expired',
      condition: {
        logic: 'AND',
        conditions: [
          { field: 'job_category', operator: 'IN', value: ['电气检修'] },
          { field: 'work_scope', operator: 'CONTAINS', value: '高压电气作业' },
        ],
      },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_hv' }] },
      effectiveFrom: '2024-01-01',
      effectiveTo: '2024-12-31',
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      reviewedAt: '2023-12-15T00:00:00.000Z',
      notes: '历史版本：仅覆盖电气检修。',
    },
    {
      id: 'rule_hv_v2',
      code: 'R-HV',
      name: '高压电气作业强制持证',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 2,
      familyId: 'fam_hv',
      status: 'active',
      condition: {
        logic: 'AND',
        conditions: [
          { field: 'job_category', operator: 'IN', value: ['电气检修', '电气运行', '集控运行'] },
          { field: 'work_scope', operator: 'CONTAINS', value: '高压电气作业' },
        ],
      },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_hv' }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      reviewedAt: '2024-12-20T00:00:00.000Z',
      notes: '现行版本：覆盖电气检修、电气运行与集控运行。数据来自岗位示例表。',
      supersedesId: 'rule_hv_v1',
    },
    {
      id: 'rule_lv',
      code: 'R-LV',
      name: '低压电气作业强制持证',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_lv',
      status: 'active',
      condition: { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '低压电气作业' }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_lv' }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '',
    },
    {
      id: 'rule_height',
      code: 'R-HT',
      name: '高处作业强制持证',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_ht',
      status: 'active',
      condition: { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '高处作业' }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_height' }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '',
    },
    {
      id: 'rule_crane',
      code: 'R-CR',
      name: '起重指挥强制持证',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_cr',
      status: 'active',
      condition: { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '起重指挥' }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_crane_c' }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '',
    },
    {
      id: 'rule_cse',
      code: 'R-CSE',
      name: '专职安全监督注册安全工程师持证率',
      type: 'group_ratio',
      certCategory: 'group',
      version: 1,
      familyId: 'fam_cse',
      status: 'active',
      condition: { logic: 'AND', conditions: [{ field: 'job_category', operator: 'IN', value: ['安全管理'] }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_cse', minGradeOrder: 2 }] },
      stages: [
        { until: '2026-12-31', target: 0.5, label: '2026年底 ≥50%' },
        { until: '2028-12-31', target: 0.75, label: '2028年底 ≥75%' },
        { until: '9999-12-31', target: 1, label: '2029年起 =100%' },
      ],
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '群体比例达标不等于每一名未持证人员都合规。适用岗位类别来自岗位示例表中的安全专工/安培专工等。',
    },
    {
      id: 'rule_new',
      code: 'R-NEW',
      name: '新上岗高压作业过渡期',
      type: 'new_post',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_new',
      status: 'active',
      condition: {
        logic: 'AND',
        conditions: [
          { field: 'job_category', operator: 'IN', value: ['电气检修', '电气运行', '集控运行'] },
          { field: 'work_scope', operator: 'CONTAINS', value: '高压电气作业' },
        ],
      },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_hv' }] },
      transitionDays: 90,
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '新上岗以任职/作业开始日期计算，不以入职日期计算。',
    },
    {
      id: 'rule_inc',
      code: 'R-INC',
      name: '生产岗位中级工程师及以上激励提升',
      type: 'incentive',
      certCategory: 'incentive',
      version: 1,
      familyId: 'fam_inc',
      status: 'active',
      condition: { logic: 'AND', conditions: [{ field: 'is_production', operator: 'EQ', value: 'true' }] },
      requirement: { logic: 'OR', items: [{ certificateId: 'cert_eng_m', minGradeOrder: 2 }, { certificateId: 'cert_eng_h', minGradeOrder: 3 }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      notes: '激励提升类不生成无证上岗违规。',
    },
    {
      id: 'rule_cable_draft',
      code: 'R-CAB',
      name: '电力电缆作业持证（草稿）',
      type: 'personal_mandatory',
      certCategory: 'national',
      version: 1,
      familyId: 'fam_cab',
      status: 'pending_review',
      condition: { logic: 'AND', conditions: [{ field: 'work_scope', operator: 'CONTAINS', value: '电力电缆作业' }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_hv' }] },
      effectiveFrom: '2026-10-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      submittedBy: 'u_spec',
      submittedAt: '2026-09-01T02:00:00.000Z',
      notes: '待 HR 审核发布。',
    },
    {
      id: 'rule_cse_conflict',
      code: 'R-CSE-X',
      name: '专职安全监督持证率（冲突草稿）',
      type: 'group_ratio',
      certCategory: 'group',
      version: 1,
      familyId: 'fam_cse_x',
      status: 'draft',
      condition: { logic: 'AND', conditions: [{ field: 'job_category', operator: 'IN', value: ['安全管理'] }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_cse', minGradeOrder: 2 }] },
      stages: [{ until: '2026-12-31', target: 1, label: '2026年底 =100%' }],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      notes: '与现行 R-CSE 阶段目标冲突，发布前应被阻止。',
    },
  ]

  const n = people.length
  const snapshots: Snapshot[] = [
    snap('2026-04-01', n, Math.round(n * 0.72), Math.round(n * 0.48), 0.667, 0.61, 0.72, 40, 28, 90),
    snap('2026-05-01', n, Math.round(n * 0.74), Math.round(n * 0.51), 0.684, 0.64, 0.74, 38, 30, 85),
    snap('2026-06-01', n, Math.round(n * 0.76), Math.round(n * 0.56), 0.737, 0.67, 0.76, 36, 32, 80),
    snap('2026-07-01', n, Math.round(n * 0.78), Math.round(n * 0.55), 0.7, 0.68, 0.78, 42, 33, 75),
    snap('2026-08-01', n, Math.round(n * 0.8), Math.round(n * 0.6), 0.75, 0.7, 0.8, 39, 35, 70),
  ]

  const db: DB = {
    version: 2,
    asOfDate: AS_OF,
    currentUserId: 'u_admin',
    users,
    orgs,
    people,
    jobs,
    assignments,
    workScopeTags,
    personWorkScopes,
    certificates,
    holdings,
    mappings,
    rules,
    issues: [],
    remediations: [],
    batches: [
      {
        id: 'bat_seed',
        at: '2026-09-01T01:00:00.000Z',
        by: '陈管理员',
        filename: '岗位示例表.xlsx',
        total: rows.length,
        accepted: rows.length,
        standardized: rows.filter((p) => !shouldLeaveUnmapped(p.j)).length,
        pending: rows.filter((p) => shouldLeaveUnmapped(p.j)).length,
        rejected: 0,
        errors: [],
        notes: `来自岗位示例表：${rows.length} 条岗位。导入成功 ≠ 标准化完成 ≠ 可参与正式统计。`,
      },
    ],
    snapshots,
    audit: [
      {
        id: 'aud1',
        at: '2026-09-01T01:00:00.000Z',
        actorId: 'u_admin',
        actorName: '陈管理员',
        action: '导入',
        target: '岗位示例表.xlsx',
        detail: `装载 ${rows.length} 条公司-部门-班组-岗位`,
      },
      {
        id: 'aud2',
        at: '2024-12-20T00:00:00.000Z',
        actorId: 'u_hr',
        actorName: '李人资',
        action: '规则发布',
        target: 'R-HV v2',
        detail: '审核通过高压电气作业强制持证 v2',
      },
    ],
  }

  db.mappings = db.mappings.map((m) =>
    m.status === 'pending' ? { ...m, candidates: suggest(m.kind, m.originalName, db, m.scopeOrgId) } : m,
  )

  const calc = calculateAll(db, AS_OF)
  db.issues = calc.issues
  db.lastCalcAt = '2026-09-03T08:00:00.000Z'
  db.snapshots = [
    ...snapshots,
    {
      id: 'snap_now',
      asOf: AS_OF,
      capturedAt: db.lastCalcAt,
      source: 'seed',
      managed: calc.stats.managed,
      decidable: calc.stats.decidable,
      compliant: calc.stats.compliant,
      personRate: calc.stats.personRate,
      itemRate: calc.stats.itemRate,
      coverage: calc.stats.coverage,
      complianceIssues: calc.stats.complianceIssues,
      riskIssues: calc.stats.riskIssues,
      qualityIssues: calc.stats.qualityIssues,
    },
  ]

  const nameOf = (id: string) => db.people.find((p) => p.id === id)?.name ?? ''
  const wf = db.issues.find((i) => i.personId === DEMO.missingCert && i.class === 'compliance' && i.title.includes('应持未持'))
  if (wf) {
    wf.status = 'open'
    wf.dueDate = '2026-09-20'
  }
  const expired = db.issues.find((i) => i.personId === DEMO.expired && i.class === 'compliance' && i.title.includes('过期'))
  if (expired) {
    expired.status = 'remediating'
    expired.assigneeId = 'u_unit'
    db.remediations.push({
      id: 'rem1',
      issueId: expired.id,
      at: '2026-09-02T03:00:00.000Z',
      by: '赵班长',
      action: '开始整改',
      comment: `已通知${nameOf(DEMO.expired)}办理换证，预约下周考试。`,
    })
  }
  const review = db.issues.find((i) => i.personId === DEMO.review && i.title.includes('复审'))
  if (review) {
    review.status = 'pending_review'
    review.assigneeId = 'u_unit'
    review.reviewerId = 'u_rev'
    db.remediations.push(
      {
        id: 'rem2',
        issueId: review.id,
        at: '2026-08-20T03:00:00.000Z',
        by: '赵班长',
        action: '开始整改',
        comment: '已提交复审材料。',
      },
      {
        id: 'rem3',
        issueId: review.id,
        at: '2026-09-01T06:00:00.000Z',
        by: '赵班长',
        action: '提交复核',
        comment: '复审回执已上传，请复核。',
      },
    )
  }

  return db
}

function snap(
  asOf: string,
  managed: number,
  decidable: number,
  compliant: number,
  personRate: number,
  itemRate: number,
  coverage: number,
  complianceIssues: number,
  riskIssues: number,
  qualityIssues: number,
): Snapshot {
  return {
    id: `snap_${asOf}`,
    asOf,
    capturedAt: asOf + 'T16:00:00.000Z',
    source: 'scheduled',
    managed,
    decidable,
    compliant,
    personRate,
    itemRate,
    coverage,
    complianceIssues,
    riskIssues,
    qualityIssues,
  }
}
