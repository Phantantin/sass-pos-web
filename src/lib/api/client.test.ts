import { afterEach, describe, expect, it, vi } from "vitest";
import { api, RequestError } from "@/lib/api/client";

describe("BFF API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the same-origin BFF and retains a backend error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Phiên đăng nhập đã hết hạn" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api("/api/orders")).rejects.toEqual(
      expect.objectContaining({
        name: "Error",
        message: "Phiên đăng nhập đã hết hạn",
        status: 401,
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/api/orders",
      expect.objectContaining({
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("returns undefined for a successful no-content response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(api<void>("/api/customers/3", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("exposes a typed request error to UI error handlers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 403 })));

    await expect(api("/api/inventories")).rejects.toBeInstanceOf(RequestError);
  });
});
