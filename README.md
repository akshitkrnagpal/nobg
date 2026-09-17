<p align="center">
  <a href="https://nobg.akshit.io">
    <img src="apps/web/public/brand/nobg-logo-v1.png" alt="nobg" width="240" />
  </a>
</p>

<p align="center">
  Remove image backgrounds in your browser, through an API, or in your own Cloudflare account.
</p>

<p align="center">
  <a href="https://nobg.akshit.io"><strong>Try nobg</strong></a> ·
  <a href="https://nobg.akshit.io/docs/quickstart/">Self-host</a> ·
  <a href="https://nobg.akshit.io/docs/api/">API docs</a>
</p>

Upload a photo, remove the background, and download a transparent PNG. No account or API key needed.

nobg also gives you a small background removal API you can deploy as a single Cloudflare Worker. Use the hosted service to get started, or run it in your own account with your own domain and usage limits.

## Try it with a photo

Open **[nobg.akshit.io](https://nobg.akshit.io)**, choose an image, and click **Remove background**. Preview the result before downloading it.

- Accepts JPEG, PNG, and WebP, up to 10 MiB and 25 megapixels.
- Downloads a transparent PNG. The API also supports WebP output.
- No uploads or results saved by nobg. Cloudflare Images processes the image.
- Free hosted usage with limits per IP, no sign-up required.

The hosted service allows 20 image attempts a day and 5 requests a minute per IP. People on the same network share that allowance. There is also a shared limit of 10,000 image attempts a month. Processing failures count toward the image limits.

## One request from your app

Send a photo and save the response as an image:

```sh
curl --fail-with-body \
  https://api.nobg.akshit.io/api/v1/remove-background \
  -F "image=@photo.jpg" \
  --output nobg.png
```

The public API uses the same free allowance as the browser demo. It returns image bytes directly. Add `-F "format=webp"` to request WebP instead.

See the [API reference](https://nobg.akshit.io/docs/api/) for formats and errors, or the [JavaScript and Python examples](https://nobg.akshit.io/docs/examples/) to integrate it. Browser integrations need an allowed origin; the guide covers that too.

## Run it in your own Cloudflare account

Deploy the API Worker, connect your domain, and set the limits that suit your app. Background removal uses Cloudflare Images, and Durable Objects keep usage counters across deployments. You do not need to manage a server, a GPU, or an image storage bucket.

**[Follow the deployment guide →](https://nobg.akshit.io/docs/quickstart/)**

You will need a Cloudflare account with access to Images transformations and foreground segmentation, Workers, and SQLite-backed Durable Objects. Cloudflare bills your account for these services. Read the [requirements and costs](https://nobg.akshit.io/docs/costs/) before deploying.

nobg has its own API. If you are moving from remove.bg, update your integration to use the endpoint and fields above. Cloudflare Images handles the processing, so results may differ.

## Built with

[Hono](https://hono.dev/) on Cloudflare Workers for the API, Cloudflare Images for background removal, and Durable Objects for IP quotas. The website and docs use [Astro](https://astro.build/) and [Fumadocs](https://www.fumadocs.dev/).

<details>
<summary>Develop locally</summary>

Requires Node.js 22.14+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

The website runs at `http://localhost:4321` and the API at `http://localhost:8787`.

| Directory | Contents |
| --- | --- |
| `apps/web` | Landing page, upload demo, and documentation |
| `apps/api` | Hono Worker and persistent usage quotas |
| `packages/contracts` | Shared formats, limits, and error types |

Run `pnpm check` and `pnpm build` to check the project. Tests use mocked Images responses. Paid background removal, output quality, and production processing latency have not been validated for this release. Local Images emulation cannot remove backgrounds.

See the [local development guide](https://nobg.akshit.io/docs/local-development/) for browser demo configuration and the [deployment guide](https://nobg.akshit.io/docs/quickstart/) to publish the API. The root `pnpm run deploy` command publishes only the website.

</details>
