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

  /*
    Two real URL trees, not a client-side string swap.

    English serves from /, Japanese from /ja/. That makes the Japanese site
    linkable, shareable and indexable, and it means a Japanese visitor never
    sees a frame of English before the swap lands — the page arrives in the
    language it is going to stay in.

    prefixDefaultLocale: false keeps every existing English URL exactly where it
    is. Inbound links to / and /full-index do not move.

    No redirectToDefaultLocale and no manual routing: detection belongs at the
    edge, before the page is served, where it can read Accept-Language and the
    cookie. See netlify/edge-functions/locale.js.
  */
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    routing: { prefixDefaultLocale: false },
  },

  integrations: [
    react(),
    /*
      i18n here is what puts both trees in the sitemap with reciprocal
      hreflang, rather than listing the English pages and leaving the Japanese
      ones undiscoverable.
    */
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', ja: 'ja' },
      },
    }),
  ],

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
    /*
      Inlined, not linked. At ~22KB across two pages the transfer cost is
      trivial, and it removes the render-blocking stylesheet request entirely —
      which is what was queueing behind 63KB of preloaded fonts and holding up
      first paint.
    */
    inlineStylesheets: 'always',
  },

  image: {
    // Founder photographs are the only raster content that matters.
    responsiveStyles: true,
  },
})
