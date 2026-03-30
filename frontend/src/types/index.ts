export interface Process {
  id: number
  code: string
  name: string
  description?: string
  objective?: string
  owner?: string
  department?: string
  is_critical: boolean
  critical_reason?: string
  last_assessment_date?: string
  notes?: string
  created_at: string
  updated_at: string
  applications: ApplicationSummary[]
  has_bia: boolean
  has_business_context: boolean
}

export interface ApplicationSummary {
  id: number
  code: string
  name: string
}

export interface Application {
  id: number
  code: string
  name: string
  description?: string
  business_owner?: string
  technical_owner?: string
  notes?: string
  review_date?: string
  created_at: string
  updated_at: string
  processes: ProcessSummary[]
}

export interface ProcessSummary {
  id: number
  code: string
  name: string
}

export interface BiaAssessment {
  id: number
  process_id: number
  availability_score?: number
  integrity_score?: number
  confidentiality_score?: number
  b1_score?: number; b1_arg?: string
  b2_score?: number; b2_arg?: string
  b3_score?: number; b3_arg?: string
  b4_score?: number; b4_arg?: string
  b5_score?: number; b5_arg?: string
  b6_score?: number; b6_arg?: string
  b7_score?: number; b7_arg?: string
  b8_score?: number; b8_arg?: string
  i1_score?: number; i1_arg?: string
  i2_score?: number; i2_arg?: string
  i3_score?: number; i3_arg?: string
  i4_score?: number; i4_arg?: string
  i5_score?: number; i5_arg?: string
  i6_score?: number; i6_arg?: string
  i7_score?: number; i7_arg?: string
  v1_score?: number; v1_arg?: string
  v2_score?: number; v2_arg?: string
  v3_score?: number; v3_arg?: string
  v4_score?: number; v4_arg?: string
  v5_score?: number; v5_arg?: string
  v6_score?: number; v6_arg?: string
  v7_score?: number; v7_arg?: string
  interviewer_name?: string
  interview_date?: string
  general_description?: string
  chain_dependencies?: string
  owner_deviation_motivation?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface BusinessContext {
  id: number
  process_id: number
  key_partners?: string
  key_activities?: string
  key_resources?: string
  value_proposition?: string
  customer_relationships?: string
  channels?: string
  customer_segments?: string
  cost_structure?: string
  revenue_streams?: string
  legal_basis?: string
  stakeholders?: string
  chain_position?: string
  continuity_requirements?: string
  notes?: string
  key_aspects?: string
  personal_data?: boolean
  special_personal_data?: boolean
  review_date?: string
  created_at: string
  updated_at: string
}

export interface DashboardSummary {
  total_processes: number
  critical_processes: number
  complete_count: number
  attention_count: number
  incomplete_count: number
}

export interface ProcessCompleteness {
  id: number
  code: string
  name: string
  is_critical: boolean
  has_bia: boolean
  has_business_context: boolean
  app_count: number
  is_complete: boolean
  missing_fields: string[]
}

export interface BivTopItem {
  process_id: number
  process_code: string
  process_name: string
  score: number
  label: string
}

export interface BivTopStats {
  availability: BivTopItem[]
  integrity: BivTopItem[]
  confidentiality: BivTopItem[]
}

// ── Risk Overview ──────────────────────────────────────────────────────────────

export interface BivDimensionDistribution {
  vitaal: number
  hoog: number
  midden: number
  laag: number
  minimaal: number
  not_assessed: number
}

export interface BivDistribution {
  availability: BivDimensionDistribution
  integrity: BivDimensionDistribution
  confidentiality: BivDimensionDistribution
}

export interface CriticalProcessRisk {
  id: number
  code: string
  name: string
  availability_score: number | null
  integrity_score: number | null
  confidentiality_score: number | null
  has_bia: boolean
  has_rto_rpo: boolean
  rto_value: number | null
  rto_unit: string | null
  missing_fields: string[]
}

export interface CoverageStats {
  done: number
  total: number
  pct: number
}

export interface Coverage {
  bia: CoverageStats
  rto_rpo: CoverageStats
  business_context: CoverageStats
  applications: CoverageStats
}

export interface PrivacyExposure {
  personal_data: number
  special_personal_data: number
}

export interface PriorityAction {
  id: number
  code: string
  name: string
  is_critical: boolean
  priority: 'critical' | 'high' | 'medium'
  reason: string
  missing_fields: string[]
}

export interface ReviewStatusItem {
  on_time: number
  total: number
  pct: number
}

export interface ReviewStatus {
  processes: ReviewStatusItem
  applications: ReviewStatusItem
  bia: ReviewStatusItem
  business_context: ReviewStatusItem
}

export interface RiskOverview {
  biv_distribution: BivDistribution
  critical_processes: CriticalProcessRisk[]
  coverage: Coverage
  privacy_exposure: PrivacyExposure
  privacy_coverage: CoverageStats
  process_fields_coverage: CoverageStats
  high_risk_count: number
  priority_actions: PriorityAction[]
}
