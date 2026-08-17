// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://yorocobu.org',
  integrations: [react(), sitemap()],
  build: {
    // One stylesheet rather than a per-page waterfall; the site is two pages.
    inlineStylesheets: 'auto',
  },
  image: {
    // Founder photographs are the only raster content that matters.
    responsiveStyles: true,
  },
})
