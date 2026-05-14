interface CacheBucket {
  hits: number;
  creations: number;
  inputTokens: number;
  totalCalls: number;
}

const stats: Record<string, CacheBucket> = {};

export function recordCacheUsage(
  providerId: string,
  readCached: number,
  createdCache: number,
  inputTokens: number,
): void {
  const b = stats[providerId] ?? { hits: 0, creations: 0, inputTokens: 0, totalCalls: 0 };
  b.totalCalls += 1;
  if (readCached > 0) b.hits += 1;
  if (createdCache > 0) b.creations += 1;
  b.inputTokens += inputTokens;
  stats[providerId] = b;
}

export function snapshotMetrics(): Record<string, CacheBucket & { hitRate: number }> {
  const out: Record<string, CacheBucket & { hitRate: number }> = {};
  for (const [k, v] of Object.entries(stats)) {
    out[k] = { ...v, hitRate: v.totalCalls === 0 ? 0 : v.hits / v.totalCalls };
  }
  return out;
}
