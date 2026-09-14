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
  The copy, in one place.

  English only for now — Unit A ships before the locale dictionary exists. It is
  collected here rather than inlined in the component so that Phase 2 is a move
  rather than a hunt, and so the strings are already shaped as a dictionary: flat
  keys, no sentences assembled from fragments, nothing that assumes English word
  order.
*/
export const GATE_COPY = {
  ask: 'One thing before anything else. Are you here to watch Ethan’s documentary?',
  yes: 'Yes',
  no: 'No, I am just looking',
  language: 'Which language would you like to watch in?',
  languageAgain: 'Happy to. Which language would you like to watch in?',
  en: 'English',
  ja: '日本語',
  /*
    The confirmation keeps the link visible as text. A popup blocker that eats
    the new tab would otherwise leave the visitor with nothing at all, having
    just told the site exactly what they came for.
  */
  opened: 'Opening 忘れ者 now. If your browser held the tab back, the link is here.',
  dismiss: 'Never mind',
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

/** Remembered across visits, not just this session. */
export const GATE_STORAGE_KEY = 'yorocobu:documentary-gate'

export function gateAlreadyShown() {
  try {
    return window.localStorage.getItem(GATE_STORAGE_KEY) === '1'
  } catch {
    // Private mode. The gate asks again next visit, which is a better failure
    // than never asking.
    return false
  }
}

export function rememberGateShown() {
  try {
    window.localStorage.setItem(GATE_STORAGE_KEY, '1')
  } catch {
    /* private mode; see above */
  }
}
