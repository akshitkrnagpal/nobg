import { DEFAULT_MAX_UPLOAD_BYTES, errorCodes, MAX_IMAGE_PIXELS } from "@nobg/contracts";

const errorResponse = (description: string) => ({
  description,
  headers: { "X-Request-Id": { schema: { type: "string" } } },
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "nobg API",
    version: "0.1.0",
    description:
      "Background removal in your own Cloudflare account. Cloudflare Images access is required. Production image processing is not yet validated.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        operationId: "health",
        summary: "Liveness check; does not call Images",
        responses: {
          "200": {
            description: "Worker is responding",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "service", "version"],
                  properties: {
                    status: { const: "ok" },
                    service: { const: "nobg" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/openapi.json": {
      get: {
        operationId: "openapi",
        summary: "Get the OpenAPI description",
        responses: {
          "200": {
            description: "OpenAPI 3.1 document",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/api/v1/remove-background": {
      post: {
        operationId: "removeBackground",
        summary: "Remove an image background",
        description: `Upload JPEG, PNG, or WebP. Default file limit: ${DEFAULT_MAX_UPLOAD_BYTES} bytes. Pixel limit: ${MAX_IMAGE_PIXELS}. Animated inputs are output as still images. Only image and format fields are accepted; duplicate fields are rejected.`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["image"],
                properties: {
                  image: {
                    type: "string",
                    format: "binary",
                    description: "JPEG, PNG, or WebP file",
                  },
                  format: { type: "string", enum: ["png", "webp"], default: "png" },
                },
              },
              encoding: { image: { contentType: "image/jpeg, image/png, image/webp" } },
            },
          },
        },
        responses: {
          "200": {
            description: "Image with a transparent background",
            headers: {
              "Content-Disposition": { schema: { type: "string" } },
              "X-Request-Id": { schema: { type: "string" } },
              "Cache-Control": { schema: { const: "no-store" } },
            },
            content: {
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/webp": { schema: { type: "string", format: "binary" } },
            },
          },
          "400": errorResponse("Invalid request or undecodable image"),
          "401": errorResponse("Missing or invalid API key"),
          "413": errorResponse("File, request body, or pixel count exceeds limit"),
          "415": errorResponse("Unsupported format or mismatched MIME type"),
          "429": {
            ...errorResponse("Rate limited"),
            headers: {
              "Retry-After": { schema: { type: "string", const: "60" } },
              "X-Request-Id": { schema: { type: "string" } },
            },
          },
          "500": errorResponse("Unexpected failure"),
          "502": errorResponse("Image processing failed"),
          "503": errorResponse("Service is not configured"),
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string", enum: errorCodes },
              message: { type: "string" },
              requestId: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
  },
} as const;
