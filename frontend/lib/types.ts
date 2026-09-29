// API contract — mirrors backend/schemas.py and the service response shapes.

export type Severity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "active" | "acknowledged" | "dismissed" | "reviewed";
export type RiskFamily =
  | "mud_loss"
  | "stuck_pipe"
  | "kick"
  | "torque_spike"
  | "wellbore_instability"
  | "cementing_failure"
  | "NPT";

export interface Well {
  id: string;
  name: string;
  role: "active" | "offset";
  status: string;
  field: string;
  basin: string;
  latitude: number;
  longitude: number;
  spud_date: string;
  completion_date: string | null;
  total_depth_md: number;
  current_depth_md: number;
  total_depth_tvd: number;
  well_type: string;
  formation_target: string;
  rig: string;
}

export interface WellListItem extends Well {
  distance_km: number;
  bearing: number;
  direction: string;
  similarity: number | null;
  event_count: number;
  npt_hours: number;
  history_severity: Severity | null;
  event_types: string[];
  risk_families: RiskFamily[];
  document_count: number;
}

export interface WellDetail extends Well {
  operator_note: string;
  mud_program: Record<string, number>;
}

export interface Formation {
  id: string;
  well_id: string;
  name: string;
  top_md: number;
  base_md: number;
  lithology: string;
  risk_tags: string[];
  is_prognosed: number;
  porosity_pct?: number | null;
  pore_pressure_sg?: number | null;
  frac_gradient_sg?: number | null;
}

export interface SurveyPoint {
  md: number;
  tvd: number;
  inclination: number;
  azimuth: number;
  latitude: number;
  longitude: number;
  dogleg: number;
  is_planned: number;
}

export interface DrillingEvent {
  id: string;
  well_id: string;
  well_name?: string;
  event_type: string;
  event_label?: string;
  risk_family?: RiskFamily;
  title: string;
  depth_start: number;
  depth_end: number;
  formation: string;
  severity: Severity;
  date: string;
  description: string;
  root_cause: string;
  mitigation_action: string;
  lessons_learned: string;
  npt_hours: number;
  source_document_id: string | null;
  source_page: number | null;
  source_section: string | null;
  event_params: Record<string, number>;
  origin: string;
  extraction_confidence: number | null;
  document_title?: string | null;
  document_type?: string | null;
}

export interface DocumentMeta {
  id: string;
  well_id: string | null;
  well_name?: string;
  title: string;
  doc_type: string;
  date: string | null;
  source_status: string;
  page_count: number;
  processing_status: string;
  summary: string;
  original_filename?: string | null;
  chunk_count?: number;
  event_count?: number;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  text: string;
  page: number;
  section: string;
  depth_start: number | null;
  depth_end: number | null;
  formation: string | null;
  tags: string[];
}

export interface RiskZone {
  id: string;
  formation: string;
  depth_start: number;
  depth_end: number;
  risk_type: RiskFamily;
  risk_label: string;
  severity: Severity;
  historical_frequency: number;
  contributing_wells: string[];
  source: "curated" | "derived";
  description: string;
}

export interface Similarity {
  well_a_id: string;
  well_b_id: string;
  score: number;
  formation_overlap: number;
  depth_coverage: number;
  trajectory_similarity: number;
  parameter_similarity: number;
  distance_km: number;
  reasons: string[];
}

export interface Parameters {
  md?: number;
  rop: number;
  wob: number;
  torque: number;
  rpm: number;
  flow_rate: number;
  standpipe_pressure: number;
  mud_weight: number;
  ecd: number;
  hook_load: number;
  pump_pressure?: number;
  gas_units: number;
}

export interface Signal {
  signal: keyof Parameters;
  label: string;
  unit: string;
  value: number;
  baseline: number | null;
  ratio: number | null;
  z: number | null;
  deviation: string;
  anomalous: boolean;
  note: string;
  reference: { value: number; well: string; meaning: string } | null;
}

