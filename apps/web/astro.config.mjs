// @ts-check

import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import {
  rehypeCode,
  remarkCodeTab,
  remarkHeading,
  remarkNpm,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";

/** @type {NonNullable<import('@astrojs/markdown-remark').UnifiedProcessorOptions['remarkPlugins']>} */
const remarkPlugins = [
  remarkHeading,
  remarkCodeTab,
  remarkNpm,
  [remarkStructure, { exportAs: "structuredData" }],
];
const rehypePlugins = [rehypeCode];

export default defineConfig({
  site: "https://nobg.akshit.io",
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins,
      rehypePlugins,
    }),
  },
  integrations: [
    react(),
    mdx({
      extendMarkdownConfig: true,
      syntaxHighlight: false,
    }),
  ],
  vite: {
    resolve: {
      alias: {
        "lucide-react": fileURLToPath(
          new URL("./src/components/fumadocs-icons.ts", import.meta.url),
        ),
      },
    },
    // Apply the icon alias to static HTML as well as hydrated React components.
    environments: {
      ssr: { resolve: { noExternal: ["fumadocs-ui", "@fumadocs/base-ui"] } },
      prerender: { resolve: { noExternal: ["fumadocs-ui", "@fumadocs/base-ui"] } },
    },
    plugins: [tailwindcss()],
  },
});
