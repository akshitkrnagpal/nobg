# Contributing to nobg

Bug reports, documentation fixes, and pull requests are welcome. For a larger change, open an issue first so we can agree on the scope.

## Get started

Fork the repository and clone your fork. Use Node.js 24, or another supported version from the root `package.json`, and the pinned pnpm version.

```sh
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
pnpm dev
```

The website runs at `http://localhost:4321` and the API at `http://localhost:8787`. The example environment files point the browser demo at the local API. Local Cloudflare Images emulation cannot remove backgrounds. Use mocked image responses to test the demo without paid processing.

## Make a change

- Edit the API in `apps/api`, the website in `apps/web`, and shared API types in `packages/contracts`.
- Update the docs in `apps/web/content/docs` when you change behavior or configuration.
- Add or update tests for API behavior changes, especially validation and quotas.
- Keep the name `nobg` lowercase and use Phosphor for interface icons.

Run these checks locally before submitting:

```sh
pnpm format
pnpm check
pnpm build
```

`pnpm check` runs formatting checks, type checks, and tests. `pnpm build` builds the website and bundles the API without deploying it. Tests mock Images responses; they do not call the paid service. This repository does not run CI.

Open a pull request explaining the problem, what changed, and which checks you ran. Include a screenshot for visible UI changes. Do not commit credentials, private images, local environment files, or changes to the hosted service's domain configuration for your own deployment.

For deployment, follow the [self-hosting guide](https://nobg.akshit.io/docs/quickstart/). The root `pnpm run deploy` command publishes the website; it is not a local check.

Report vulnerabilities through the process in [SECURITY.md](SECURITY.md).

## License

Contributions are accepted under the project's [Apache-2.0 license](LICENSE).
