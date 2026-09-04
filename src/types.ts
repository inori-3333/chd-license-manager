export type Role = 'admin' | 'hr' | 'specialist' | 'unit' | 'reviewer'
export type Tri = 'true' | 'false' | 'unknown'
export type OrgType = 'group' | 'company' | 'department' | 'workshop' | 'team'
export type CertCategory = 'national' | 'group' | 'incentive'
export type PersonStatus = 'active' | 'inactive'
export type AssignmentKind = 'primary' | 'concurrent'
export type RuleType =
  | 'personal_mandatory'
  | 'group_ratio'
  | 'transition'
  | 'new_post'
  | 'incentive'
export type RuleStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_effective'
  | 'active'
  | 'expired'
  | 'rejected'
export type IssueClass = 'data_quality' | 'risk' | 'compliance'
export type IssueStatus =
  | 'open'
  | 'remediating'
  | 'pending_review'
  | 'closed'
  | 'resolved_pending_close'
export type MappingKind = 'org' | 'job' | 'certificate'
export type MappingStatus = 'pending' | 'confirmed' | 'disabled'
export type MappingScopeKind = 'global' | 'local'
export type ConditionField =
  | 'org_id'
  | 'org_type'
  | 'major'
  | 'standard_job_id'
  | 'job_category'
  | 'job_tag'
  | 'work_scope'
  | 'duty_tag'
  | 'assignment_start'
  | 'work_scope_start'
  | 'person_status'
  | 'is_production'
export type Operator = 'EQ' | 'NE' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'BEFORE' | 'AFTER'
export type ImportRowKind = 'person' | 'certificate' | 'work_scope'
export type ImportRowStatus = 'rejected' | 'pending_std' | 'standardized'
export type PersonJudgement = 'compliant' | 'noncompliant' | 'at_risk' | 'undecidable' | 'out_of_scope'
export type RequiredItemStatus =
  | 'satisfied'
  | 'missing'
  | 'not_yet_valid'
  | 'registration_invalid'
  | 'expired'
  | 'review_overdue'
  | 'grade_insufficient'
  | 'in_transition'
  | 'unknown'
export type WarningLevel = 'hint_180' | 'warn_90' | 'warn_30' | 'urgent_7' | 'expired'
export type GroupGoalStatus = 'met' | 'not_met' | 'insufficient_data' | 'partial_met'

export interface User {
  id: string
  name: string
  role: Role
  orgScopeId?: string
  title: string
}

export interface Org {
  id: string
  parentId: string | null
  code: string
  type: OrgType
  standardName: string
  originalName: string
  effectiveFrom: string
  effectiveTo: string | null
  status: 'active' | 'inactive'
}

export interface Person {
  id: string
  employeeNo: string
  name: string
  idMasked: string
  status: PersonStatus
  source: string
  importBatchId?: string
}

export interface StandardJob {
  id: string
  name: string
  major: string
  category: string
  sequence: string
  isProduction: boolean
  tags: string[]
  status: 'active' | 'inactive'
  effectiveFrom: string
  effectiveTo: string | null
}

export interface Assignment {
  id: string
  personId: string
  orgId: string
  originalOrgName: string
  originalJobName: string
  standardJobId: string | null
  jobStdStatus: 'unmapped' | 'mapped'
  kind: AssignmentKind
  startDate: string
  endDate: string | null
  source: string
  suspectedAnomaly?: string
}

export interface WorkScopeTag {
  id: string
  name: string
  group: string
}

export interface PersonWorkScope {
  id: string
  personId: string
  tagId: string
  source: string
  confirmed: boolean
  confirmedBy?: string
  confirmedAt?: string
  startDate: string
  endDate: string | null
}

export interface WarningScheme {
  expiryEnabled: boolean
  expiryNodes: number[]
  reviewEnabled: boolean
  reviewNodes: number[]
  transitionNodes: number[]
}

export interface StandardCert {
  id: string
  name: string
  category: CertCategory
  subCategory: string
  series: string
  grade: string | null
  gradeOrder: number | null
  hasExpiry: boolean
  needsReview: boolean
  warning: WarningScheme
  status: 'active' | 'inactive'
  policyBasis?: string
  applicableScope?: string
  ratioRequirement?: string
}

export interface CertHolding {
  id: string
  personId: string
  standardCertId: string | null
  originalName: string
  certStdStatus: 'unmapped' | 'mapped'
  certNo: string
  issuer: string
  obtainedAt: string
  validFrom: string
  validTo: string | null
  reviewDate: string | null
  registerStatus: string
  source: string
  importBatchId?: string
}

export interface NameMapping {
  id: string
  kind: MappingKind
  originalName: string
  standardId: string | null
  standardName: string | null
  scopeKind: MappingScopeKind
  scopeOrgId: string | null
  source: 'manual' | 'history' | 'exact' | 'code'
  confirmedBy?: string
  confirmedAt?: string
  status: MappingStatus
  usageCount: number
  candidates: MappingCandidate[]
  history: Array<{ at: string; by: string; action: string; note?: string }>
}

export interface MappingCandidate {
  standardId: string
  standardName: string
  score: number
  reason: string
}

export interface Condition {
  field: ConditionField
  operator: Operator
  value: string | string[]
}

export interface ConditionGroup {
  logic: 'AND' | 'OR'
  conditions: Array<Condition | ConditionGroup>
}

