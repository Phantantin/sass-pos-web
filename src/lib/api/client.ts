import type { ApiError } from "@/types/api";

export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new RequestError(response.status, body.message ?? "Không thể hoàn tất yêu cầu");
  return body;
}
