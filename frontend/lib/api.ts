import type {
  Alert,
  AuditEntry,
  DocumentChunk,
  DocumentMeta,
  DrillingEvent,
  Evaluation,
  EventCluster,
  ExtractionResult,
  Formation,
  FormationCorrelation,
  ModelCard,
  Parameters,
  PressureWindow,
  ProcessingStatus,
  RiskProfilePoint,
  RiskZone,
  ScenarioPlan,
  SearchFilters,
  SearchResponse,
  Similarity,
  SimState,
  SurveyPoint,
  Trajectory,
  WellDetail,
  WellListItem,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Backend unreachable — start it with `uvicorn main:app --port 8000` in /backend");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString() : "";
};

export const api = {
  health: () => request<{ status: string; demo_mode: boolean }>("/api/health"),
  state: () => request<SimState>("/api/simulation/state"),

  wells: () => request<{ wells: WellListItem[]; active_well_id: string }>("/api/wells"),
  activeWell: () =>
    request<{
      well: WellDetail;
      formations: Formation[];
      current_state: { depth: number; formation: string | null; parameters: Parameters; status: string; feed: string };
    }>("/api/wells/active"),
  well: (id: string) =>
    request<{
      well: WellDetail;
      formations: Formation[];
      events: DrillingEvent[];
      survey: SurveyPoint[];
      documents: DocumentMeta[];
      similarity_to_active: Similarity | null;
      distance_to_active_km: number;
    }>(`/api/wells/${id}`),
  wellParameters: (id: string, step = 10) =>
    request<{ well_id: string; samples: (Parameters & { md: number })[] }>(`/api/wells/${id}/parameters${qs({ step })}`),
  trajectories: () => request<{ trajectories: Record<string, Trajectory[]> }>("/api/wells/trajectories"),
  pressureWindow: (id: string, radius_km: number) =>
    request<PressureWindow>(`/api/wells/${id}/pressure-window${qs({ radius_km, step: 10 })}`),
  similarity: (id: string) => request<{ similarities: Similarity[]; weights: Record<string, number> }>(`/api/wells/${id}/similarity`),

  events: (p: { well_id?: string; event_type?: string; formation?: string; radius_km?: number; depth_min?: number; depth_max?: number } = {}) =>
    request<{ events: DrillingEvent[]; total: number }>(`/api/events${qs(p)}`),
  eventDetail: (id: string) =>
    request<{ event: DrillingEvent; document: DocumentMeta | null; source_chunk: DocumentChunk | null }>(`/api/events/${id}`),

  correlate: (ids: string[]) =>
    request<{ correlation: FormationCorrelation[]; well_ids: string[] }>(`/api/formations/correlate${qs({ well_ids: ids.join(",") })}`),

  evaluate: (body: { well_id: string; current_depth: number; radius_km: number; persist?: boolean; parameters?: Partial<Parameters> }) =>
    request<Evaluation>("/api/risk/evaluate", { method: "POST", body: JSON.stringify(body) }),
  zones: () => request<{ zones: RiskZone[] }>("/api/risk/zones"),
  alerts: (well_id = "W001") => request<{ alerts: Alert[] }>(`/api/risk/alerts${qs({ well_id })}`),
  acknowledge: (alert_id: string, status: string, notes = "") =>
    request<{ success: boolean; alert: Alert }>("/api/risk/acknowledge", {
      method: "POST",
      body: JSON.stringify({ alert_id, status, notes, actor: "Drilling Engineer (demo)" }),
    }),
  audit: (alertId: string) => request<{ audit: AuditEntry[] }>(`/api/risk/alerts/${alertId}/audit`),
  profile: (radius_km: number, step = 10) =>
    request<{ profile: RiskProfilePoint[] }>(`/api/risk/profile${qs({ radius_km, step })}`),
  clusters: (radius_km: number) => request<{ clusters: EventCluster[] }>(`/api/risk/clusters${qs({ radius_km })}`),
  modelCard: () => request<ModelCard>("/api/risk/model"),

  search: (query: string, filters: SearchFilters, context: { well_id: string; depth?: number; formation?: string | null; radius_km?: number } | null, top_k = 6) =>
    request<SearchResponse>("/api/search/evidence", {
      method: "POST",
      body: JSON.stringify({ query, ...filters, context, top_k }),
    }),

  documents: () => request<{ documents: DocumentMeta[] }>("/api/documents"),
  document: (id: string) =>
    request<{ document: DocumentMeta; chunks: DocumentChunk[]; events: DrillingEvent[] }>(`/api/documents/${id}`),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ document_id: string; status: string }>("/api/documents/upload", { method: "POST", body: fd });
  },
  uploadSample: () => request<{ document_id: string; status: string; file: string }>("/api/documents/upload-sample", { method: "POST" }),
  samples: () => request<{ samples: { name: string; size_kb: number; url: string }[] }>("/api/documents/samples/list"),
  docStatus: (id: string) => request<ProcessingStatus>(`/api/documents/${id}/status`),
  extracted: (id: string) => request<ExtractionResult>(`/api/documents/${id}/extracted`),
  commit: (id: string, decisions: Record<string, unknown>[], well_id: string | null) =>
    request<{ success: boolean; events_saved: number; event_ids: string[]; chunks_indexed: number }>(`/api/documents/${id}/commit`, {
      method: "POST",
      body: JSON.stringify({ decisions, well_id }),
    }),
  deleteDocument: (id: string) => request<{ success: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),

  scenario: (scenario: "full" | "mud_loss" | "stuck_pipe" | "kick" = "full") =>
    request<ScenarioPlan>("/api/simulation/demo-scenario", { method: "POST", body: JSON.stringify({ scenario }) }),
  reset: () => request<{ success: boolean; depth: number }>("/api/simulation/reset", { method: "POST" }),
};
