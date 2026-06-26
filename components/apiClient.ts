import type {
  FocalPoint,
  FunctionalResult,
  ImprovedRcsContent,
  MediaIntrospection,
  ScoreResult,
  StandaloneRichCard,
} from "@/types/rcs";

/** One logged HTTP exchange against the scoring API (shell-only, not the kernel). */
export interface TrafficEntry {
  id: number;
  method: "POST";
  path: string;
  status: number; // HTTP status, or 0 on a network failure
  ms: number;
  ok: boolean;
  request: unknown;
  response: unknown;
  at: number; // epoch ms
}

export type EmitTraffic = (entry: TrafficEntry) => void;

export interface CardRequestBody {
  card: StandaloneRichCard;
  media?: MediaIntrospection;
  focal?: FocalPoint;
}

export interface AnalyzeResponse {
  functional: FunctionalResult;
  quality: ScoreResult;
}

let seq = 0;

async function call(path: string, body: unknown, emit: EmitTraffic): Promise<{ ok: boolean; data: unknown }> {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let data: unknown = null;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = res.status;
    ok = res.ok;
    data = await res.json().catch(() => null);
  } catch (e) {
    data = { error: "NetworkError", message: (e as Error).message };
  }
  const ms = Math.round(performance.now() - started);
  emit({ id: ++seq, method: "POST", path, status, ms, ok, request: body, response: data, at: Date.now() });
  return { ok, data };
}

export async function analyzeCard(body: CardRequestBody, emit: EmitTraffic): Promise<AnalyzeResponse | null> {
  const { ok, data } = await call("/api/analyze", body, emit);
  return ok ? (data as AnalyzeResponse) : null;
}

export async function improveCard(body: CardRequestBody, emit: EmitTraffic): Promise<ImprovedRcsContent | null> {
  const { ok, data } = await call("/api/improve", body, emit);
  return ok ? (data as ImprovedRcsContent) : null;
}

export async function introspectUrl(url: string, emit: EmitTraffic): Promise<MediaIntrospection> {
  const { ok, data } = await call("/api/media-info", { url }, emit);
  if (!ok) throw new Error((data as { message?: string })?.message ?? "Media fetch failed.");
  return data as MediaIntrospection;
}
