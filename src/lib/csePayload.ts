/** CSE list payloads vary; pick first array of rows with `symbol`. */
export function extractCseRowArray(payload: unknown): any[] {
  const d = (payload as any)?.data ?? payload;
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  for (const v of Object.values(d as Record<string, unknown>)) {
    if (
      Array.isArray(v) &&
      v.length > 0 &&
      v[0] != null &&
      typeof v[0] === 'object' &&
      'symbol' in (v[0] as object)
    ) {
      return v as any[];
    }
  }
  return [];
}
