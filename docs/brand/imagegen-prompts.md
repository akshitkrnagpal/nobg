# nobg brand images

Generated with the built-in imagegen tool. These are transparent raster PNGs, not vector originals.

- [Icon](../../apps/web/public/brand/nobg-icon-v1.png)
- [Horizontal logo](../../apps/web/public/brand/nobg-logo-v1.png)

The icon depicts a foreground tile separating from its background frame. The logo keeps the lowercase name, with charcoal `no` and teal `bg`. The generated lettering approximates monospaced typography; the website's live wordmark still uses IBM Plex Mono.

## Icon prompt

```text
Use case: logo-brand.
Asset type: standalone square brand icon for nobg, a developer-friendly image background removal service.
Primary request: Design one polished, minimal, distinctive flat brand symbol conveying a foreground cutout separated from its background. A bold charcoal rounded-square outline open at its upper-right corner, with a smaller solid teal rounded tile offset upward and right through that opening, clean transparent separation between the shapes. Optically balanced compact silhouette, consistent confident geometry, subtly softened corners. Readable as a favicon at 24px.
Color palette: only charcoal #18181B and teal #0D9488.
Composition: centered, square canvas, symbol occupies about 80% of canvas, generous even clear margin.
Style: precise flat vector-like brand artwork rendered as high-resolution PNG, crisp edges, professional understated developer-tool identity.
Background: genuinely transparent alpha; the open spaces inside the mark must also be transparent.
Text: none.
Avoid: letters, words, checkerboard drawn into image, white background, gradient, shadow, 3D, glow, sparkles, scissors, magic wands, photographic mockups, presentation board, multiple variants. Output just the single icon.
```

## Logo prompt

The generated icon was supplied as the reference image.

```text
Use case: logo-brand.
Asset type: horizontal logo lockup for nobg, an image background removal service.
Input image 1: reference brand icon. Preserve the supplied icon's design: charcoal open rounded-square frame and separated solid teal tile at the upper right. Use exactly that icon as the symbol in this matching logo.
Primary request: Create a finished horizontal brand logo: the reference icon on the left and the exact word "nobg" on its right. Text must be all lowercase, spelled n-o-b-g, as one unbroken word with no gap between no and bg.
Typography: precise medium-bold monospaced lettering matching IBM Plex Mono Semibold, with a single-storey g. Equal character advances, clean professional developer-tool identity. Set "no" in charcoal #18181B and "bg" in teal #0D9488. The icon uses the same two colors. Wordmark must dominate; icon height roughly 1.15 times the wordmark height, generous clear gap between icon and word.
Composition: centered horizontal lockup on a wide approximately 3:1 canvas, balanced tight usable margins. Flat vector-like precision rendered as high-resolution PNG.
Background: genuinely transparent alpha, including interior spaces. No white rectangle or drawn checkerboard.
Constraints: no tagline, no other text, no capital letters, no gradients, texture, 3D, shadows, glow, mockup, labels, or presentation board. Deliver one logo only.
```

## Final logo refinement

The first generated logo was supplied as the edit target.

```text
Use case: logo-brand.
Edit target: the supplied nobg horizontal logo.
Change only the lettering: replace the heavy rounded lettering with an unmistakably monospaced typewriter-code wordmark matching IBM Plex Mono Semibold. Medium weight, visibly equal character cells and regular measured spacing. Exact text "nobg", all lowercase, one continuous word. The n, o, b, and g must each have the same advance width. Use a single-storey g. "no" remains charcoal #18181B and "bg" remains teal #0D9488.
Keep the reference icon unchanged in design and position, and keep the horizontal icon-plus-wordmark arrangement and transparent background. Make the lettering less bulky, with open counters and crisp flat color. Preserve genuinely transparent alpha, including all holes and surrounding space. No gradients, textures, shadows, extra text, white fill, or mockup. Output one complete horizontal logo with nothing cropped.
```

