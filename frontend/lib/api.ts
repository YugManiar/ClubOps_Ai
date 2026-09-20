import { createClient } from "@/lib/supabase/client";
import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** A hung backend must not leave a dialog spinning forever. Long work is
 *  queued and polled (see /api/events/plan), so no single call needs longer. */
const TIMEOUT_MS = 30_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // The FastAPI backend verifies this Supabase JWT to know who is calling.
  const {
    data: { session },
  } = await createClient().auth.getSession();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(session && { Authorization: `Bearer ${session.access_token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ApiError("The ClubOps server took too long to respond.");
    }
    throw new ApiError("Can't reach the ClubOps server. Is the backend running?");
  }
  if (!res.ok) {
    if (res.status === 429) {
      const retry = res.headers.get("retry-after");
      throw new ApiError(
        `Too many requests. Try again${retry ? ` in ${retry}s` : " shortly"}.`,
        429
      );
    }
    const detail = await res.json().then((j) => j?.detail).catch(() => null);
    throw new ApiError(
      typeof detail === "string" ? detail : `Request failed (${res.status})`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
