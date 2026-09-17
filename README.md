# nobg

[Website](https://nobg.akntech.workers.dev) · [Documentation](https://nobg.akntech.workers.dev/docs/)

Background removal in your own Cloudflare account. Send an image to a Hono API and receive a transparent PNG or WebP, using the Cloudflare Images binding.

## Workspace

- `apps/web`: Astro + Fumadocs landing page and documentation, scaffolded with `pnpm create fumadocs-app --template astro`.
- `apps/api`: Hono Cloudflare Worker, authenticated with a Bearer API key.
- `packages/contracts`: shared formats, limits, and error types.

Node.js 22.14+ and pnpm 11 are required.

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Replace the placeholder with a random API key of at least 32 characters.
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

## Self-host the API later

Enable the required Cloudflare Images access in your account first. Review current [Images pricing](https://developers.cloudflare.com/images/pricing/). Then follow [the deployment guide](apps/web/content/docs/quickstart.mdx).

```sh
pnpm --filter @nobg/api run deploy
pnpm --filter @nobg/api exec wrangler secret put API_KEY
```

Keep API keys in secrets, never frontend code. The endpoint fails closed until a valid key is configured. Calls use the API Worker's URL, not the website URL:

```sh
curl --fail-with-body \
  https://YOUR-WORKER.workers.dev/api/v1/remove-background \
  -H "Authorization: Bearer $NOBG_API_KEY" \
  -F "image=@photo.jpg" \
  --output nobg.png
```

Default limits: 10 MiB per file, 25 megapixels, and 30 authenticated attempts per minute per Cloudflare location. Rate limiting is approximate and is not a global spending cap. Images pass through the API without application storage. Cloudflare still processes the image bytes.

## Documentation

Documentation lives in `apps/web/content/docs`. Start with [quickstart](apps/web/content/docs/quickstart.mdx), [API reference](apps/web/content/docs/api.mdx), and [configuration](apps/web/content/docs/configuration.mdx).

The public API includes `GET /api/health` for liveness and `GET /api/openapi.json` for the API contract. The project has its own API; it does not implement remove.bg compatibility.

## Brand

Always spell the name **nobg**. The wordmark uses charcoal `#18181B` for `no` and teal `#0D9488` for `bg`. The homepage's comparison is an original SVG illustration, not a result produced by the service.
