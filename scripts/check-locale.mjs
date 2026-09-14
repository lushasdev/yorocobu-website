#!/usr/bin/env node
/**
 * Language detection and switching.
 *
 * Two halves, because they run in different places.
 *
 * The edge function is exercised directly here with synthetic requests. It only
 * ever runs on Netlify, so `astro preview` cannot show it working, and the
 * alternative to this is finding out after a deploy that Japanese visitors are
 * being stranded on English. Every branch of the ordering rule gets a case,
 * including the ones that must NOT redirect — those are the dangerous half.
 *
 * The browser half needs a built and previewed site:
 *
 *   npm run build && npm run preview &
 *   node scripts/check-locale.mjs
 *
 * Not in `npm run check`: the edge half needs no server, but the browser half
 * does, and a check that sometimes needs a server stops being run.
 */

import { chromium } from 'playwright'
import handler from '../netlify/edge-functions/locale.js'
import { ui } from '../src/i18n/ui.ts'

const BASE = process.env.GATE_BASE_URL ?? 'http://localhost:4321'

const results = []
const check = (name, pass, detail = '') => results.push({ name, pass, detail })

// ── The edge function's decision, branch by branch ──────────────────────────

/** Drive the handler with a synthetic request and a stub downstream response. */
async function decide(path, { acceptLanguage, cookie } = {}) {
  const headers = {}
  if (acceptLanguage) headers['accept-language'] = acceptLanguage
  if (cookie) headers.cookie = cookie
  const request = new Request(`https://yorocobu.org${path}`, { headers })
  const context = {
    next: async () => new Response('<!doctype html>served', { headers: { 'content-type': 'text/html' } }),
  }
  const response = await handler(request, context)
  return {
    status: response.status,
    location: response.headers.get('location'),
    vary: response.headers.get('vary'),
  }
}

console.log('\n  edge detection')

{
  // 1. English browser on / — served, never redirected.
  const r = await decide('/', { acceptLanguage: 'en-US,en;q=0.9' })
  check('an English browser on / is served English', r.status === 200 && !r.location, JSON.stringify(r))

  // 2. Japanese browser on / — redirected to /ja/, temporarily.
  const ja = await decide('/', { acceptLanguage: 'ja,en-US;q=0.9,en;q=0.8' })
  check('a Japanese browser on / goes to /ja/', ja.status === 302 && ja.location === '/ja/', JSON.stringify(ja))
  check('the redirect is a 302, never a 301', ja.status === 302, `status=${ja.status}`)

  // ja-JP and other subtags are still Japanese.
  const jaJP = await decide('/', { acceptLanguage: 'ja-JP' })
  check('ja-JP counts as Japanese', jaJP.location === '/ja/', JSON.stringify(jaJP))

  /*
    The case that matters most and is easiest to get wrong: Japanese present but
    NOT the top preference. This browser asked for English and listed Japanese
    as a fallback, so redirecting would override a stated preference.
  */
  const secondary = await decide('/', { acceptLanguage: 'en-US,en;q=0.9,ja;q=0.8' })
  check(
    'Japanese as a fallback preference does not redirect',
    secondary.status === 200 && !secondary.location,
    JSON.stringify(secondary)
  )

  // Weights out of order still resolve to the highest.
  const weighted = await decide('/', { acceptLanguage: 'en;q=0.7,ja;q=0.9' })
  check('the highest weight wins regardless of order', weighted.location === '/ja/', JSON.stringify(weighted))

  // 3. A deliberately opened /ja/ URL is never redirected away from, whatever
  //    the browser says. A shared link has to survive being opened.
  const direct = await decide('/ja/', { acceptLanguage: 'en-US,en;q=0.9' })
  check(
    'a direct /ja/ link from an English browser stays Japanese',
    direct.status === 200 && !direct.location,
    JSON.stringify(direct)
  )

  // 4. The cookie outranks the browser, in both directions.
  const chose = await decide('/', { acceptLanguage: 'ja', cookie: 'yorocobu_lang=en' })
  check(
    'choosing English beats a Japanese browser',
    chose.status === 200 && !chose.location,
    JSON.stringify(chose)
  )
  const choseJa = await decide('/', { acceptLanguage: 'en-US', cookie: 'yorocobu_lang=ja' })
  check(
    'choosing Japanese beats an English browser',
    choseJa.location === '/ja/',
    JSON.stringify(choseJa)
  )

  // A cookie among others, and a junk cookie value.
  const messy = await decide('/', { acceptLanguage: 'en', cookie: 'a=1; yorocobu_lang=ja; b=2' })
  check('the cookie is found among others', messy.location === '/ja/', JSON.stringify(messy))
  const junk = await decide('/', { acceptLanguage: 'ja', cookie: 'yorocobu_lang=klingon' })
  check('an unknown cookie value falls through to the browser', junk.location === '/ja/', JSON.stringify(junk))

  // 5. Vary, on both the redirect and the served response.
  check('a served response varies on language and cookie', r.vary === 'Accept-Language, Cookie', `vary=${r.vary}`)
  check('a redirect varies on language and cookie', ja.vary === 'Accept-Language, Cookie', `vary=${ja.vary}`)

  // No header at all, and a malformed one.
  const none = await decide('/')
  check('a request with no Accept-Language gets English', none.status === 200, JSON.stringify(none))
  const broken = await decide('/', { acceptLanguage: ';;;q=' })
  check('a malformed Accept-Language gets English', broken.status === 200, JSON.stringify(broken))

  // The deep path keeps its path across the redirect.
  const deep = await decide('/full-index', { acceptLanguage: 'ja' })
  check('the path is preserved across the redirect', deep.location === '/ja/full-index', JSON.stringify(deep))
}

