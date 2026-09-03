import type {
  Assignment,
  CertHolding,
  DB,
  NameMapping,
  Person,
  PersonWorkScope,
  Rule,
  Snapshot,
  WarningScheme,
} from '../types'
import { calculateAll } from '../engine/calculate'
import { suggest } from '../engine/standardize'

const WARN: WarningScheme = {
  expiryEnabled: true,
  expiryNodes: [180, 90, 30, 7],
  reviewEnabled: true,
  reviewNodes: [90, 30, 7],
  transitionNodes: [30, 7],
}

const AS_OF = '2026-09-03'

export function buildSeed(): DB {
  const users = [
    { id: 'u_admin', name: '陈管理员', role: 'admin' as const, title: '系统管理员' },
    { id: 'u_hr', name: '李人资', role: 'hr' as const, title: '人力资源部' },
    { id: 'u_spec', name: '王专工', role: 'specialist' as const, title: '电气专业规则维护人' },
    { id: 'u_unit', name: '赵班长', role: 'unit' as const, orgScopeId: 'org_a', title: 'A发电公司基层管理员' },
    { id: 'u_rev', name: '钱安全', role: 'reviewer' as const, title: '整改复核人' },
  ]

  const orgs = [
    { id: 'org_root', parentId: null, code: 'GRP', type: 'group' as const, standardName: '能源控股集团', originalName: '能源控股集团', effectiveFrom: '2010-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a', parentId: 'org_root', code: 'A', type: 'company' as const, standardName: 'A发电公司', originalName: 'A发电公司', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_tech', parentId: 'org_a', code: 'A-TECH', type: 'department' as const, standardName: '生产技术部', originalName: '生产技术部', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_equip', parentId: 'org_a', code: 'A-EQ', type: 'department' as const, standardName: '设备管理部', originalName: '设备管理部', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_elec', parentId: 'org_a_equip', code: 'A-EQ-ELEC', type: 'team' as const, standardName: '电气检修班', originalName: '电气检修班', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_relay', parentId: 'org_a_equip', code: 'A-EQ-RELAY', type: 'team' as const, standardName: '继保班', originalName: '继保班', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_test', parentId: 'org_a_equip', code: 'A-EQ-TEST', type: 'team' as const, standardName: '电气试验班', originalName: '电气试验班', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_boiler', parentId: 'org_a', code: 'A-BLR', type: 'workshop' as const, standardName: '锅炉检修车间', originalName: '锅炉检修车间', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_a_safety', parentId: 'org_a', code: 'A-SAFE', type: 'department' as const, standardName: '安全监察部', originalName: '安全监察部', effectiveFrom: '2012-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_b', parentId: 'org_root', code: 'B', type: 'company' as const, standardName: 'B发电公司', originalName: 'B发电公司', effectiveFrom: '2014-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_b_prod', parentId: 'org_b', code: 'B-PROD', type: 'department' as const, standardName: '生产管理部', originalName: '生产管理部', effectiveFrom: '2014-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_b_equip', parentId: 'org_b', code: 'B-EQ', type: 'department' as const, standardName: '设备部', originalName: '设备部', effectiveFrom: '2014-01-01', effectiveTo: null, status: 'active' as const },
    { id: 'org_b_safety', parentId: 'org_b', code: 'B-SAFE', type: 'department' as const, standardName: '安全监察部', originalName: '安全监察部', effectiveFrom: '2014-01-01', effectiveTo: null, status: 'active' as const },
  ]

  const jobs = [
    { id: 'job_elec_repair', name: '电气检修技术员', major: '电气', category: '电气检修', sequence: '技术', isProduction: true, tags: ['电气'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_elec_ops', name: '电气运行技术员', major: '电气', category: '电气运行', sequence: '技术', isProduction: true, tags: ['电气'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_elec_test', name: '电气试验技术员', major: '电气', category: '电气试验', sequence: '技术', isProduction: true, tags: ['电气'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_relay', name: '继电保护技术员', major: '电气', category: '继电保护', sequence: '技术', isProduction: true, tags: ['电气'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_safety', name: '专职安全监督', major: '安全', category: '安全管理', sequence: '管理', isProduction: true, tags: ['安全'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_tech_sup', name: '技术监督专责', major: '技术监督', category: '技术监督', sequence: '管理', isProduction: true, tags: ['监督'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_finance', name: '财务主管', major: '财务', category: '财务管理', sequence: '管理', isProduction: false, tags: [], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_boiler', name: '锅炉检修工', major: '锅炉', category: '锅炉检修', sequence: '技能', isProduction: true, tags: ['锅炉'], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
    { id: 'job_intern', name: '技术员（见习）', major: '综合', category: '见习', sequence: '见习', isProduction: true, tags: [], status: 'active' as const, effectiveFrom: '2020-01-01', effectiveTo: null },
  ]

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

  const people: Person[] = [
    p('p_zw', 'A001', '张伟'),
    p('p_lq', 'A002', '李强'),
    p('p_wf', 'A003', '王芳'),
    p('p_ly', 'A004', '刘洋'),
    p('p_cj', 'A005', '陈静'),
    p('p_zl', 'A006', '赵磊'),
    p('p_sh', 'A007', '孙浩'),
    p('p_zm', 'A008', '周敏'),
    p('p_wd', 'A009', '吴迪'),
    p('p_zh', 'A010', '郑华'),
    p('p_fj', 'A011', '冯军'),
    p('p_zlin', 'A012', '朱琳'),
    p('p_hp', 'A013', '何平'),
    p('p_gm', 'A014', '高明'),
    p('p_lb', 'A015', '罗斌'),
    p('p_xt', 'A016', '许婷'),
    p('p_cy', 'A017', '曹宇'),
    p('p_dk', 'A018', '邓凯'),
    p('p_sj', 'B001', '沈杰'),
    p('p_hx', 'B002', '韩雪'),
    p('p_tw', 'B003', '唐伟'),
    p('p_pl', 'B004', '潘丽'),
    p('p_jb', 'B005', '蒋波'),
    p('p_mc', 'B006', '马超'),
    p('p_wx', 'A019', '魏雪'),
  ]

  const assignments: Assignment[] = [
    asg('asg_zw', 'p_zw', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2018-03-01'),
    asg('asg_lq', 'p_lq', 'org_a_elec', '电气检修班', '电修技术员', null, 'unmapped', '2019-06-01'),
    asg('asg_wf', 'p_wf', 'org_a_elec', '电气检修班', '电气运行技术员', 'job_elec_ops', 'mapped', '2020-02-01'),
    asg('asg_ly', 'p_ly', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2017-01-01'),
    asg('asg_cj', 'p_cj', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2016-05-01'),
    asg('asg_zl', 'p_zl', 'org_a_test', '电气试验班', '电气试验技术员', 'job_elec_test', 'mapped', '2021-04-01'),
    asg('asg_sh', 'p_sh', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2015-09-01'),
    asg('asg_zm', 'p_zm', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2014-01-01'),
    asg('asg_wd', 'p_wd', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2013-08-01'),
    asg('asg_zh', 'p_zh', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2022-01-01'),
    asg('asg_fj1', 'p_fj', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2018-01-01'),
    asg('asg_fj2', 'p_fj', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2020-01-01', null, 'concurrent'),
    asg('asg_zlin', 'p_zlin', 'org_a_safety', '安全监察部', '专职安全监督', 'job_safety', 'mapped', '2019-03-01'),
    asg('asg_hp', 'p_hp', 'org_a_safety', '安全监察部', '专职安全监督', 'job_safety', 'mapped', '2021-07-01'),
    asg('asg_gm', 'p_gm', 'org_a_boiler', '锅炉检修车间', '财务主管', 'job_finance', 'mapped', '2023-01-01', null, 'primary', '组织「锅炉检修车间」与岗位「财务主管」组合看起来异常，但不能确定错误，标记为疑似异常待核查。'),
    asg('asg_lb_old', 'p_lb', 'org_a_boiler', '锅炉检修车间', '锅炉检修工', 'job_boiler', 'mapped', '2015-01-01', '2026-07-31'),
    asg('asg_lb_new', 'p_lb', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2026-08-01'),
    asg('asg_xt', 'p_xt', 'org_a_test', '电气试验班', '电气试验技术员', 'job_elec_test', 'mapped', '2019-11-01'),
    asg('asg_cy', 'p_cy', 'org_a_relay', '继保班', '继电保护技术员', 'job_relay', 'mapped', '2018-06-01'),
    asg('asg_dk', 'p_dk', 'org_a_elec', '电气检修班', '电气检修技术员', 'job_elec_repair', 'mapped', '2020-09-01'),
    asg('asg_sj', 'p_sj', 'org_b_safety', '安全监察部', '专职安全监督', 'job_safety', 'mapped', '2018-01-01'),
    asg('asg_hx', 'p_hx', 'org_b_safety', '安全监察部', '专职安全监督', 'job_safety', 'mapped', '2022-04-01'),
    asg('asg_tw', 'p_tw', 'org_b_equip', '设备部', '电气检修技术员', 'job_elec_repair', 'mapped', '2017-05-01'),
    asg('asg_pl', 'p_pl', 'org_b_prod', '生产管理部', '技术员（学习岗）', null, 'unmapped', '2025-07-01'),
    asg('asg_jb', 'p_jb', 'org_b', '生技部', '电气运行技术员', 'job_elec_ops', 'mapped', '2021-02-01'),
    asg('asg_mc', 'p_mc', 'org_b_equip', '设备部', '电气检修技术员', 'job_elec_repair', 'mapped', '2016-01-01'),
    asg('asg_wx', 'p_wx', 'org_a_safety', '安全监察部', '专职安全监督', 'job_safety', 'mapped', '2020-01-01'),
  ]

  const personWorkScopes: PersonWorkScope[] = [
    ws('ws1', 'p_zw', 'ws_hv', true),
    ws('ws2', 'p_wf', 'ws_hv', true),
    ws('ws3', 'p_ly', 'ws_hv', true),
    ws('ws4', 'p_cj', 'ws_hv', true),
    ws('ws5', 'p_zl', 'ws_test', true),
    ws('ws6', 'p_sh', 'ws_hv', true),
    ws('ws7', 'p_zm', 'ws_hv', true),
    ws('ws8', 'p_wd', 'ws_hv', true),
    // 郑华：电气检修但作业范围缺失 → 无法判定
    ws('ws9', 'p_fj', 'ws_hv', true),
    ws('ws10', 'p_fj', 'ws_crane_c', true),
    ws('ws11', 'p_zlin', 'ws_safety', true),
    ws('ws12', 'p_hp', 'ws_safety', true),
    ws('ws13', 'p_lb', 'ws_hv', true, '2026-08-01'),
    ws('ws14', 'p_xt', 'ws_test', true),
    ws('ws15', 'p_cy', 'ws_relay', true),
    ws('ws16', 'p_dk', 'ws_lv', true),
    ws('ws17', 'p_sj', 'ws_safety', true),
    ws('ws18', 'p_hx', 'ws_safety', true),
    ws('ws19', 'p_tw', 'ws_hv', true),
    ws('ws20', 'p_mc', 'ws_hv', true),
    ws('ws21', 'p_wx', 'ws_safety', true),
    ws('ws22', 'p_jb', 'ws_hv', true),
  ]

  const holdings: CertHolding[] = [
    hold('h_zw', 'p_zw', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2018-001', '2018-06-01', '2028-06-01', '2027-06-01'),
    hold('h_zw2', 'p_zw', 'cert_eng_m', '中级工程师职称', 'mapped', 'ENG-M-2019', '2019-09-01', null, null, false),
    // 李强 无证且岗位未标准化
    // 王芳 应持未持
    hold('h_ly', 'p_ly', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2017-004', '2017-03-01', '2027-03-02', '2026-12-01'), // ~180d
    hold('h_cj', 'p_cj', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2016-005', '2016-08-01', '2026-12-02', '2026-10-01'), // ~90d
    hold('h_zl', 'p_zl', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2021-006', '2021-05-01', '2026-10-03', '2026-09-20'), // ~30d
    hold('h_sh', 'p_sh', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2015-007', '2015-10-01', '2026-09-10', '2026-09-08'), // ~7d
    hold('h_zm', 'p_zm', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2014-008', '2014-02-01', '2026-08-01', '2026-07-01'), // expired
    hold('h_wd', 'p_wd', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2013-009', '2013-09-01', '2027-09-01', '2026-07-01'), // review overdue
    hold('h_fj1', 'p_fj', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2018-011', '2018-04-01', '2028-04-01', '2027-04-01'),
    hold('h_fj2', 'p_fj', 'cert_crane_c', '起重指挥证', 'mapped', 'CR-2020-011', '2020-02-01', '2028-02-01', '2027-02-01'),
    hold('h_zlin', 'p_zlin', null, '注安师', 'unmapped', 'CSE-UNK-012', '2019-05-01', '2028-05-01', '2027-05-01'),
    // 何平 无 CSE
    hold('h_lb_old', 'p_lb', 'cert_eng_m', '中级工程师职称', 'mapped', 'ENG-M-2018', '2018-01-01', null, null, false),
    // 罗斌 新上岗无高压证，过渡期
    hold('h_xt', 'p_xt', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2019-016', '2019-12-01', '2028-12-01', '2027-12-01'),
    hold('h_dk', 'p_dk', 'cert_lv', '低压电工作业证', 'mapped', 'LV-2020-018', '2020-10-01', '2028-10-01', '2027-10-01'),
    hold('h_sj', 'p_sj', 'cert_cse', '注册安全工程师证', 'mapped', 'CSE-2018-B1', '2018-06-01', '2028-06-01', '2027-06-01'),
    hold('h_sj2', 'p_sj', 'cert_cse_h', '注册安全工程师证（高级）', 'mapped', 'CSE-H-2024-B1', '2024-03-01', '2029-03-01', '2028-03-01'),
    hold('h_hx', 'p_hx', 'cert_cse', '注册安全工程师证', 'mapped', 'CSE-2022-B2', '2022-08-01', '2027-08-01', '2026-12-01'),
    hold('h_tw', 'p_tw', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2017-B3', '2017-06-01', '2028-06-01', '2027-06-01'),
    hold('h_mc', 'p_mc', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2016-B6', '2016-03-01', '2028-03-01', '2027-03-01'),
    hold('h_wx', 'p_wx', 'cert_cse', '注册安全工程师证', 'mapped', 'CSE-2020-A19', '2020-04-01', '2028-04-01', '2027-04-01'),
    hold('h_jb', 'p_jb', 'cert_hv', '高压电工作业证', 'mapped', 'HV-2021-B5', '2021-04-01', '2028-04-01', '2027-04-01'),
  ]

  const mappings: NameMapping[] = [
    pendingMap('map_job_dx', 'job', '电修技术员', 'org_a'),
    pendingMap('map_cert_za', 'certificate', '注安师', null),
    pendingMap('map_org_sjb', 'org', '生技部', 'org_b'),
    pendingMap('map_job_xx', 'job', '技术员（学习岗）', 'org_b'),
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
          { field: 'job_category', operator: 'IN', value: ['电气检修', '电气运行'] },
          { field: 'work_scope', operator: 'CONTAINS', value: '高压电气作业' },
        ],
      },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_hv' }] },
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      reviewedBy: 'u_hr',
      reviewedAt: '2024-12-20T00:00:00.000Z',
      notes: '现行版本：覆盖电气检修与电气运行。已发布规则不可直接覆盖修改。',
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
      condition: { logic: 'AND', conditions: [{ field: 'standard_job_id', operator: 'IN', value: ['job_safety'] }] },
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
      notes: '群体比例达标不等于每一名未持证人员都合规。',
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
          { field: 'job_category', operator: 'IN', value: ['电气检修', '电气运行'] },
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
      condition: { logic: 'AND', conditions: [{ field: 'standard_job_id', operator: 'IN', value: ['job_safety'] }] },
      requirement: { logic: 'AND', items: [{ certificateId: 'cert_cse', minGradeOrder: 2 }] },
      stages: [{ until: '2026-12-31', target: 1, label: '2026年底 =100%' }],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      createdBy: 'u_spec',
      notes: '与现行 R-CSE 阶段目标冲突，发布前应被阻止。',
    },
  ]

  const snapshots: Snapshot[] = [
    snap('2026-04-01', 25, 18, 12, 0.667, 0.61, 0.72, 9, 6, 8),
    snap('2026-05-01', 25, 19, 13, 0.684, 0.64, 0.76, 8, 7, 7),
    snap('2026-06-01', 25, 19, 14, 0.737, 0.67, 0.76, 8, 8, 7),
    snap('2026-07-01', 25, 20, 14, 0.7, 0.68, 0.8, 9, 8, 6),
    snap('2026-08-01', 25, 20, 15, 0.75, 0.7, 0.8, 8, 9, 6),
  ]

  const db: DB = {
    version: 1,
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
    mappings: mappings.map((m) =>
      m.status === 'pending' ? { ...m, candidates: suggest(m.kind, m.originalName, { ...({ orgs, jobs, certificates, mappings } as unknown as DB), orgs, jobs, certificates, mappings: [] }, m.scopeOrgId) } : m,
    ),
    rules,
    issues: [],
    remediations: [],
    batches: [
      {
        id: 'bat_seed',
        at: '2026-09-01T01:00:00.000Z',
        by: '陈管理员',
        filename: '初始化台账.xlsx',
        total: 25,
        accepted: 25,
        standardized: 21,
        pending: 4,
        rejected: 0,
        errors: [],
        notes: '演示种子数据。导入成功 ≠ 标准化完成 ≠ 可参与正式统计。',
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
        target: '初始化台账.xlsx',
        detail: '种子数据装载',
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

  const wf = db.issues.find((i) => i.title.includes('应持未持') && i.title.includes('王芳'))
  if (wf) {
    wf.status = 'open'
    wf.dueDate = '2026-09-20'
  }
  const expired = db.issues.find((i) => i.title.includes('证书过期') && i.title.includes('周敏'))
  if (expired) {
    expired.status = 'remediating'
    expired.assigneeId = 'u_unit'
    db.remediations.push({
      id: 'rem1',
      issueId: expired.id,
      at: '2026-09-02T03:00:00.000Z',
      by: '赵班长',
      action: '开始整改',
      comment: '已通知本人办理换证，预约下周考试。',
    })
  }
  const review = db.issues.find((i) => i.title.includes('复审逾期') && i.title.includes('吴迪'))
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

function p(id: string, employeeNo: string, name: string): Person {
  return { id, employeeNo, name, idMasked: '**************', status: 'active', source: 'seed' }
}

function asg(
  id: string,
  personId: string,
  orgId: string,
  originalOrgName: string,
  originalJobName: string,
  standardJobId: string | null,
  jobStdStatus: Assignment['jobStdStatus'],
  startDate: string,
  endDate: string | null = null,
  kind: Assignment['kind'] = 'primary',
  suspectedAnomaly?: string,
): Assignment {
  return {
    id,
    personId,
    orgId,
    originalOrgName,
    originalJobName,
    standardJobId,
    jobStdStatus,
    kind,
    startDate,
    endDate,
    source: 'seed',
    suspectedAnomaly,
  }
}

function ws(id: string, personId: string, tagId: string, confirmed: boolean, startDate = '2020-01-01'): PersonWorkScope {
  return {
    id,
    personId,
    tagId,
    source: confirmed ? 'seed-confirmed' : 'seed',
    confirmed,
    confirmedBy: confirmed ? '赵班长' : undefined,
    confirmedAt: confirmed ? '2026-01-15T00:00:00.000Z' : undefined,
    startDate,
    endDate: null,
  }
}

function hold(
  id: string,
  personId: string,
  standardCertId: string | null,
  originalName: string,
  certStdStatus: CertHolding['certStdStatus'],
  certNo: string,
  obtainedAt: string,
  validTo: string | null,
  reviewDate: string | null,
  hasExpiry = true,
): CertHolding {
  return {
    id,
    personId,
    standardCertId,
    originalName,
    certStdStatus,
    certNo,
    issuer: '省级应急管理部门',
    obtainedAt,
    validFrom: obtainedAt,
    validTo: hasExpiry ? validTo : null,
    reviewDate,
    registerStatus: '有效',
    source: 'seed',
  }
}

function pendingMap(id: string, kind: NameMapping['kind'], originalName: string, scopeOrgId: string | null): NameMapping {
  return {
    id,
    kind,
    originalName,
    standardId: null,
    standardName: null,
    scopeKind: scopeOrgId ? 'local' : 'global',
    scopeOrgId,
    source: 'manual',
    status: 'pending',
    usageCount: kind === 'job' && originalName === '电修技术员' ? 37 : kind === 'certificate' ? 82 : 14,
    candidates: [],
    history: [{ at: '2026-09-01T01:00:00.000Z', by: 'system', action: 'create_pending' }],
  }
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
