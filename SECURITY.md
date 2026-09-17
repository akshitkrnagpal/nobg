# Security

Security fixes target the latest code on `main`. When self-hosting, keep your deployment and dependencies up to date.

## Report a vulnerability

Use GitHub's [private vulnerability reporting form](https://github.com/akshitkrnagpal/nobg/security/advisories/new) when it is available. If the form is unavailable, open an issue asking for a private reporting channel without including vulnerability details.

Include the affected commit or version, reproduction steps, expected impact, and a minimal example. Use test images and remove tokens, account identifiers, and personal data from reports.

Please do not publish exploit details in an issue or pull request before a fix is available. Test against your own deployment rather than consuming the public demo's quota or disrupting other users.

## Service boundaries

The API is public and does not require authentication. IP quotas limit requests and processing attempts; they do not guarantee a total Cloudflare spending cap. CORS controls which browser origins can read responses, not who can call the API.

Cloudflare Images processes uploads. nobg does not store image uploads or results, but it stores quota counters and expiry times in Durable Objects. See the [architecture](https://nobg.akshit.io/docs/architecture/) and [operations guide](https://nobg.akshit.io/docs/operations/) for details.
