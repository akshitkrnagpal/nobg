import { env } from "cloudflare:workers";
import type { ApiError } from "@nobg/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";
import type { openApiDocument } from "../src/openapi";

const IP = "203.0.113.7";
const consumeIp = vi.fn();
const consumeBudget = vi.fn();
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
    { method: "POST", headers: { "CF-Connecting-IP": IP }, body },
    { ...bindings, ...extra },
  );
}

beforeEach(() => {
  bindings = { ...env };
  consumeIp.mockReset().mockResolvedValue({ success: true, retryAfter: 60 });
  consumeBudget.mockReset().mockResolvedValue({ success: true, retryAfter: 60 });
  const ipStub = bindings.QUOTAS.getByName("test-ip");
  const budgetStub = bindings.QUOTAS.getByName("test-budget");
  vi.spyOn(ipStub, "consume").mockImplementation(consumeIp);
  vi.spyOn(budgetStub, "consume").mockImplementation(consumeBudget);
  vi.spyOn(bindings.QUOTAS, "getByName").mockImplementation((name) =>
    name === "image-budget" ? budgetStub : ipStub,
  );
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

describe("IP quotas", () => {
  it("accepts requests without accounts or API keys", async () => {
    expect((await request()).status).toBe(200);
    expect(consumeIp.mock.calls).toEqual([
      ["minute", 5],
      ["day", 20],
    ]);
    expect(consumeBudget).toHaveBeenCalledWith("month", 10000);
    const names = vi.mocked(bindings.QUOTAS.getByName).mock.calls.map(([name]) => name);
    expect(names[0]).toMatch(/^ip:[a-f0-9]{64}$/);
    expect(names).not.toContain(IP);
  });

  it("rejects missing or invalid Cloudflare IPs even with a forwarded IP", async () => {
    for (const ip of ["", "bad", "203.0.113.1, 203.0.113.2"]) {
      const response = await app.request(
        endpoint,
        {
          method: "POST",
          body: upload(),
          headers: { "CF-Connecting-IP": ip, "X-Forwarded-For": IP },
        },
        bindings,
      );
      expect(response.status).toBe(400);
    }
    expect(consumeIp).not.toHaveBeenCalled();
    expect(bindings.IMAGES.info).not.toHaveBeenCalled();
  });

  it("uses the same counter for equivalent IPv6 addresses and ignores X-Forwarded-For", async () => {
    for (const ip of ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"]) {
      await app.request(
        endpoint,
        {
          method: "POST",
          body: upload(),
          headers: {
            "CF-Connecting-IP": ip,
            "X-Forwarded-For": crypto.randomUUID(),
          },
        },
        bindings,
      );
    }
    const names = vi
      .mocked(bindings.QUOTAS.getByName)
      .mock.calls.filter(([name]) => name.startsWith("ip:"));
    expect(names[0]).toEqual(names[1]);
  });

  it("returns a retry interval when rate limited before reading the upload", async () => {
    consumeIp.mockResolvedValue({ success: false, retryAfter: 42 });
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect((await response.json<ApiError>()).error.code).toBe("rate_limited");
    expect(bindings.IMAGES.info).not.toHaveBeenCalled();
    expect(consumeBudget).not.toHaveBeenCalled();
  });

  it("rejects daily and monthly exhaustion before transformation", async () => {
    consumeIp
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, retryAfter: 3600 });
    let response = await request();
    expect(response.status).toBe(429);
    expect((await response.json<ApiError>()).error.code).toBe("daily_limit_reached");
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(consumeBudget).not.toHaveBeenCalled();
    consumeIp.mockResolvedValue({ success: true });
    consumeBudget.mockResolvedValue({ success: false, retryAfter: 86400 });
    response = await request();
    expect(response.status).toBe(429);
    expect((await response.json<ApiError>()).error.code).toBe("monthly_limit_reached");
    expect(response.headers.get("Retry-After")).toBe("86400");
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
  });

  it("fails closed for invalid quota settings", async () => {
    for (const key of [
      "IP_REQUESTS_PER_MINUTE",
      "IP_IMAGES_PER_DAY",
      "IMAGES_PER_MONTH",
    ] as const) {
      for (const value of ["", "0", "-1", "1.5", "bad"]) {
        expect((await request(upload(), { [key]: value })).status).toBe(503);
      }
    }
    expect(consumeIp).not.toHaveBeenCalled();
  });

  it("does not consume image allowances for invalid uploads", async () => {
    expect((await request("not multipart")).status).toBe(400);
    expect(consumeIp.mock.calls).toEqual([["minute", 5]]);
    expect(consumeBudget).not.toHaveBeenCalled();
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
          "CF-Connecting-IP": IP,
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
          "CF-Connecting-IP": IP,
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
    expect(consumeBudget).toHaveBeenCalledWith("month", 10000);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const payload = await response.json<ApiError>();
    expect(payload.error.code).toBe("processing_failed");
    expect(payload.error.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(JSON.stringify(payload)).not.toContain("private provider details");
  });

  it("handles unexpected failures with a request ID and no sensitive logging", async () => {
    consumeBudget.mockRejectedValue(new Error(IP));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request();
    expect(response.status).toBe(500);
    expect(bindings.IMAGES.input).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(IP);
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
    expect(json.paths["/api/v1/remove-background"].post.security).toEqual([]);
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

describe("browser demo access", () => {
  it.each(["https://nobg.akshit.io", "https://nobg.akntech.workers.dev"])(
    "allows preflight from %s without consuming quota",
    async (origin) => {
      const response = await app.request(
        endpoint,
        {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        },
        bindings,
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST,OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
      expect(consumeIp).not.toHaveBeenCalled();
      expect(bindings.IMAGES.info).not.toHaveBeenCalled();
    },
  );

  it.each(["https://elsewhere.example", "https://nobg.akshit.io.evil.example", "null"])(
    "does not grant browser access to %s",
    async (origin) => {
      const response = await app.request(
        endpoint,
        { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST" } },
        bindings,
      );
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    },
  );

  it("returns readable binary and quota errors to the website", async () => {
    const origin = "https://nobg.akshit.io";
    const send = () =>
      app.request(
        endpoint,
        { method: "POST", headers: { Origin: origin, "CF-Connecting-IP": IP }, body: upload() },
        bindings,
      );
    const success = await send();
    expect(success.status).toBe(200);
    expect(success.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(success.headers.get("Access-Control-Expose-Headers")).toBe("Retry-After,X-Request-Id");
    consumeIp.mockResolvedValue({ success: false, retryAfter: 30 });
    const denied = await send();
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(denied.headers.get("Retry-After")).toBe("30");
  });

  it("supports disabling browser access for self-hosting", async () => {
    const response = await app.request(
      endpoint,
      { method: "OPTIONS", headers: { Origin: "https://nobg.akshit.io" } },
      { ...bindings, ALLOWED_ORIGINS: "" },
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
