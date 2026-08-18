# Yorocobu.org — Content Inventory

Complete extraction of every page, section, copy string, link, and asset in the
repository as of commit `e4a5e6a` (branch `claude/cool-tesla-nqvzr4`, identical to `main`).

This document is the source of truth for the AI navigator's knowledge base. It records
**what the site actually says today**, verbatim. Where the site says nothing, this document
says so explicitly rather than filling the gap — see [Gaps and Unknowns](#gaps-and-unknowns).

Audit date: 2026-08-17

---

## 1. Site-level facts

| Field | Value | Source |
|---|---|---|
| Company name | `yorocobu LLC` (lowercase "y" in all UI copy) | `src/pages/Home.jsx:16`, `README.md:9` |
| Wordmark spelling | `yorocobu` — romanized with a **c**, not "yorokobu" | logo asset `public/images/yweb2.png` |
| Japanese mark | 喜 (kanji, in the logo lockup) | `public/images/yweb1.png`, `yweb2.png` |
| Stated meaning | "To have joy" in Japanese | `README.md:10`, `src/pages/Home.jsx:47` |
| Tagline | "Building apps for underserved markets" | `src/pages/Home.jsx:17`, `README.md:216` |
| Contact email | `yorocobu.llc@gmail.com` | `src/pages/Contact.jsx:48,93,129` |
| Founders | Ethan Gailushas (Co-Founder), Bence Burton (Co-Founder) | `src/pages/Contact.jsx:6-17` |
| Portfolio launch window | Q3 2026 | `src/pages/TechPortfolio.jsx:28-32,91` |
| Copyright line | "Copyright © 2025 yorocobu LLC. All rights reserved." | `README.md:206` |
| Document title | `yorocobu LLC - Building Apps for Underserved Markets` | `index.html:7` |
| Meta description | "yorocobu LLC builds innovative applications for underserved markets using React, Swift, and Flutter." | `index.html:8` |
| Deploy target | Netlify (`dist/`, SPA catch-all redirect) | `netlify.toml` |

---

## 2. Page: Home — route `/`

File: `src/pages/Home.jsx`, styles `src/pages/Home.css`

### 2.1 Hero section

- Asset: `src/assets/images/yweb1.png` rendered inside `.logo-circle`, alt text `yorocobu`
- H1: **`yorocobu LLC`** — rendered in Zen Kaku Gothic New, weight 300, white on gradient (`Home.css:59-66`)
- Tagline (p): **`Building apps for underserved markets`**
- CTA button: label **`View Our Tech Stack`** → `/tech-portfolio`
- Decorative: `.hero-background` gradient, `.hero-scroll-indicator` animated chevron

### 2.2 Mission section

- H2: **`Our Mission`**
- Body: **`Our mission is simple. We find holes in niche markets and build apps to fill them.`**

### 2.3 About Our Name section

- H2: **`About Our Name`**
- Body: **`Yorocobu means "to have joy" in Japanese. Helping people find happiness drives everything we do. That is why we work day and night to make apps that improve quality of life.`**
- Decorative: 4-cell `.decorative-grid` (empty divs, no content)

### 2.4 Call to action section

- H2: **`Ready to Learn More?`**
- Body: **`Discover our technology stack and upcoming portfolio of innovative applications.`**
- Buttons: **`Our Technology`** → `/tech-portfolio`; **`Get In Touch`** → `/contact`

---

## 3. Page: Tech & Portfolio — route `/tech-portfolio`

File: `src/pages/TechPortfolio.jsx`, styles `src/pages/TechPortfolio.css`

### 3.1 Page header

- H1: **`Our Technology`**
- Subtitle: **`Building exceptional apps with industry-leading technologies`**

### 3.2 Tech stack section

- H2: **`Tech Stack`**
- Description: **`We build with industry-leading technologies to deliver exceptional apps across all platforms.`**

**Primary Technologies** (H3: `Primary Technologies`) — five cards, each `{name, emoji icon, description}`:

| Name | Icon | Description |
|---|---|---|
| React | ⚛️ | Building modern web applications |
| React Native | 📱 | Cross-platform mobile apps |
| Swift | 🍎 | Native iOS development |
| SwiftUI | ✨ | Modern iOS interfaces |
| Flutter | 🎯 | Beautiful native apps |

**Also Building With** (H3: `Also Building With`) — twelve badges, name + icon, no descriptions:

JavaScript (`JS`), TypeScript (`TS`), Python (`PY`), Node.js (🟢), Firebase (🔥),
PostgreSQL (🐘), AWS (☁️), Git/GitHub (📦), Figma (🎨), Docker (🐳), REST APIs (🔌), GraphQL (◈)

### 3.3 Portfolio section

- H2: **`Our Work`**
- Status badge: **`Portfolio launching Q3 2026`** (with animated dot)
- Description: **`We're currently developing innovative apps across multiple sectors. Check back soon to see our launches.`**

Five portfolio cards. **Every one is a placeholder.** No app names, no screenshots, no links:

| Card title | Card description | Image |
|---|---|---|
| Email Platform | Coming Q3 2026 | placeholder 📱 "Screenshot Coming Soon" |
| Family History App | Coming Q3 2026 | placeholder 📱 "Screenshot Coming Soon" |
| Mobile Tool | Coming Q3 2026 | placeholder 📱 "Screenshot Coming Soon" |
| Scheduling Program for Institutions | Coming Q3 2026 | placeholder 📱 "Screenshot Coming Soon" |
| Marketplace Tool | Coming Q3 2026 | placeholder 📱 "Screenshot Coming Soon" |

- Closing CTA: **`Interested in our upcoming launches?`** + button **`Get In Touch`** → `/contact`

---

## 4. Page: Contact & Investors — route `/contact`

File: `src/pages/Contact.jsx`, styles `src/pages/Contact.css`

### 4.1 Page header

- H1: **`Partner With Us`**
- Subtitle: **`Let's build something exceptional together`**

### 4.2 Investor section

- Icon: 🚀
- H2: **`Strategic Investment Opportunity`**
- Body: **`We're seeking strategic investors who share our vision of building impactful applications for underserved markets. If you're interested in learning more about our upcoming launches and growth strategy, we'd love to hear from you.`**
- Button: **`Get In Touch`** → `mailto:yorocobu.llc@gmail.com`

### 4.3 Founders section

- H2: **`Our Founders`**
- Description: **`Meet the team behind yorocobu LLC`**
- Cards (name, title, photo only — **no bios, no per-founder links**):
  - **Ethan Gailushas** — Co-Founder — photo `src/assets/images/linkedin2.png`
  - **Bence Burton** — Co-Founder — photo `src/assets/images/linkedin3.png`

### 4.4 Contact section

- H2: **`Get In Touch`**
- Description: **`Have questions or want to learn more? We'd love to hear from you.`**
- Contact item: label **`Email`**, value `yorocobu.llc@gmail.com` → `mailto:`
- **There is no contact form anywhere on the site.** Every contact path is a `mailto:` link.

**Social links** (H3: `Connect With Us`):

| Name | Icon | URL | State |
|---|---|---|---|
| LinkedIn | 💼 | `https://linkedin.com/company/yorocobu` | live |
| Instagram | 📷 | `https://www.instagram.com/yorocobu/` | live |
| GitHub | 📦 | `#` | **placeholder — click is `preventDefault()`-ed, renders badge "Coming Soon"** |

- Closing CTA box: H3 **`Ready to Start a Conversation?`**, body **`Whether you're an investor, partner, or potential client, we're excited to connect and explore opportunities together.`**, button **`Send Us a Message`** → `mailto:yorocobu.llc@gmail.com`

---

## 5. Navigation

File: `src/components/Navigation.jsx`

- Logo → `/`, image `public/images/yweb2.png`, alt `yorocobu Logo`
- Links: **`Home`** → `/`, **`Tech & Portfolio`** → `/tech-portfolio`, **`Contact`** → `/contact`
- Sticky, adds `.scrolled` class past 20px scroll
- Mobile: hamburger button (`aria-label="Toggle menu"`) toggling a slide-down panel with the same three links

**Total link surface of the entire site:** 3 internal routes, 3 `mailto:` links to the same
address, 2 live external social links, 1 dead placeholder link. That is everything.

---

## 6. Assets

| File | Dimensions | Size | Used by | Notes |
|---|---|---|---|---|
| `public/images/yweb1.png` | 1200×1200 | 23 KB | favicon (`index.html:5`) | Stylized 喜 glyph mark, pure black on white, no transparency |
| `public/images/yweb2.png` | 1200×240 | 16 KB | nav logo | Wordmark lockup: `yorocobu` + 喜, thin geometric sans |
| `src/assets/images/yweb1.png` | 1200×1200 | 23 KB | Home hero | **Duplicate** of the public copy |
| `src/assets/images/linkedin2.png` | 1465×1026 | **840 KB** | Ethan Gailushas headshot | Badly oversized for display use |
| `src/assets/images/linkedin3.png` | 2252×2252 | **1638 KB** | Bence Burton headshot | Badly oversized; 2.5 MB of headshots ship on the contact page |

`public/images/.gitkeep` and `src/assets/images/.gitkeep` are empty placeholders.

---

## 7. Technical stack (as built)

- **Framework:** React 18.3.1 + React DOM 18.3.1
- **Router:** react-router-dom 6.26.0, `BrowserRouter`, three client-side routes
- **Build:** Vite 5.4.2 with `@vitejs/plugin-react`; default config, no customization
- **Styling:** Plain CSS, one file per component/page, CSS custom properties in `src/index.css`. No Tailwind, no CSS-in-JS, no preprocessor.
- **Fonts:** Google Fonts via two `@import` statements in `src/index.css` — Inter (300–800) and Zen Kaku Gothic New (300–900). Zen Kaku is used on exactly one element (the hero H1).
- **Current palette** (`src/index.css:13-45`): `--primary #1e40af`, `--primary-dark #1e3a8a`, `--primary-light #3b82f6`, `--accent #06b6d4`, `--accent-light #22d3ee`, `--text-primary #0f172a`, `--text-secondary #475569`, `--text-light #64748b`, `--bg-primary #ffffff`, `--bg-secondary #f8fafc`, `--bg-dark #0f172a`, `--border #e2e8f0`, plus spacing/radius/shadow scales.
- **Hosting:** Netlify. `netlify.toml` sets base `.`, command `npm install && npm run build`, publish `dist`, and a `/* → /index.html` 200 rewrite for SPA routing.
- **Netlify Functions:** **none exist.** No `netlify/functions/` directory, no `[functions]` block in `netlify.toml`.
- **Tests / linting / CI:** none. No test runner, no ESLint config, no `.github/workflows/`.
- **Baseline build output:** `index.html` 0.64 KB, CSS 18.7 KB (4.0 KB gzip), JS 175 KB (56 KB gzip), plus 2.56 MB of images. Build time ~1.2s.

---

## 8. Things the site does NOT have

Recorded explicitly so the AI navigator can refuse rather than invent:

- **No named products.** The five portfolio entries are generic category placeholders. The names "Rico", "YOUThrive", and "smart-resume" **do not appear anywhere in this repository** (verified by full-text grep).
- **No shipped apps.** Every portfolio item reads "Coming Q3 2026". Nothing is described as released, in beta, or downloadable.
- **No client work described.** No client names, no case studies, no testimonials, no logos.
- **No pricing.** No rates, no packages, no "starting at" figures, no engagement models.
- **No services menu.** The site never offers to build an app for a third party. The only inbound pitch is to *investors*.
- **No timelines beyond "Q3 2026"** — no dates, no milestones, no roadmap.
- **No founder bios.** Names and titles only. No background, no prior companies, no education, no individual social links.
- **No company history**, no founding date, no location, no headcount, no legal address.
- **No blog, no changelog, no press, no careers page.**
- **No contact form** — `mailto:` only.
- **No newsletter signup.**
- **No privacy policy, terms, or cookie notice.**
- **No GitHub presence linked** — the GitHub social card is a dead `#` placeholder.
- **No analytics** of any kind (no GA, no Plausible, no Netlify Analytics snippet).
- **No `robots.txt`, no `sitemap.xml`, no Open Graph or Twitter Card tags, no canonical URL, no structured data.**

---

## 9. Gaps and Unknowns

Items the knowledge base needs from Ethan before the AI navigator can answer confidently:

1. **The five real product names and what each does.** The brief names Rico (AI scheduling), YOUThrive, and smart-resume; the site names none of them. Which placeholder maps to which product, and what are the other two?
2. **Which products are shipped vs. in development.** The brief says YOUThrive is shipped; the site says everything is Q3 2026. These contradict.
3. **Whether Yorocobu takes client work.** The brief's suggested prompt "can you build an app for my org" implies yes; the site never says so and pitches investors only.
4. **Founder bios** — anything beyond name and title.
5. **Live app links** for anything shipped.
6. **Company basics**: founding year, location, entity details worth publishing.
7. **Live-site verification.** `yorocobu.org` is blocked by this environment's network egress proxy, so I could not confirm the deployed site matches this repo, nor check its current `robots.txt`, indexed pages, or inbound links. Everything above is derived from source.
