import { env } from "cloudflare:workers";
import type { ApiError } from "@nobg/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";
import type { openApiDocument } from "../src/openapi";

const API_KEY = "test-only-key-not-for-deployment-1234567890";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const output = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const endpoint = "http://localhost/api/v1/remove-background";
let bindings: CloudflareBindings;
let transformer: ImageTransformer;

function upload(options: { bytes?: Uint8Array; type?: string; format?: string } = {}) {
  const form = new FormData();
  form.append(
    "image",
    new Blob([options.bytes ?? png], { type: options.type ?? "image/png" }),
    "photo.png",
  );
  if (options.format) form.append("format", options.format);
  return form;
}

function request(body: BodyInit = upload(), extra: Partial<CloudflareBindings> = {}) {
  return app.request(
    endpoint,
    { method: "POST", headers: { Authorization: `Bearer ${API_KEY}` }, body },
    { ...bindings, ...extra },
  );
}

beforeEach(() => {
  bindings = { ...env, API_KEY };
  vi.spyOn(bindings.RATE_LIMITER, "limit").mockResolvedValue({ success: true });
  vi.spyOn(bindings.IMAGES, "info").mockResolvedValue({
    format: "image/png",
    width: 400,
    height: 300,
    fileSize: 12,
  });
  transformer = {
    transform: vi.fn(() => transformer),
    draw: vi.fn(() => transformer),
    output: vi.fn(async (options) => ({
      response: () => new Response(output, { headers: { "Content-Type": options.format } }),
      image: () => new Blob([output]).stream(),
      contentType: () => options.format,
    })),
  };
  vi.spyOn(bindings.IMAGES, "input").mockReturnValue(transformer);
});

describe("authentication and limits", () => {
  it("fails closed when the API key is missing, short, or a placeholder", async () => {
    for (const key of [undefined, "short", "replace-with-a-random-key-of-at-least-32-characters"]) {
      const response = await request(upload(), { API_KEY: key });
      expect(response.status).toBe(503);
      expect((await response.json<ApiError>()).error.code).toBe("not_configured");
    }
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });

  it("rejects missing and incorrect credentials before processing", async () => {
    for (const authorization of [
      "",
      "Bearer wrong-key",
      `Basic ${API_KEY}`,
      `Bearer ${API_KEY} extra`,
    ]) {
      const response = await app.request(
        endpoint,
        { method: "POST", headers: { Authorization: authorization }, body: upload() },
        bindings,
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    }
    expect(bindings.RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(bindings.IMAGES.info).not.toHaveBeenCalled();
  });

  it("returns a retry interval when rate limited", async () => {
    vi.mocked(bindings.RATE_LIMITER.limit).mockResolvedValue({ success: false });
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });

  it("rejects invalid configured limits", async () => {
    for (const limit of ["0", "-1", "bad", "20971521", "1.5"]) {
      expect((await request(upload(), { MAX_UPLOAD_BYTES: limit })).status).toBe(503);
    }
  });

  it("rejects an oversized file even within the multipart allowance", async () => {
    expect((await request(upload(), { MAX_UPLOAD_BYTES: "8" })).status).toBe(413);
    expect(bindings.IMAGES.info).not.toHaveBeenCalled();
  });

  it("rejects a streamed oversized body without Content-Length and cancels it", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(65536 + 64));
      },
      cancel,
    });
    const response = await app.request(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "multipart/form-data; boundary=test",
        },
        body: stream,
      },
      { ...bindings, MAX_UPLOAD_BYTES: "16" },
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalled();
    expect(bindings.IMAGES.info).not.toHaveBeenCalled();
  });

  it("rejects oversized dimensions before transformation", async () => {
    vi.mocked(bindings.IMAGES.info).mockResolvedValue({
      format: "image/png",
      width: 10000,
      height: 10000,
      fileSize: 12,
    });
    expect((await request()).status).toBe(413);
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });
});

