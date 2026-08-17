import { chromium } from 'playwright'

const BASE = 'http://localhost:4321'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
}

// ── prefers-reduced-motion: no sequence at all, resolved state immediately ──
{
  const ctx = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'commit' })
  await p.waitForTimeout(120)
  const s = await p.evaluate(() => ({
    booting: document.documentElement.dataset.booting ?? null,
    bootVisible: getComputedStyle(document.querySelector('[data-boot]')).display,
  }))
  check('reduced-motion skips the boot entirely', s.booting === null && s.bootVisible === 'none', JSON.stringify(s))
  await ctx.close()
}

// ── once per session ────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'commit' })
  await p.waitForTimeout(1800)
  await p.goto(`${BASE}/full-index`, { waitUntil: 'commit' })
  await p.goto(BASE, { waitUntil: 'commit' })
  await p.waitForTimeout(120)
  const second = await p.evaluate(() => document.documentElement.dataset.booting ?? null)
  check('boot runs once per session', second === null, `second visit booting=${second}`)
  await ctx.close()
}

// ── skippable on any input ──────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'commit' })
  await p.waitForTimeout(250)
  await p.keyboard.press('Space')
  await p.waitForTimeout(80)
  const after = await p.evaluate(() => document.documentElement.dataset.booting ?? null)
  check('keypress skips straight to resolved', after === null, `booting=${after}`)
  await ctx.close()
}

// ── keyboard: "/" focuses, arrows move suggestions, Esc clears ──────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1800)
  await p.click('body', { position: { x: 40, y: 400 } })
  await p.waitForTimeout(100)
  await p.keyboard.press('/')
  const focused = await p.evaluate(() => document.activeElement?.id)
  check('"/" focuses the console', focused === 'console-input', `activeElement=${focused}`)

  await p.keyboard.press('ArrowDown')
  const v1 = await p.inputValue('#console-input')
  await p.keyboard.press('ArrowDown')
  const v2 = await p.inputValue('#console-input')
  check('arrow keys walk the suggestions', Boolean(v1) && v1 !== v2, `${v1} -> ${v2}`)

  await p.keyboard.press('Escape')
  const cleared = await p.inputValue('#console-input')
  check('Esc clears the input', cleared === '', `value="${cleared}"`)

  // Cmd/Ctrl+K
  await p.click('body', { position: { x: 40, y: 400 } })
  await p.keyboard.press('Control+k')
  const focused2 = await p.evaluate(() => document.activeElement?.id)
  check('Ctrl+K focuses the console', focused2 === 'console-input', `activeElement=${focused2}`)
  await ctx.close()
}

// ── live region + focus order ───────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1800)
  const live = await p.getAttribute('.answer', 'aria-live')
  check('answers land in an aria-live region', live === 'polite', `aria-live=${live}`)

  await p.fill('#console-input', 'who is behind this')
  await p.press('#console-input', 'Enter')
  await p.waitForTimeout(1600)
  const focus = await p.evaluate(() => document.documentElement.dataset.focus)
  const regionShown = await p.evaluate(
    () => getComputedStyle(document.querySelector('#region-founders')).display
  )
  check('the answer surfaces its content region', focus === 'founders' && regionShown === 'block', `focus=${focus} display=${regionShown}`)

  const railCount = await p.locator('.rail li').count()
  check('the transcript rail records the question', railCount === 1, `rail items=${railCount}`)
  await ctx.close()
}

// ── refusals ────────────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1800)
  const cases = [
    ['how much does an app cost', /not published pricing|not going to invent/i],
    ['when does the marketplace tool launch', /no launch dates|in development/i],
    ['who are your clients', /does not publish client names/i],
    ['what does the marketplace tool do', /in development|without guessing/i],
    ['what is ethan gailushas background', /no bios are published|nothing further/i],
  ]
  for (const [q, expected] of cases) {
    await p.fill('#console-input', q)
    await p.press('#console-input', 'Enter')
    await p.waitForTimeout(1500)
    const text = await p.textContent('.answer__text')
    check(`refuses: "${q}"`, expected.test(text ?? ''), (text ?? '').slice(0, 70))
  }
  await ctx.close()
}

await b.close()

let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  — ${r.detail}`}`)
}
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
