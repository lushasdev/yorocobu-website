// @ts-check
import { defineConfig, fontProviders } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

/*
  Fonts are self-hosted from src/assets/fonts/ and served from this origin. The
  files came from Fontsource; the packages are deliberately not dependencies, so
  there is nothing to install and nothing to resolve at build time.

  Astro's local provider generates the @font-face rules, exposes each family as a
  CSS variable, and derives a metric-compatible fallback from the real font metrics
  (optimizedFallbacks, on by default) so nothing shifts when a face lands.

  The signature contrast is serif display against sans body against mono machine
  voice. Body is a sans; it is not the display face at a smaller size.
*/
export default defineConfig({
  site: 'https://yorocobu.org',
  integrations: [react(), sitemap()],

  fonts: [
    {
      // Display and headings. The signature.
      name: 'Instrument Serif',
      cssVariable: '--font-display',
      provider: fontProviders.local(),
      fallbacks: ['Zen Old Mincho', 'Georgia', 'serif'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/instrument-serif-400.woff2'],
            weight: 400,
            style: 'normal',
          },
        ],
      },
    },
    {
      // Body copy. Variable weight axis, with true italics.
      name: 'Instrument Sans',
      cssVariable: '--font-body',
      provider: fontProviders.local(),
      fallbacks: ['Zen Kaku Gothic New', 'system-ui', 'sans-serif'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/instrument-sans-variable.woff2'],
            weight: '400 700',
            style: 'normal',
          },
          {
            src: ['./src/assets/fonts/instrument-sans-variable-italic.woff2'],
            weight: '400 700',
            style: 'italic',
          },
        ],
      },
    },
    {
      // The machine voice: boot lines, metadata, the input, the transcript.
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      provider: fontProviders.local(),
      fallbacks: ['ui-monospace', 'monospace'],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/jetbrains-mono-variable.woff2'],
            weight: '400 700',
            style: 'normal',
          },
        ],
      },
    },
    {
      // Subset to the single glyph the site sets: 喜. 1.8MB down to 1.1KB.
      // It sits in the display stack now, so it comes from the mincho.
      // No fallback chain is generated, because nothing else would carry it.
      name: 'Zen Old Mincho',
      cssVariable: '--font-jp',
      provider: fontProviders.local(),
      fallbacks: [],
      display: 'swap',
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/zen-old-mincho-400-subset.woff2'],
            weight: 400,
            style: 'normal',
          },
        ],
      },
    },
  ],

  build: {
    // One stylesheet rather than a per-page waterfall; the site is two pages.
    inlineStylesheets: 'auto',
  },

  image: {
    // Founder photographs are the only raster content that matters.
    responsiveStyles: true,
  },
})
