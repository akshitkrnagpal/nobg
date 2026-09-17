# nobg

[Website](https://nobg.akshit.io) · [Documentation](https://nobg.akshit.io/docs/) · [API health](https://api.nobg.akshit.io/api/health)

Background removal in your own Cloudflare account. Send an image to a Hono API and receive a transparent PNG or WebP, using the Cloudflare Images binding.

## Workspace

- `apps/web`: Astro + Fumadocs landing page and documentation, scaffolded with `pnpm create fumadocs-app --template astro`.
- `apps/api`: Hono Cloudflare Worker, public endpoint with persistent IP quotas.
- `packages/contracts`: shared formats, limits, and error types.

Node.js 22.14+ and pnpm 11 are required.

```sh
pnpm install
pnpm dev
```

Website: http://localhost:4321. API: http://localhost:8787.

## Verify locally

```sh
pnpm check
pnpm build
```

Tests use mocked Images responses in the Workers runtime. The API build is a Wrangler dry run. **Background removal against the paid Cloudflare service has not been validated.** The offline Images implementation cannot perform segmentation; local uploads may return `502 processing_failed`. No fallback pretends to remove the background.

## Deploy the website

```sh
pnpm run deploy
```

This builds and publishes **only the static website** as `nobg`. It does not deploy the API or enable paid image processing. The website has no live upload interface.

## Self-host the API

Enable the required Cloudflare Images access in your account first. Review current [Images pricing](https://developers.cloudflare.com/images/pricing/). Remove or replace the `api.nobg.akshit.io` route in `apps/api/wrangler.jsonc` with your own hostname, then follow [the deployment guide](apps/web/content/docs/quickstart.mdx).

```sh
pnpm --filter @nobg/api run deploy
```

No API key or account is needed. Wrangler creates SQLite-backed Durable Objects for the quota counters. Calls use the API Worker's URL, not the website URL:

```sh
curl --fail-with-body \
  https://YOUR-WORKER.workers.dev/api/v1/remove-background \
  -F "image=@photo.jpg" \
  --output nobg.png
```

Default limits: 10 MiB per file, 25 megapixels, 5 requests per UTC minute and 20 validated image attempts per UTC day per IP. A shared cap allows up to 10,000 processing attempts per UTC calendar month. Processing failures count. Every `429` includes `Retry-After`. Quotas persist across restarts and deployments; variables in `apps/api/wrangler.jsonc` configure the limits.

The monthly cap bounds image attempts, not Workers or Durable Objects charges. People behind the same IP share allowances. Counters store usage and expiry times under hashed-IP object names; uploads and results are not stored by the application. Cloudflare still processes the image bytes.

## Documentation

Documentation lives in `apps/web/content/docs`. Start with [quickstart](apps/web/content/docs/quickstart.mdx), [API reference](apps/web/content/docs/api.mdx), and [configuration](apps/web/content/docs/configuration.mdx).

The public API includes `GET /api/health` for liveness and `GET /api/openapi.json` for the API contract. The project has its own API; it does not implement remove.bg compatibility.

## Brand

Always spell the name **nobg**. The wordmark uses charcoal `#18181B` for `no` and teal `#0D9488` for `bg`. The homepage's comparison is an original SVG illustration, not a result produced by the service.

Generated transparent PNG assets: [icon](apps/web/public/brand/nobg-icon-v1.png) and [horizontal logo](apps/web/public/brand/nobg-logo-v1.png). The [generation prompts](docs/brand/imagegen-prompts.md) record the design direction and tool used.