// ── The rendered Japanese tree, and the switcher ────────────────────────────

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

console.log('\n  the Japanese tree')
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/ja/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1900)

  const lang = await page.getAttribute('html', 'lang')
  check('the Japanese tree declares lang="ja"', lang === 'ja', `lang=${lang}`)

  const intro = await page.textContent('.intro__claim')
  check('the introduction is Japanese', intro === ui.ja['console.introClaim'], intro ?? '')

  const hint = await page.textContent('.bar__hint')
  check('the input hint is Japanese', hint?.trim() === ui.ja['console.placeholder'], hint ?? '')

  // The honest limitation, on the Japanese tree only.
  const notice = await page.textContent('.bar__notice').catch(() => null)
  check(
    'the Japanese tree says Joy answers in English',
    notice?.trim() === ui.ja['console.englishOnlyNotice'],
    notice ?? 'no notice'
  )

  // The chips are the site map and have to be Japanese too.
  const chips = await page.locator('.suggestions .chip').allTextContents()
  check(
    'the site-map chips are Japanese',
    chips.length > 0 && chips.every((c) => /[ぁ-んァ-ン一-龯]/.test(c)),
    chips.join(' | ')
  )

  // The gate, by title rather than as "Ethan's documentary".
  const gate = await page.textContent('.gate').catch(() => null)
  check('the gate asks in Japanese, by title', /忘れ者/.test(gate ?? ''), (gate ?? '').slice(0, 50))

  await context.close()
}

console.log('\n  the English tree is untouched')
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1900)

  const lang = await page.getAttribute('html', 'lang')
  check('the English tree declares lang="en"', lang === 'en', `lang=${lang}`)

  const intro = await page.textContent('.intro__claim')
  check('the English introduction is unchanged', intro === ui.en['console.introClaim'], intro ?? '')

  // No notice on the English tree: an English visitor has nothing to be told.
  const notice = await page.locator('.bar__notice').count()
  check('the English tree carries no language notice', notice === 0, `${notice} notice(s)`)
  await context.close()
}

console.log('\n  switching')
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1900)

  const visible = await page.locator('[data-lang-switch]').isVisible()
  check('the switcher is visible without scrolling', visible)

  // It points at the same page on the other tree, not at the home page.
  await page.goto(`${BASE}/full-index`, { waitUntil: 'networkidle' })
  const jaHref = await page.getAttribute('[data-lang-switch] a[data-lang="ja"]', 'href')
  check('switching preserves the current path', jaHref === '/ja/full-index', `href=${jaHref}`)

  // Clicking it sets the cookie the edge function reads.
  await page.goto(`${BASE}/ja/`, { waitUntil: 'networkidle' })
  await page.click('[data-lang-switch] a[data-lang="en"]')
  await page.waitForLoadState('networkidle')
  const cookies = await context.cookies()
  const stored = cookies.find((c) => c.name === 'yorocobu_lang')
  check('choosing a language sets the cookie', stored?.value === 'en', JSON.stringify(stored ?? null))

  // A year, so the choice survives.
  const aYear = stored ? stored.expires - Date.now() / 1000 > 60 * 60 * 24 * 300 : false
  check('the cookie lasts about a year', aYear, `expires=${stored?.expires}`)

  await context.close()
}

console.log('\n  metadata')
{
  const context = await browser.newContext()
  const page = await context.newPage()
  for (const [path, self, other] of [
    ['/', 'https://yorocobu.org/', 'https://yorocobu.org/ja/'],
    ['/ja/', 'https://yorocobu.org/ja/', 'https://yorocobu.org/'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    const hreflangs = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
      Object.fromEntries(links.map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]))
    )
    check(
      `${path} names both trees in hreflang`,
      hreflangs.en && hreflangs.ja && hreflangs['x-default'] === 'https://yorocobu.org/',
      JSON.stringify(hreflangs)
    )
    check(
      `${path} points hreflang at the right counterpart`,
      hreflangs[path === '/' ? 'ja' : 'en'] === other,
      JSON.stringify(hreflangs)
    )
    const og = await page.getAttribute('meta[property="og:locale"]', 'content')
    check(`${path} declares its og:locale`, og === (path === '/' ? 'en_US' : 'ja_JP'), `og:locale=${og}`)
  }
  await context.close()
}

await browser.close()

let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  — ${r.detail}`}`)
}
console.log(`\n  ${results.length - failed}/${results.length} passed\n`)
process.exit(failed ? 1 : 0)
