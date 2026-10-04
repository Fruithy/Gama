/** Fetch wrapper: JSON, timeouts and typed errors. */
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      signal: ctrl.signal,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new RequestError(res.status, data.error ?? "error", data.message ?? "Request failed");
    return data as T;
  } catch (e) {
    if (e instanceof RequestError) throw e;
    throw new RequestError(0, (e as Error).name === "AbortError" ? "timeout" : "network", "Network unavailable");
  } finally {
    clearTimeout(timer);
  }
}
