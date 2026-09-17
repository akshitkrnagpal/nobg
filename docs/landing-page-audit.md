# Landing page audit

Reviewed and updated on 2026-09-17. Scope: homepage structure, messaging, responsive layout, accessibility, and navigation into the documentation.

## Findings and changes

| Finding | Change |
| --- | --- |
| The homepage used a custom header instead of Fumadocs HomeLayout. | Added the actual `fumadocs-ui/layouts/home` component, with its search trigger, navigation, and mobile menu. Shared the Astro provider and wordmark with the docs. |
| The hero described ownership vaguely before explaining the service. | Lead with background removal, accepted output formats, and deployment into the user's Cloudflare account. Link directly to requirements and costs. |
| Much of the supporting text was 8–12px. | Increased body copy to 14–18px, enlarged navigation and action targets, and made captions easier to read. |
| White button text on the original teal failed normal-text contrast. | Kept the teal brand color, but used darker `#0F766E` for button fills and smaller accent text. Adjusted the Fumadocs muted-text token to suit the custom background. |
| The page repeated ownership claims across several sections. | Replaced the repeated feature section with concrete input, output, file limits, and storage information. Reduced spacing between sections. |
| The decorative preview label could obscure the illustration. | Removed the floating label and made the illustration disclaimer readable below the comparison. |
| Slider instructions only mentioned dragging. | Added keyboard instructions, full 0–100% comparison, and a descriptive changing accessible value. |
| Copy feedback was visual only. | Added a live status announcement and a text-selection fallback when clipboard access is unavailable. |
| The curl example's long placeholder URL required unnecessary scrolling. | Use `NOBG_URL`, explain both environment variables, and retain keyboard access to horizontal code scrolling on small screens. |

## Verification

- Lint, Astro typecheck, and static production build passed.
- Inspected desktop and mobile screenshots of the new layout.
- No horizontal overflow at 320, 390, 768, and 1440px viewport widths.
- The built site contains one main landmark and uses the genuine Fumadocs HomeLayout.
- Verified mobile menu, homepage search, search-result navigation to a docs anchor, keyboard comparison, and copy feedback in the production preview.
- axe-core 4.13.0 reported no WCAG 2 A/AA or WCAG 2.1 AA violations at 390px and 1440px. This is an automated check, not a claim of complete accessibility conformance.

The hero remains an illustration rather than evidence of processed-image quality. The image API was not modified, deployed, or tested against paid Cloudflare processing during this audit.

## Copy and icon follow-up

- Removed eyebrow labels, uppercase promotional text, repeated slogans, decorative status dots, and the technology strip.
- Replaced promotional headings with descriptions of the API, setup, request format, and limits. Simplified the closing section.
- Replaced interface symbols with Phosphor icons, including Fumadocs navigation, search, headings, and code controls. The Vite alias applies during prerendering and hydration so both render the same icons.
- Scoped custom focus outlines to landing-page controls and footer links. Fumadocs search now retains its native input styling.
- Verified mobile navigation, search-result navigation, keyboard comparison, and copy feedback. The page has no horizontal overflow at 320, 390, and 1440px. axe-core reported no WCAG 2 A/AA or WCAG 2.1 AA violations at 390px and 1440px.
- Lint, Astro typecheck, and production build passed. No API deployment or paid image processing was performed.
