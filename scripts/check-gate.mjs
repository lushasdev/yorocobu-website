#!/usr/bin/env node
/**
 * The documentary gate, driven in a real browser.
 *
 * The gate is the one thing on this site a visitor sees before they have asked
 * for anything, and it is the only path to the film for someone who arrived for
 * the film. Every branch of it is checked here: both language choices, the
 * decline, the Escape dismissal, the keyboard focus, persistence across a
 * reload, and the recovery path for someone who dismissed it and then changed
 * their mind.
 *
 * Needs a built and previewed site:
 *
 *   npm run build && npm run preview &
 *   node scripts/check-gate.mjs
 *
 * Not wired into `npm run check`, which is meant to run without a server.
 */
import { chromium } from 'playwright'

const BASE = process.env.GATE_BASE_URL ?? 'http://localhost:4321'
const DOC_EN = '6ZI0kq5tlZ8'
const DOC_JA = '511YVD2iPmE'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const results = []
const check = (name, pass, detail = '') => results.push({ name, pass, detail })

/** A fresh visitor: no storage, boot sequence run to completion, gate showing. */
async function arrive({ reducedMotion, tree = '/' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(reducedMotion ? { reducedMotion: 'reduce' } : {}),
  })
  /*
    The film host is stubbed. What is under test is the link this site emits and
    the tab it opens, not YouTube's availability — and a test that needs the
    public internet fails for reasons that have nothing to do with the gate.
  */
  await context.route('**://*.youtu.be/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>film</title>' })
  )
  await context.route('**://youtu.be/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>film</title>' })
  )

  const page = await context.newPage()
  await page.goto(`${BASE}${tree}`, { waitUntil: 'networkidle' })
  // The gate opens only once calibration hands off, so wait for it rather than
  // for a fixed delay.
  await page.waitForSelector('.gate', { timeout: 6000 }).catch(() => {})
  return { context, page }
}

const gateText = (page) => page.textContent('.gate').catch(() => null)

// ── it appears at all, after the boot sequence, inside the console ──────────
{
  const { context, page } = await arrive()
  const text = await gateText(page)
  check('the gate appears on arrival', /Are you here to watch/i.test(text ?? ''), text ?? 'no .gate')

  // Inside the console, not a dialog over the page.
  const inConsole = await page.evaluate(
    () => Boolean(document.querySelector('.console .gate')) && !document.querySelector('dialog')
  )
  check('the gate is inside the console, not a modal', inConsole)

  // Focus is already on the first choice: operable without touching the mouse.
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('focus lands on the first choice', focused === 'Yes', `activeElement="${focused}"`)
  await context.close()
}

// ── yes -> English ──────────────────────────────────────────────────────────
{
  const { context, page } = await arrive()
  await page.click('.gate button:has-text("Yes")')
  await page.waitForSelector('.gate a:has-text("English")')

  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('focus moves to the first language choice', focused === 'English', `activeElement="${focused}"`)

  const link = page.locator('.gate a:has-text("English")')
  const [href, target, rel] = await Promise.all([
    link.getAttribute('href'),
    link.getAttribute('target'),
    link.getAttribute('rel'),
  ])
  check('yes -> English points at the English film', href?.includes(DOC_EN), `href=${href}`)
  check('the English choice opens a new tab safely', target === '_blank' && rel === 'noopener noreferrer', `target=${target} rel=${rel}`)
  check('no share-tracking parameter on the link', !href?.includes('si='), `href=${href}`)

  // Click it and confirm Joy keeps the URL visible as text.
  const opened = context.waitForEvent('page')
  await link.click()
  const tab = await opened
  check('the English film opens in a new tab', tab.url().includes(DOC_EN), tab.url())
  await page.waitForSelector('.gate__link')
  const shown = await page.textContent('.gate__link')
  check('the link stays visible as text after opening', shown?.includes(DOC_EN), shown ?? '')
  await context.close()
}

// ── yes -> 日本語 ────────────────────────────────────────────────────────────
{
  const { context, page } = await arrive()
  await page.click('.gate button:has-text("Yes")')
  const link = page.locator('.gate a:has-text("日本語")')
  const href = await link.getAttribute('href')
  check('yes -> 日本語 points at the Japanese film', href?.includes(DOC_JA), `href=${href}`)

  const opened = context.waitForEvent('page')
  await link.click()
  const tab = await opened
  check('the Japanese film opens in a new tab', tab.url().includes(DOC_JA), tab.url())
  await context.close()
}

// ── the film language is never preselected from the site language ───────────
{
  const { context, page } = await arrive()
  await page.click('.gate button:has-text("Yes")')
  const choices = await page.locator('.gate a').count()
  check('both film languages are always offered', choices === 2, `${choices} language choice(s)`)
  await context.close()
}