describe("upload validation", () => {
  it("rejects non-multipart and malformed multipart requests", async () => {
    expect((await request("not multipart")).status).toBe(400);
    const response = await app.request(
      endpoint,
      {
        method: "POST",
        body: "broken",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "multipart/form-data; boundary=missing",
        },
      },
      bindings,
    );
    expect(response.status).toBe(400);
  });

  it("rejects absent, empty, text, unknown, and duplicate fields", async () => {
    const empty = new FormData();
    const text = new FormData();
    text.set("image", "photo.png");
    const duplicate = upload();
    duplicate.append("image", new Blob([png]), "two.png");
    const unknown = upload();
    unknown.set("url", "https://example.com/image.jpg");
    const formats = upload({ format: "png" });
    formats.append("format", "webp");
    for (const form of [
      empty,
      text,
      duplicate,
      unknown,
      formats,
      upload({ bytes: new Uint8Array() }),
    ]) {
      expect((await request(form)).status).toBe(400);
    }
  });

  it("rejects disguised files and mismatched MIME types", async () => {
    for (const form of [
      upload({ bytes: new TextEncoder().encode("<svg>bad</svg>") }),
      upload({ type: "image/jpeg" }),
      upload({ format: "jpeg" }),
    ]) {
      expect((await request(form)).status).toBe(415);
    }
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });

  it("rejects files the image decoder cannot read", async () => {
    vi.mocked(bindings.IMAGES.info).mockRejectedValue(new Error("internal-provider-message"));
    const response = await request();
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("internal-provider-message");
  });
});

describe("output and service behavior", () => {
  it.each(["png", "webp"] as const)(
    "returns binary %s with transparency settings and safe headers",
    async (format) => {
      const response = await request(upload({ format }));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(`image/${format}`);
      expect(response.headers.get("Content-Disposition")).toBe(
        `attachment; filename="nobg.${format}"`,
      );
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Request-Id")).toMatch(/^[a-f0-9-]{36}$/);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(output);
      expect(transformer.transform).toHaveBeenCalledWith({ segment: "foreground" });
      expect(transformer.output).toHaveBeenCalledWith({ format: `image/${format}`, anim: false });
    },
  );

  it("defaults to PNG and accepts binary uploads with recognized signatures", async () => {
    const response = await request(upload({ type: "application/octet-stream" }));
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("maps provider exceptions to a safe error without returning the input", async () => {
    vi.mocked(transformer.output).mockRejectedValue(new Error("private provider details"));
    const response = await request();
    expect(response.status).toBe(502);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const payload = await response.json<ApiError>();
    expect(payload.error.code).toBe("processing_failed");
    expect(payload.error.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(JSON.stringify(payload)).not.toContain("private provider details");
  });

  it("handles unexpected failures with a request ID and no sensitive logging", async () => {
    vi.mocked(bindings.RATE_LIMITER.limit).mockRejectedValue(new Error(API_KEY));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request();
    expect(response.status).toBe(500);
    expect(JSON.stringify(log.mock.calls)).not.toContain(API_KEY);
    expect((await response.json<ApiError>()).error.requestId).toBe(
      response.headers.get("X-Request-Id"),
    );
  });

  it("exposes health and OpenAPI without calling Images", async () => {
    const health = await app.request("/api/health", {}, bindings);
    expect(await health.json()).toEqual({ status: "ok", service: "nobg", version: "0.1.0" });
    const spec = await app.request("/api/openapi.json", {}, bindings);
    const json = await spec.json<typeof openApiDocument>();
    expect(json.openapi).toBe("3.1.0");
    expect(json.paths["/api/v1/remove-background"].post.security).toEqual([{ bearerAuth: [] }]);
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });

  it("returns JSON for unknown routes and does not permit cross-origin browser access", async () => {
    const response = await app.request(
      "/api/missing",
      { headers: { Origin: "https://elsewhere.example" } },
      bindings,
    );
    expect(response.status).toBe(404);
    expect((await response.json<ApiError>()).error.code).toBe("not_found");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
