import type { CertCategory, StandardCert, WarningScheme } from '../types'

type PolicyCert = Omit<StandardCert, 'warning' | 'status'> & {
  warningMode?: 'expiry' | 'review' | 'none'
}

const NATIONAL = '《关于进一步加强员工持证上岗管理的指导意见》附件1、附件2（国家管控类）'
const GROUP = '《关于进一步加强员工持证上岗管理的指导意见》附件1、附件2（集团管控类）'
const INCENTIVE = '《关于进一步加强员工持证上岗管理的指导意见》附件1、附件2（激励提升类）'

const cert = (
  id: string,
  name: string,
  category: CertCategory,
  subCategory: string,
  series: string,
  applicableScope: string,
  ratioRequirement: string,
  policyBasis: string,
  options: Partial<Pick<PolicyCert, 'grade' | 'gradeOrder' | 'hasExpiry' | 'needsReview' | 'warningMode'>> = {},
): PolicyCert => ({
  id,
  name,
  category,
  subCategory,
  series,
  grade: options.grade ?? null,
  gradeOrder: options.gradeOrder ?? null,
  hasExpiry: options.hasExpiry ?? category !== 'incentive',
  needsReview: options.needsReview ?? category === 'national',
  warningMode: options.warningMode,
  policyBasis,
  applicableScope,
  ratioRequirement,
})

