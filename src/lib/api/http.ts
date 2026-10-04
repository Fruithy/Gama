import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function noStore<T>(data: T) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** Wrap a route handler: converts ApiError / ZodError into JSON responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.code, message: err.message, ...err.extra }, { status: err.status });
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "invalid_request", issues: err.issues.slice(0, 5) }, { status: 400 });
      }
      console.error("[api] unhandled error", err);
      return NextResponse.json({ error: "server_error", message: "Something went wrong." }, { status: 500 });
    }
  };
}

const MAX_BODY_BYTES = 64 * 1024;

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  return schema.parse(data);
}

/** Reject cross-site state-changing requests (defence in depth on top of SameSite cookies). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients / same-origin navigations
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (host && new URL(origin).host !== host) throw new ApiError(403, "cross_origin");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "cross_origin");
  }
}
