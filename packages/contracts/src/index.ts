export const outputFormats = { png: "image/png", webp: "image/webp" } as const;
export type OutputFormat = keyof typeof outputFormats;
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;
export const errorCodes = [
  "not_configured",
  "rate_limited",
  "daily_limit_reached",
  "monthly_limit_reached",
  "invalid_request",
  "invalid_image",
  "unsupported_format",
  "payload_too_large",
  "processing_failed",
  "not_found",
  "internal_error",
] as const;
export type ErrorCode = (typeof errorCodes)[number];
export type ApiError = { error: { code: ErrorCode; message: string; requestId: string } };
