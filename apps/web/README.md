# nobg website

Astro + Fumadocs, created with `pnpm create fumadocs-app --template astro`.

From the workspace root:

- `pnpm --filter @nobg/web dev` starts the site on localhost:4321.
- `pnpm --filter @nobg/web build` generates static files in `apps/web/dist`.
- `pnpm run deploy` publishes only this site to Cloudflare as `nobg`.

Edit `content/docs` for documentation and `src/pages/index.astro` for the homepage.
The site has no image processing credentials or live upload interface.
