# nobg website

The Astro and Fumadocs website includes the upload demo, landing page, and documentation.

Run commands from the workspace root:

- `pnpm --filter @nobg/web dev` starts the site at `http://localhost:4321`.
- `pnpm --filter @nobg/web build` generates static files in `apps/web/dist`.
- `pnpm run deploy` publishes the site to Cloudflare as `nobg`.

The demo calls `https://api.nobg.akshit.io` by default. Copy `.env.example` to `.env` to point it at the local API, and copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` to allow the local browser origin. Local Images emulation cannot remove backgrounds.

For another API, set `PUBLIC_API_URL` before starting or building the site and add the website origin to the API's `ALLOWED_ORIGINS`. API requests go directly from the visitor's browser so the API sees their IP for quotas.

Edit `content/docs` for documentation, `src/components/landing.tsx` and `src/pages/index.astro` for the homepage, and `src/components/upload-demo.tsx` for the demo.

When deploying your own copy, update `site` in `astro.config.mjs` and remove or replace the custom domain in `wrangler.jsonc`.