export interface CertReqItem {
  certificateId: string
  minGradeOrder?: number
}

export interface CertRequirement {
  logic: 'AND' | 'OR'
  items: CertReqItem[]
}

export interface RatioStage {
  until: string
  target: number
  label: string
}

export interface Rule {
  id: string
  code: string
  name: string
  type: RuleType
  certCategory: CertCategory
  version: number
  familyId: string
  status: RuleStatus
  condition: ConditionGroup
  requirement: CertRequirement
  stages?: RatioStage[]
  transitionDays?: number
  effectiveFrom: string
  effectiveTo: string | null
  createdBy: string
  submittedBy?: string
  submittedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewComment?: string
  conflictAck?: boolean
  notes: string
  supersedesId?: string
}

export interface RequiredItem {
  certificateId: string
  certificateName: string
  minGradeOrder?: number
  ruleId: string
  ruleName: string
  ruleVersion: number
  incentive: boolean
  status: RequiredItemStatus
  actualHoldingIds: string[]
  explanation: string
  daysLeft?: number
  warningLevel?: WarningLevel
  sources?: Array<{ ruleId: string; ruleName: string; ruleVersion: number }>
}

export interface PersonResult {
  personId: string
  asOf: string
  judgement: PersonJudgement
  requiredItems: RequiredItem[]
  qualityReasons: string[]
  explanation: string[]
}

export interface GroupResult {
  ruleId: string
  ruleName: string
  ruleVersion: number
  asOf: string
  orgId: string | null
  orgName: string
  population: number
  decidable: number
  certified: number
  rate: number | null
  coverage: number
  stageLabel: string
  stageTarget: number
  nextStageLabel?: string
  nextStageTarget?: number
  daysToDeadline?: number
  status: GroupGoalStatus
  message: string
}

export interface Issue {
  id: string
  code: string
  class: IssueClass
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: IssueStatus
  title: string
  personId?: string
  orgId?: string
  certificateId?: string
  ruleId?: string
  ruleVersion?: number
  assignmentId?: string
  holdingId?: string
  field?: string
  originalValue?: string
  rationale: string
  foundAt: string
  dueDate?: string
  ownerOrgId?: string
  assigneeId?: string
  reviewerId?: string
  closedAt?: string
  fingerprint: string
}

export interface RemediationRecord {
  id: string
  issueId: string
  at: string
  by: string
  action: string
  comment: string
}

export interface ImportError {
  row: number
  sheet: string
  field: string
  message: string
  raw: Record<string, string>
}

export interface ImportBatch {
  id: string
  at: string
  by: string
  filename: string
  total: number
  accepted: number
  standardized: number
  pending: number
  rejected: number
  errors: ImportError[]
  notes: string
}

export interface Snapshot {
  id: string
  asOf: string
  capturedAt: string
  source: 'seed' | 'recalc' | 'scheduled'
  managed: number
  decidable: number
  compliant: number
  personRate: number | null
  itemRate: number | null
  coverage: number
  complianceIssues: number
  riskIssues: number
  qualityIssues: number
}

export interface AuditLog {
  id: string
  at: string
  actorId: string
  actorName: string
  action: string
  target: string
  detail: string
}

export interface CalcOutput {
  asOf: string
  personResults: PersonResult[]
  groupResults: GroupResult[]
  issues: Issue[]
  stats: CompanyStats
  unitStats: UnitStats[]
}

export interface CompanyStats {
  managed: number
  decidable: number
  compliant: number
  personRate: number | null
  requiredItems: number
  satisfiedItems: number
  itemRate: number | null
  coverage: number
  complianceIssues: number
  riskIssues: number
  qualityIssues: number
  national: CategorySlice
  group: CategorySlice
  incentive: IncentiveSlice
}

export interface CategorySlice {
  requiredPeople: number
  compliantPeople: number
  missing: number
  expired: number
  reviewOverdue: number
  expiring: number
}

export interface IncentiveSlice {
  coveragePeople: number
  highGrade: number
  obtainedThisYear: number
}

export interface UnitStats {
  orgId: string
  orgName: string
  managed: number
  decidable: number
  compliant: number
  personRate: number | null
  requiredItems: number
  satisfiedItems: number
  itemRate: number | null
  coverage: number
  complianceIssues: number
  riskIssues: number
}

export interface SimulationReport {
  affectedPeople: number
  affectedOrgs: number
  newRequiredPeople: number
  newIssues: number
  groupStatusChanges: Array<{ orgName: string; from: string; to: string }>
}

export interface ConflictReport {
  conflicting: boolean
  items: Array<{ ruleId: string; ruleName: string; reason: string }>
}

export interface DB {
  version: number
  asOfDate: string
  currentUserId: string
  users: User[]
  orgs: Org[]
  people: Person[]
  jobs: StandardJob[]
  assignments: Assignment[]
  workScopeTags: WorkScopeTag[]
  personWorkScopes: PersonWorkScope[]
  certificates: StandardCert[]
  holdings: CertHolding[]
  mappings: NameMapping[]
  rules: Rule[]
  issues: Issue[]
  remediations: RemediationRecord[]
  batches: ImportBatch[]
  snapshots: Snapshot[]
  audit: AuditLog[]
  lastCalcAt?: string
}
