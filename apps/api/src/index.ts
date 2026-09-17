import { isIP } from "node:net";
import {
  type ApiError,
  DEFAULT_MAX_UPLOAD_BYTES,
  type ErrorCode,
  MAX_IMAGE_PIXELS,
  MAX_UPLOAD_BYTES,
  outputFormats,
} from "@nobg/contracts";
import { type Context, Hono } from "hono";
import { openApiDocument } from "./openapi";

export { QuotaCounter } from "./quota";

type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: { requestId: string };
};

class RequestError extends Error {
  constructor(
    public code: ErrorCode,
    public status: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
  }
}

// Bound the entire multipart body, including requests without Content-Length.
async function readUpload(request: Request, maximum: number): Promise<FormData> {
  const bodyLimit = maximum + 64 * 1024;
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > bodyLimit)
    throw new RequestError("payload_too_large", 413, "Upload exceeds the configured size limit.");
  if (!request.body)
    throw new RequestError("invalid_request", 400, "Provide an image in the image form field.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > bodyLimit) {
        await reader.cancel();
        throw new RequestError(
          "payload_too_large",
          413,
          "Upload exceeds the configured size limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Response(bytes, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new RequestError("invalid_request", 400, "Malformed multipart form data.");
  }
}

async function imageType(file: File): Promise<string | undefined> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  const text = new TextDecoder().decode(bytes);
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
}

export const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.header("X-Request-Id", c.get("requestId"));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
  await next();
});

function failure(
  c: Context<AppEnv>,
  code: ErrorCode,
  message: string,
  status: 400 | 401 | 404 | 413 | 415 | 429 | 500 | 502 | 503,
) {
  return c.json(
    { error: { code, message, requestId: c.get("requestId") } } satisfies ApiError,
    status,
  );
}

app.get("/api/health", (c) => c.json({ status: "ok", service: "nobg", version: "0.1.0" }));
app.get("/api/openapi.json", (c) => c.json(openApiDocument));

app.post("/api/v1/remove-background", async (c) => {
  const limits = {
    minute: Number(c.env.IP_REQUESTS_PER_MINUTE),
    day: Number(c.env.IP_IMAGES_PER_DAY),
    month: Number(c.env.IMAGES_PER_MONTH),
  };
  if (Object.values(limits).some((limit) => !Number.isSafeInteger(limit) || limit < 1)) {
    return failure(c, "not_configured", "Quota limits must be positive integers.", 503);
  }
  const ip = c.req.header("CF-Connecting-IP") ?? "";
  const version = isIP(ip);
  if (!version) {
    return failure(c, "invalid_request", "A Cloudflare client IP is required.", 400);
  }
  // Cloudflare supplies this header. Never use client-controlled X-Forwarded-For.
  const canonicalIp = version === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalIp));
  const ipHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const ipQuota = c.env.QUOTAS.getByName(`ip:${ipHash}`);
  const minute = await ipQuota.consume("minute", limits.minute);
  if (!minute.success) {
    c.header("Retry-After", String(minute.retryAfter));
    return failure(c, "rate_limited", "Too many requests from this IP. Try again later.", 429);
  }
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(c.req.header("Content-Type") ?? "")) {
    return failure(c, "invalid_request", "Use multipart/form-data with an image field.", 400);
  }
  const maximum =
    c.env.MAX_UPLOAD_BYTES === undefined
      ? DEFAULT_MAX_UPLOAD_BYTES
      : Number(c.env.MAX_UPLOAD_BYTES);
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_UPLOAD_BYTES) {
    return failure(c, "not_configured", "MAX_UPLOAD_BYTES must be between 1 and 20971520.", 503);
  }
  const form = await readUpload(c.req.raw, maximum);
  const fields = [...form.keys()];
  if (
    fields.some((field) => field !== "image" && field !== "format") ||
    form.getAll("image").length !== 1 ||
    form.getAll("format").length > 1
  ) {
    return failure(
      c,
      "invalid_request",
      "Provide one image field and an optional format field.",
      400,
    );
  }
  const file = form.get("image");
  if (!file || typeof file === "string" || file.size === 0) {
    return failure(c, "invalid_request", "Provide a non-empty file in the image field.", 400);
  }
  if (file.size > maximum)
    return failure(c, "payload_too_large", "Image exceeds the configured size limit.", 413);
  const format = form.get("format") ?? "png";
  if (format !== "png" && format !== "webp")
    return failure(c, "unsupported_format", "Output format must be png or webp.", 415);
  const detectedType = await imageType(file);
  if (
    !detectedType ||
    (file.type && file.type !== "application/octet-stream" && file.type !== detectedType)
  ) {
    return failure(
      c,
      "unsupported_format",
      "Upload a JPEG, PNG, or WebP image with a matching content type.",
      415,
    );
  }
  try {
    const info = await c.env.IMAGES.info(file.stream());
    if (!("width" in info) || !("height" in info) || info.width < 1 || info.height < 1) {
      return failure(c, "invalid_image", "The image could not be decoded.", 400);
    }
    if (info.width * info.height > MAX_IMAGE_PIXELS)
      return failure(c, "payload_too_large", "Images must be 25 megapixels or smaller.", 413);
  } catch {
    return failure(c, "invalid_image", "The image could not be decoded.", 400);
  }
  const daily = await ipQuota.consume("day", limits.day);
  if (!daily.success) {
    c.header("Retry-After", String(daily.retryAfter));
    return failure(c, "daily_limit_reached", "This IP has reached its daily image allowance.", 429);
  }
  // The shared budget coordinates processing admissions only; images never enter a DO.
  const monthly = await c.env.QUOTAS.getByName("image-budget").consume("month", limits.month);
  if (!monthly.success) {
    c.header("Retry-After", String(monthly.retryAfter));
    return failure(
      c,
      "monthly_limit_reached",
      "The service has reached its monthly image allowance.",
      429,
    );
  }
  try {
    const image = await c.env.IMAGES.input(file.stream())
      .transform({ segment: "foreground" })
      .output({ format: outputFormats[format], anim: false });
    const response = image.response();
    if (!response.ok)
      return failure(
        c,
        "processing_failed",
        "Image processing failed. Check the Images service configuration.",
        502,
      );
    return new Response(response.body, {
      headers: {
        "Content-Type": outputFormats[format],
        "Content-Disposition": `attachment; filename="nobg.${format}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": c.get("requestId"),
      },
    });
  } catch {
    return failure(
      c,
      "processing_failed",
      "Image processing failed. Check the Images service configuration.",
      502,
    );
  }
});

app.notFound((c) => failure(c, "not_found", "Endpoint not found.", 404));
app.onError((error, c) => {
  if (error instanceof RequestError) return failure(c, error.code, error.message, error.status);
  console.error(JSON.stringify({ event: "request_failed", requestId: c.get("requestId") }));
  return failure(c, "internal_error", "An unexpected error occurred.", 500);
});

export default app;