const POLICY_CERTS: PolicyCert[] = [
  cert('cert_hv', '电工作业证（高压电工作业）', 'national', '特种作业', 'electrical_hv', '电气检修、运行岗位中从事规定电压等级以上高压电气作业的人员', '100%', NATIONAL),
  cert('cert_lv', '电工作业证（低压电工作业）', 'national', '特种作业', 'electrical_lv', '电气检修、运行岗位中从事规定电压等级以下低压电气作业的人员', '100%', NATIONAL),
  cert('cert_cable', '电工作业证（电力电缆作业）', 'national', '特种作业', 'electrical_cable', '从事电力电缆运行、维护、安装、检修、试验的人员', '100%', NATIONAL),
  cert('cert_relay', '电工作业证（继电保护作业）', 'national', '特种作业', 'electrical_relay', '从事继电保护及自动装置运行、维护、调试、检验的人员', '100%', NATIONAL),
  cert('cert_electrical_test', '电工作业证（电气试验作业）', 'national', '特种作业', 'electrical_test', '从事电气设备交接试验及预防性试验的人员', '100%', NATIONAL),
  cert('cert_welding', '焊接与热切割作业证（熔化焊接与热切割作业）', 'national', '特种作业', 'welding', '检修岗位从事气焊、气割、电弧焊等焊接与热切割作业的人员', '100%', NATIONAL),
  cert('cert_height_scaffold', '高处作业证（登高架设作业）', 'national', '特种作业', 'height_scaffold', '检修岗位高处从事脚手架、跨越架架设或拆除的人员', '100%', NATIONAL),
  cert('cert_height', '高处作业证（高处安装、维护、拆除作业）', 'national', '特种作业', 'height_install', '检修岗位在悬空或攀登条件下从事安装、维护、拆除的人员', '100%', NATIONAL),
  cert('cert_hydrogen', '危险化学品安全作业证（加氢工艺作业）', 'national', '特种作业', 'hydrogen', '运行岗位涉及氢气系统操作的人员', '100%', NATIONAL),
  cert('cert_confined', '有限空间安全作业证', 'national', '特种作业', 'confined_space', '进入受限、通风不良等有限空间进行作业的人员', '100%', NATIONAL),
  cert('cert_se', '特种设备安全管理证', 'national', '特种设备作业', 'se_mgmt', '生产技术部、安全环保部、车间、班组的特种设备安全管理人员', '100%', NATIONAL),
  cert('cert_crane_d', '起重机作业证（司机）', 'national', '特种设备作业', 'crane_driver', '检修岗位从事起重机操作的人员', '100%', NATIONAL),
  cert('cert_crane_c', '起重机作业证（指挥）', 'national', '特种设备作业', 'crane_command', '检修岗位从事起重机指挥的人员', '100%', NATIONAL),
  cert('cert_elevator', '电梯作业证（电梯修理）', 'national', '特种设备作业', 'elevator', '检修岗位从事电梯维修的人员', '100%', NATIONAL),
  cert('cert_fork', '场（厂）内专用机动车辆作业证（叉车司机）', 'national', '特种设备作业', 'forklift', '厂内从事生产、检修工作并操作叉车的人员', '100%', NATIONAL),
  cert('cert_pressure_door', '压力容器作业证（快开门式压力容器操作）', 'national', '特种设备作业', 'pressure_vessel', '运行、检修岗位从事快开门式压力容器操作的人员', '100%', NATIONAL),
  cert('cert_pressure_fill', '压力容器作业证（移动式压力容器充装）', 'national', '特种设备作业', 'pressure_vessel_fill', '从事移动式压力容器充装的人员', '100%', NATIONAL),
  cert('cert_safety_valve', '安全附件维修作业证（安全阀校验）', 'national', '特种设备作业', 'safety_valve', '负责安全阀定期校验、调试和维修的作业人员', '100%', NATIONAL),
  cert('cert_se_welding', '特种设备焊接作业证', 'national', '特种设备作业', 'se_welding', '从事特种设备金属或非金属焊接的人员', '100%', NATIONAL),
  cert('cert_fire', '消防设施操作员证', 'national', '消防', 'fire_facility', '自动消防系统操作岗位人员', '100%', NATIONAL),
  cert('cert_cse', '注册安全工程师证', 'national', '执业资格', 'cse', '安全生产管理部门、厂级和车间级专职安全监督人员', '2026年底≥50%，2028年底≥75%，2029年底100%', NATIONAL),
  cert('cert_legal', '法律职业资格证', 'national', '执业资格', 'legal', '专职法务人员', '正文与附件时间口径不一致，待企业确认', NATIONAL, { hasExpiry: false, needsReview: false, warningMode: 'none' }),

  cert('cert_prod_ability', '集团公司生产岗位能力认证证书', 'group', '岗位能力认证', 'prod_ability', '火电集控运行、燃机检修运行、新能源运维等生产人员', '100%', GROUP),
  cert('cert_power_safety', '集团公司电力安全技能认证证书', 'group', '安全技能认证', 'power_safety', '安全管理、生产管理、基建管理、检修维护、运行操作、施工作业等人员', '100%', GROUP),
  cert('cert_tech_supervision', '集团公司技术监督证', 'group', '技术监督', 'tech_supervision', '煤电、燃机、新能源生产技术部门的专业技术监督专责人员', '100%', GROUP),
  cert('cert_fuel_lab', '集团公司燃料采制化及化验证', 'group', '专业岗位证书', 'fuel_lab', '燃料采制化及燃料业务监督人员', '100%', GROUP),
  cert('cert_water_treatment', '集团公司水处理证', 'group', '专业岗位证书', 'water_treatment', '煤电、燃机等电厂水处理值班人员', '100%', GROUP),
  cert('cert_water_coal_oil_lab', '集团公司水煤油化验证', 'group', '专业岗位证书', 'water_coal_oil_lab', '煤电、燃机等电厂水、煤、油化验人员', '100%', GROUP),
  cert('cert_dispatch', '国家电网调度证', 'group', '调度资格', 'dispatch', '煤电、燃机运行值长及新能源场站运维人员', '100%', GROUP),
  cert('cert_accounting_junior', '初级会计师证', 'group', '会计职称', 'accounting', '财务部门一般管理岗位人员', '正文与附件口径需确认', GROUP, { grade: '初级', gradeOrder: 1, hasExpiry: false, needsReview: false, warningMode: 'none' }),
  cert('cert_accounting_middle', '中级会计师证', 'group', '会计职称', 'accounting', '财务部门负责人、主管', '正文与附件口径需确认', GROUP, { grade: '中级', gradeOrder: 2, hasExpiry: false, needsReview: false, warningMode: 'none' }),

  cert('cert_skill_junior', '职业技能等级证书（初级工）', 'incentive', '职业技能等级', 'vocational_skill', '生产一线技能岗位、碳排放管理员、电力交易员', '激励提升，不记无证上岗违规', INCENTIVE, { grade: '初级工', gradeOrder: 1 }),
  cert('cert_skill_middle', '职业技能等级证书（中级工）', 'incentive', '职业技能等级', 'vocational_skill', '生产一线技能岗位、碳排放管理员、电力交易员', '激励提升，不记无证上岗违规', INCENTIVE, { grade: '中级工', gradeOrder: 2 }),
  cert('cert_skill_senior', '职业技能等级证书（高级工）', 'incentive', '职业技能等级', 'vocational_skill', '生产一线技能岗位、碳排放管理员、电力交易员', '激励提升，不记无证上岗违规', INCENTIVE, { grade: '高级工', gradeOrder: 3 }),
  cert('cert_skill_technician', '职业技能等级证书（技师）', 'incentive', '职业技能等级', 'vocational_skill', '生产一线技能岗位、碳排放管理员、电力交易员', '激励提升，不记无证上岗违规', INCENTIVE, { grade: '技师', gradeOrder: 4 }),
  cert('cert_skill_senior_technician', '职业技能等级证书（高级技师）', 'incentive', '职业技能等级', 'vocational_skill', '生产一线技能岗位、碳排放管理员、电力交易员', '激励提升，不记无证上岗违规', INCENTIVE, { grade: '高级技师', gradeOrder: 5 }),
  cert('cert_registered_supervision', '注册监理工程师证', 'incentive', '工程类执业资格', 'engineering_practice', '从事监理管理相关工作的人员', '激励提升', INCENTIVE),
  cert('cert_registered_cost', '注册造价工程师证', 'incentive', '工程类执业资格', 'engineering_practice', '从事造价管理相关工作的人员', '激励提升', INCENTIVE),
  cert('cert_registered_builder', '注册建造师证', 'incentive', '工程类执业资格', 'engineering_practice', '从事建造管理相关工作的人员', '激励提升', INCENTIVE),
  cert('cert_audit', '审计相关资格证书', 'incentive', '专业能力', 'audit', '审计相关岗位人员', '激励提升', INCENTIVE),
  cert('cert_economics', '经济专业能力证书', 'incentive', '专业能力', 'economics', '从事经济相关工作的人员', '激励提升', INCENTIVE),
  cert('cert_statistics', '统计专业能力证书', 'incentive', '专业能力', 'statistics', '从事统计相关工作的人员', '激励提升', INCENTIVE),
  cert('cert_eng_m', '中级工程师职称', 'incentive', '职称', 'engineer', '与岗位高度相关的工程技术人员', '激励提升', INCENTIVE, { grade: '中级', gradeOrder: 2 }),
  cert('cert_eng_h', '高级工程师职称', 'incentive', '职称', 'engineer', '与岗位高度相关的工程技术人员', '激励提升', INCENTIVE, { grade: '高级', gradeOrder: 3 }),
]

