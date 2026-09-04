export interface PositionRow {
  c: string
  d: string
  t: string
  j: string
}

export interface JobClass {
  category: string
  major: string
  sequence: string
  isProduction: boolean
}

export function classifyPosition(p: PositionRow): JobClass {
  const blob = `${p.d}${p.t}${p.j}`
  if (/财务|会计|出纳|核算|资金|成本|概预算/.test(blob) && !/安全/.test(p.j)) {
    return { category: '财务管理', major: '财务', sequence: '管理', isProduction: false }
  }
  if (/安培|安全专工|专职安全|安全监察/.test(p.j) || (/安全员/.test(p.j) && /办公室|管理|质检部/.test(p.d + p.t))) {
    return { category: '安全管理', major: '安全', sequence: '管理', isProduction: true }
  }
  if (/电气操作|电运|电气专工|值班电工|操作电工|电工班|运行电工/.test(blob)) {
    return {
      category: /检修/.test(blob) ? '电气检修' : '电气运行',
      major: '电气',
      sequence: '技术',
      isProduction: true,
    }
  }
  if (/集控/.test(blob)) {
    return { category: '集控运行', major: '运行', sequence: '运行', isProduction: true }
  }
  if (/热控/.test(p.d)) return { category: '热控检修', major: '热控', sequence: '技术', isProduction: true }
  if (/锅炉/.test(p.d)) return { category: '锅炉检修', major: '锅炉', sequence: '技能', isProduction: true }
  if (/汽机/.test(p.d)) return { category: '汽机检修', major: '汽机', sequence: '技能', isProduction: true }
  if (/化学|化水|化验|化运/.test(p.d + p.j)) return { category: '化学', major: '化学', sequence: '技术', isProduction: true }
  if (/燃料|煤炭|煤管|煤质/.test(p.d)) return { category: '燃料', major: '燃料', sequence: '技能', isProduction: true }
  if (/灰水|除灰|供水/.test(p.d)) return { category: '灰水运行', major: '运行', sequence: '运行', isProduction: true }
  if (/见习|学习岗/.test(p.j)) {
    const major = /集控|运行/.test(p.d) ? '运行' : /热控/.test(p.d) ? '热控' : /锅炉/.test(p.d) ? '锅炉' : '综合'
    return { category: '见习', major, sequence: '见习', isProduction: true }
  }
  return { category: '其他', major: '综合', sequence: '综合', isProduction: true }
}

export function isHvCategory(c: string): boolean {
  return c === '电气运行' || c === '电气检修' || c === '集控运行'
}

export function shouldLeaveUnmapped(job: string): boolean {
  const j = job.trim()
  if (!j || j === 'nan' || j === 'NaN') return true
  if (/学习岗/.test(j)) return true
  return false
}