// ── no -> the normal greeting, gate gone ────────────────────────────────────
{
  const { context, page } = await arrive()
  await page.click('.gate button:has-text("No, I am just looking")')
  await page.waitForTimeout(150)
  const stillThere = await page.locator('.gate').count()
  const greeting = await page.textContent('.intro__body')
  check('no -> the gate goes away', stillThere === 0, `${stillThere} gate(s) left`)
  check('no -> the normal greeting is intact', /This is Joy/i.test(greeting ?? ''), greeting ?? '')
  await context.close()
}

// ── Escape dismisses into the normal greeting ───────────────────────────────
{
  const { context, page } = await arrive()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const stillThere = await page.locator('.gate').count()
  check('Escape dismisses the gate', stillThere === 0, `${stillThere} gate(s) left`)
  const greeting = await page.textContent('.intro__body')
  check('Escape leaves the normal greeting', /This is Joy/i.test(greeting ?? ''), greeting ?? '')
  await context.close()
}

// ── the whole gate is reachable by keyboard alone ───────────────────────────
{
  const { context, page } = await arrive()
  // Focus is already on "Yes"; Enter should advance, then Tab to 日本語.
  await page.keyboard.press('Enter')
  await page.waitForSelector('.gate a:has-text("English")')
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
  check('keyboard reaches the second language choice', focused === '日本語', `activeElement="${focused}"`)
  await context.close()
}

// ── it does not come back on a later visit ──────────────────────────────────
{
  const { context, page } = await arrive()
  await page.click('.gate button:has-text("No, I am just looking")')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1900)
  const afterReload = await page.locator('.gate').count()
  check('the gate does not reappear on reload', afterReload === 0, `${afterReload} gate(s)`)

  const stored = await page.evaluate(() => localStorage.getItem('yorocobu:documentary-gate'))
  check('the gate records that it was shown', stored === '1', `localStorage=${stored}`)
  await context.close()
}

// ── typing a question instead of answering also counts as shown ─────────────
{
  const { context, page } = await arrive()
  await page.fill('#console-input', 'who runs it')
  await page.press('#console-input', 'Enter')
  await page.waitForTimeout(1800)
  const stored = await page.evaluate(() => localStorage.getItem('yorocobu:documentary-gate'))
  check('ignoring the gate still counts as shown', stored === '1', `localStorage=${stored}`)
  await context.close()
}

// ── recovery: asking about the film reaches the same choice ─────────────────
{
  const { context, page } = await arrive()
  await page.keyboard.press('Escape') // dismiss it first, as a real visitor might
  await page.waitForTimeout(150)
  await page.fill('#console-input', 'where can i watch the documentary')
  await page.press('#console-input', 'Enter')
  await page.waitForSelector('.answer .gate', { timeout: 8000 }).catch(() => {})

  const recovered = await page.locator('.answer .gate').count()
  check('asking about the film brings the choice back', recovered === 1, `${recovered} gate(s) under the answer`)

  const hrefs = await page.locator('.answer .gate a').evaluateAll((as) => as.map((a) => a.href))
  check(
    'recovery offers both films',
    hrefs.some((h) => h.includes(DOC_EN)) && hrefs.some((h) => h.includes(DOC_JA)),
    hrefs.join(' ')
  )

  // The recovery path skips the "are you here for it" question — they just said so.
  const text = await page.textContent('.answer .gate')
  check('recovery goes straight to the language choice', !/Are you here to watch/i.test(text ?? ''), (text ?? '').slice(0, 60))
  await context.close()
}

// ── reduced motion: no boot sequence, gate still arrives ────────────────────
{
  const { context, page } = await arrive({ reducedMotion: true })
  const text = await gateText(page)
  check('the gate still appears under reduced motion', /Are you here to watch/i.test(text ?? ''), text ?? 'no .gate')
  await context.close()
}

/*
  All four gate paths, on BOTH language trees: eight in total.

  The film language is asked independently of the site language, so every
  combination has to work — an English reader wanting the Japanese cut is not an
  edge case, it is half the reason the second question exists.
*/
console.log('')
for (const [tree, label, yes, no] of [
  ['/', 'en', 'Yes', 'No, I am just looking'],
  ['/ja/', 'ja', 'はい', 'いいえ、見て回っているだけです'],
]) {
  for (const [film, expect] of [
    ['English', DOC_EN],
    ['日本語', DOC_JA],
  ]) {
    const { context, page } = await arrive({ tree })
    await page.click(`.gate button:has-text("${yes}")`)
    const link = page.locator(`.gate a:has-text("${film}")`)
    const opened = context.waitForEvent('page')
    await link.click()
    const tab = await opened
    check(`${label} site -> ${film} film`, tab.url().includes(expect), tab.url())
    await context.close()
  }

  // And the decline, on each tree, landing in that tree's own greeting.
  const { context, page } = await arrive({ tree })
  await page.click(`.gate button:has-text("${no}")`)
  await page.waitForTimeout(150)
  const gone = (await page.locator('.gate').count()) === 0
  const greeting = await page.textContent('.intro__body')
  check(`${label} site -> no -> the ${label} greeting`, gone && Boolean(greeting?.trim()), greeting ?? '')
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