export interface PolicyConflict {
  id: string
  topic: string
  bodyText: string
  attachmentText: string
  handling: string
}

export const POLICY_CONFLICTS: PolicyConflict[] = [
  {
    id: 'legal-ratio-date',
    topic: '法律职业资格证阶段节点',
    bodyText: '正文：2027年底持证率不低于80%，2028年底达到100%。',
    attachmentText: '附件2：2026年底不低于80%，2028年底达到100%。',
    handling: '未获得企业正式确认前不发布为生效规则，由规则中心保留冲突草稿并阻止自动裁决。',
  },
  {
    id: 'accounting-scope-date',
    topic: '会计证书适用范围与时间节点',
    bodyText: '正文：一般管理岗位初级会计师2029年底100%；负责人及主管中级会计师2028年底100%。',
    attachmentText: '附件1/2概括为“初级会计师及以上证书”，附件2对负责人、主管和一般管理人员统一列示100%。',
    handling: '按人员层级拆分候选规则，待企业确认后分别发布；当前不据此生成正式个人结论。',
  },
]

export function buildPolicyCertificates(warning: WarningScheme): StandardCert[] {
  return POLICY_CERTS.map(({ warningMode, ...item }) => {
    const none = { ...warning, expiryEnabled: false, reviewEnabled: false }
    const configured = warningMode === 'none'
      ? none
      : warningMode === 'review'
        ? { ...warning, expiryEnabled: false }
        : { ...warning }
    return { ...item, warning: configured, status: 'active' }
  })
}
