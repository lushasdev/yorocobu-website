/**
 * The documentary gate.
 *
 * Joy's first message after calibration hands off: whether the visitor came to
 * watch Ethan's documentary, and if so which language they want to watch in.
 *
 * Two rules shape everything here.
 *
 * The film's language is NOT the site's language. Someone reading in English may
 * well want the Japanese version, and the reverse, so the second question is
 * always asked and never preselected from the locale. When Phase 2 moves the
 * copy below into the locale dictionary, that separation has to survive: the
 * dictionary supplies the words, never the answer.
 *
 * Both links or no gate. A gate offering one working choice and one dead one is
 * worse than no gate at all, so a missing or malformed URL removes the whole
 * feature rather than half of it.
 */

/*
  The gate's copy now lives in src/i18n/ui.ts with everything else. The keys are
  listed here so the component does not spell them out inline, and so the two
  questions stay visibly separate: `gate.ask` is about whether they came for the
  film, `gate.language` is about which cut they want. Nothing derives the second
  from the site locale.
*/
export const GATE_KEYS = {
  ask: 'gate.ask',
  yes: 'gate.yes',
  no: 'gate.no',
  language: 'gate.language',
  languageAgain: 'gate.languageAgain',
  en: 'gate.filmEnglish',
  ja: 'gate.filmJapanese',
  opened: 'gate.opened',
  dismiss: 'gate.dismiss',
}

/** A link we are willing to render. Anything else means the gate does not exist. */
function watchable(value) {
  const url = String(value ?? '').trim()
  if (!url) return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // http(s) only: a javascript: or data: URL from a mistyped environment
  // variable must never reach an href.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return url
}

/**
 * Resolve the two film URLs from build-time configuration.
 *
 * @param {{DOC_URL_EN?: string, DOC_URL_JA?: string}} source
 * @returns {{en: string, ja: string} | null} null when the gate must not render
 */
export function documentaryUrls(source = {}) {
  const en = watchable(source.DOC_URL_EN)
  const ja = watchable(source.DOC_URL_JA)
  if (!en || !ja) {
    if (source.DOC_URL_EN || source.DOC_URL_JA) {
      // Half-configured is a mistake someone made, not a state to serve
      // quietly. A missing pair is a deliberate opt-out and says nothing.
      console.warn(
        'documentary: DOC_URL_EN and DOC_URL_JA must BOTH be set to valid http(s) ' +
          'URLs. The gate will not render. Netlify reads these at build time, so a ' +
          'fresh deploy is needed after adding them.'
      )
    }
    return null
  }
  return { en, ja }
}

/*
  Remembered for the session, not for the browser.

  sessionStorage rather than localStorage, so the gate returns on a new visit
  and stays away within one. Asked once per arrival is the right frequency for
  a question about what someone came for: a visitor who said no last week may
  well be back for the film today, and localStorage meant they would never be
  asked again on that machine.

  It also matches the boot sequence, which keeps `yorocobu:booted` in
  sessionStorage for the same reason. The gate opens as Joy's first message
  after calibration hands off, so the two now have the same lifetime — one
  arrival shows both, and a return visit shows both again.
*/
export const GATE_STORAGE_KEY = 'yorocobu:documentary-gate'

export function gateAlreadyShown() {
  try {
    return window.sessionStorage.getItem(GATE_STORAGE_KEY) === '1'
  } catch {
    // Private mode. The gate asks again, which is a better failure than never
    // asking at all.
    return false
  }
}

export function rememberGateShown() {
  try {
    window.sessionStorage.setItem(GATE_STORAGE_KEY, '1')
  } catch {
    /* private mode; see above */
  }
}
