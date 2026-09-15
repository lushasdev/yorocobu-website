/**
 * Language detection, at the edge, before the page is served.
 *
 * This runs on every request to a non-prefixed path and decides whether the
 * visitor should be looking at the Japanese tree instead. Doing it here rather
 * than in the browser is what avoids a frame of English before Japanese
 * arrives: the redirect happens before any HTML is sent.
 *
 * WHAT THIS ACTUALLY DETECTS, stated plainly because it is easy to forget:
 * a browser configured for Japanese. Not a Japanese person, not someone in
 * Japan, not someone who reads Japanese. Plenty of Japanese speakers run
 * English-locale machines — including, routinely, people who grew up in Japan
 * and bought their laptop abroad. This is a reasonable default and nothing
 * more. The EN / 日本語 switcher is what actually carries the feature, which is
 * why it sits in the fixed chrome and never hides.
 *
 * Deliberately NOT doing IP geolocation. Where a request comes from is a worse
 * signal than what the browser asks for, it breaks for anyone travelling or on
 * a VPN, and it would send a Japanese-speaking visitor in North Carolina to the
 * English tree while sending an English speaker on holiday in Osaka to the
 * Japanese one.
 */

const LOCALES = ['en', 'ja']
const DEFAULT_LOCALE = 'en'
const COOKIE = 'yorocobu_lang'

/** The path's own locale prefix, if it has one. */
function prefixedLocale(pathname) {
  const first = pathname.split('/').filter(Boolean)[0]
  return LOCALES.includes(first) && first !== DEFAULT_LOCALE ? first : null
}

/**
 * The visitor's top language preference.
 *
 * Accept-Language is an ordered, weighted list. Only the HIGHEST-weighted tag
 * counts: someone whose browser says `en-US,ja;q=0.8` has asked for English and
 * listed Japanese as a fallback, and sending them to the Japanese tree would be
 * overriding a preference they actually expressed.
 */
function topLanguage(header) {
  if (!header) return null
  const best = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      const weight = q ? Number.parseFloat(q.split('=')[1]) : 1
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 }
    })
    .filter(({ tag }) => tag && tag !== '*')
    .sort((a, b) => b.weight - a.weight)[0]

  // The primary subtag is what matters: ja, ja-JP and ja-Hrkt are all Japanese.
  return best ? best.tag.split('-')[0] : null
}

function readCookie(header, name) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export default async (request, context) => {
  const url = new URL(request.url)
  const { pathname } = url

  /*
    Everything below only ever decides between serving the requested page and
    redirecting to its counterpart. It never rewrites a response body, so a
    failure here degrades to the English tree rather than to a broken page.
  */
  const response = await context.next()

  /*
    Vary first, and on the response we are actually returning.

    Without it a CDN can hand one visitor's language to the next visitor who
    asks for the same URL — the single most common way a setup like this breaks,
    and one that only shows up under real traffic. It belongs on the
    non-redirect response too, because that response is also language-dependent.
  */
  response.headers.set('Vary', 'Accept-Language, Cookie')

  // 1. A URL someone deliberately opened is served as asked. Always.
  //    Never redirect away from an explicit /ja/ link, whatever the browser
  //    or the cookie says — a shared link has to survive being opened.
  if (prefixedLocale(pathname)) return response

  const cookie = readCookie(request.headers.get('cookie'), COOKIE)

  // 2. A manual choice outranks the browser setting, permanently.
  if (cookie && LOCALES.includes(cookie)) {
    if (cookie === DEFAULT_LOCALE) return response
    return redirect(url, cookie, response)
  }

  // 3. Otherwise, the browser's top preference. Anything not Japanese gets
  //    English, which is also what an absent or unparseable header gets.
  if (topLanguage(request.headers.get('accept-language')) === 'ja') {
    return redirect(url, 'ja', response)
  }

  return response
}

/**
 * 302, never 301.
 *
 * A 301 is cached by the browser permanently and survives clearing the cookie,
 * so a visitor who redirected once to /ja/ and then chose English would be sent
 * back to Japanese by their own cache, with nothing on the site able to undo
 * it. This decision depends on a header and a cookie that both change; it is
 * temporary by definition.
 */
function redirect(url, locale, source) {
  const target = new URL(url)
  target.pathname = `/${locale}${url.pathname}`.replace(/\/{2,}/g, '/')
  return new Response(null, {
    status: 302,
    headers: {
      location: target.pathname + target.search,
      'cache-control': 'no-store',
      vary: source.headers.get('Vary') ?? 'Accept-Language, Cookie',
    },
  })
}

export const config = {
  /*
    Only the document routes. Assets, the API functions and the sitemap must
    never be redirected — a language redirect on /api/joy would break the
    console, and one on /_astro/* would break the page it is trying to help.
  */
  path: ['/', '/full-index'],
}