export interface Factor {
  factor: "proximity" | "frequency" | "similarity" | "formation" | "parameter" | "trajectory";
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface EvidenceEvent {
  event_id: string;
  well_id: string;
  well_name: string;
  event_type: string;
  event_label: string;
  title: string;
  severity: Severity;
  depth_start: number;
  depth_end: number;
  formation: string;
  date: string;
  description: string;
  root_cause: string;
  mitigation: string;
  lessons: string;
  npt_hours: number;
  document_id: string | null;
  document_title: string | null;
  document_type: string | null;
  page: number | null;
  section: string | null;
  similarity: number | null;
  distance_km: number;
}

export interface SupportingWell {
  well_id: string;
  well_name: string;
  event_type: string;
  depth: number;
  date: string;
  similarity: number | null;
  distance_km: number;
  severity: Severity;
}

export interface RiskAssessment {
  evaluated_at_depth: number;
  zone_id: string;
  zone_source: "curated" | "derived";
  risk_type: RiskFamily;
  risk_label: string;
  score: number;
  confidence: number;
  confidence_note: string;
  severity: Severity;
  historical_severity: Severity;
  alert_eligible: boolean;
  alert_threshold: number;
  status: "alert" | "watch";
  position: "inside" | "ahead" | "passed";
  lead_depth: number;
  risk_window: { start: number; end: number };
  zone_window: { start: number; end: number };
  affected_formation: string;
  current_formation: string | null;
  reasons: string[];
  factors: Factor[];
  contributing_signals: Signal[];
  supporting_wells: SupportingWell[];
  evidence: EvidenceEvent[];
  related_events: EvidenceEvent[];
  evidence_snippets: string[];
  recommendation: string;
  recommended_checks: string[];
  offset_practice: string[];
  evidence_ids: string[];
  /** Learned cross-check (logistic model backtested on offset wells); absent until the model has trained. */
  ml?: LearnedOpinion;
}

export interface LearnedOpinion {
  probability: number;
  base_rate: number;
  lift: number;
  elevated: boolean;
  verdict: "agrees" | "more_concerned" | "less_sure";
  horizon_m: number;
}

export interface LearnedModel {
  method: string;
  target: string;
  validation: string;
  caveat: string;
  status: "ready" | "training" | "unavailable";
  error: string | null;
  intercept?: number;
  coefficients?: Record<string, number>;
  learned_weights?: Record<string, number>;
  hand_weights?: Record<string, number>;
  rows?: number;
  positives?: number;
  wells?: number;
  base_rate?: number;
  auc_model?: number | null;
  auc_rule?: number | null;
  per_family?: Record<string, { rows: number; positives: number; auc_model: number | null; auc_rule: number | null }>;
  horizon_m?: number;
  seconds?: number;
}

export interface CasingString {
  id: string;
  name: string;
  size_in: string;
  top_md: number;
  shoe_md: number;
  planned: number;
}

export interface Alert {
  id: string;
  well_id: string;
  zone_id: string | null;
  triggered_at_depth: number;
  risk_type: RiskFamily;
  risk_label: string;
  severity: Severity;
  score: number;
  confidence: number;
  lead_depth: number;
  reasons: string[];
  evidence_ids: string[];
  supporting_wells: string[];
  recommendation: string;
  status: AlertStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  assessment: RiskAssessment;
}

export interface AuditEntry {
  action: string;
  depth: number | null;
  actor: string;
  notes: string;
  timestamp: string;
}

export interface ContextSummary {
  text: string;
  highlighted_wells: { well_id: string; event_types: string[] }[];
  nearby_events: EvidenceEvent[];
}

export interface Evaluation {
  well_id: string;
  depth: number;
  radius_km: number;
  current_formation: string | null;
  parameters: Parameters;
  trend: Parameters[];
  assessments: RiskAssessment[];
  alerts: RiskAssessment[];
  new_alert_ids: string[];
  active_alerts: Alert[];
  overall_risk_level: Severity;
  next_risk_zone: {
    zone_id: string;
    type: RiskFamily;
    label: string;
    depth: number;
    distance: number;
    formation: string;
  } | null;
  context: ContextSummary;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

export interface RiskProfilePoint {
  depth: number;
  score: number;
  risk_type: RiskFamily | null;
  severity: Severity;
}

export interface EvidenceCard {
  kind: "chunk" | "event" | "parameter";
  id: string;
  chunk_text: string;
  document_id: string | null;
  document_title: string;
  document_type: string;
  well_id: string | null;
  well_name: string;
  page: number | null;
  section: string;
  depth_start: number | null;
  depth_end: number | null;
  formation: string | null;
  date: string | null;
  relevance_score: number;
  score_breakdown: { keyword?: number; semantic?: number; metadata?: number };
  event_id: string | null;
  event_type: string | null;
  event_label: string | null;
  severity: Severity | null;
  root_cause: string | null;
  mitigation: string | null;
  lessons: string | null;
  npt_hours: number | null;
  description?: string | null;
  title?: string | null;
  event_depth_start?: number | null;
  event_depth_end?: number | null;
  event_formation?: string | null;
  highlights: string[];
  source_status: string;
  params?: Partial<Parameters>;
}

export interface SearchResponse {
  query: string;
  answer: string;
  answer_sentences: { text: string; citations: number[] }[];
  answer_extractive?: string;
  confidence: number;
  insufficient: boolean;
  evidence: EvidenceCard[];
  related_wells: string[];
  understanding: {
    intent: string;
    families: RiskFamily[];
    depth_ranges: [number, number][];
    formations: string[];
    wells: string[];
    used_context: boolean;
  };
  suggested_queries: string[];
  retrieval: {
    method: string;
    weights: Record<string, number>;
    embedder: string;
    min_relevance: number;
    generator: string;
  };
}

export interface SearchFilters {
  well_id?: string;
  formation?: string;
  depth_min?: number;
  depth_max?: number;
  event_type?: string;
  doc_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface ScenarioStep {
  depth: number;
  narration: string | null;
  triggers: string[];
  highlight_wells: string[];
}

export interface ScenarioPlan {
  scenario: string;
  depth_progression: number[];
  steps: ScenarioStep[];
  alerts_expected: {
    depth: number;
    risk_type: RiskFamily;
    risk_label: string;
    severity: Severity;
    score: number;
    supporting_wells: string[];
  }[];
  step_delay_ms: number;
}

export interface EventCluster {
  risk_type: RiskFamily;
  risk_label: string;
  formation: string;
  depth_start: number;
  depth_end: number;
  event_count: number;
  well_count: number;
  wells: string[];
  max_severity: Severity;
  total_npt_hours: number;
  common_mitigations: string[];
  event_ids: string[];
}

export interface ModelCard {
  name: string;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  lookahead_m: number;
  approach_window_m: number;
  factors: Record<string, string>;
  alert_policy: string;
  limitations: string[];
  learned: LearnedModel;
}

export interface Trajectory {
  md: number;
  lat: number;
  lon: number;
  planned: boolean;
}

export interface ProcessingStatus {
  document_id: string;
  status: string;
  stage_index: number;
  progress: number;
  stages: { key: string; label: string }[];
  log: { t: number; stage: string; message: string }[];
  error?: string | null;
  events_extracted: number;
  chunks: number;
  entities: number;
  title: string;
  well_id: string | null;
  ocr_engine: string;
}

export interface CandidateEvent {
  candidate_id: string;
  event_type: string;
  event_label: string;
  depth_start: number | null;
  depth_end: number | null;
  formation: string | null;
  severity: Severity;
  description: string;
  root_cause: string;
  mitigation_action: string;
  lessons_learned: string;
  npt_hours: number;
  source_page: number;
  source_section: string;
  evidence_text: string;
  confidence: number;
  needs_review: boolean;
  approved: boolean;
  possible_duplicate_of?: { id: string; title: string; depth_start: number; depth_end: number };
}

export interface ExtractedEntity {
  type: string;
  value: string;
  count: number;
  page: number;
}

export interface ExtractionResult {
  document: DocumentMeta;
  events: CandidateEvent[];
  entities: ExtractedEntity[];
  chunks: { page: number; index: number; text: string; section: string; depth_start: number | null; depth_end: number | null; formation: string | null; tags: string[] }[];
  pages: { page: number; method: string; text: string; ocr_confidence?: number | null }[];
  detected: { well_id: string | null; date: string | null; doc_type: string | null };
  wells: { id: string; name: string }[];
}

export interface FormationCorrelation {
  formation: string;
  top_spread_m: number;
  risk_tags: string[];
  event_count: number;
  wells: {
    well_id: string;
    well_name: string;
    top_md: number;
    base_md: number;
    thickness: number;
    prognosed: boolean;
    porosity_pct?: number | null;
    pore_pressure_sg?: number | null;
    frac_gradient_sg?: number | null;
    events: { id: string; event_type: string; label: string; depth_start: number; depth_end: number; severity: Severity }[];
  }[];
}

export interface PressureRow {
  md: number;
  formation: string | null;
  pore_prognosed: number | null;
  frac_prognosed: number | null;
  pore_calibrated: number | null;
  frac_calibrated: number | null;
  mw_plan: number | null;
  mw: number | null;
  ecd: number | null;
}

export interface PressureWindow {
  well_id: string;
  radius_km: number;
  rows: PressureRow[];
  calibrations: { kind: "frac_cap" | "pore_floor"; start: number; end: number; value: number; event_id: string; well: string; note: string }[];
  casing: { name: string; size: string; top_md: number; shoe_md: number; planned: boolean }[];
  breaches: { kind: "kick" | "losses"; start: number; end: number; message: string }[];
}

export interface SimState {
  demo_mode: boolean;
  llm_provider: string;
  disclaimer: string;
  active_well_id: string;
  default_depth: number;
  default_radius_km: number;
  knowledge_base: { wells: number; events: number; documents: number; chunks: number; alerts: number };
  server_time: string;
}
