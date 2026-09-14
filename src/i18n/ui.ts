/**
 * Every string a visitor can see, in both languages.
 *
 * The English side is moved verbatim from the components it used to live in, so
 * this file is a relocation rather than a rewrite — the English site reads
 * exactly as it did. The Japanese side is written natively: where a natural
 * Japanese sentence is built differently from the English one, it is built
 * differently, because a translated-sounding site is worse than a plain one.
 *
 * Conventions in the Japanese, applied throughout:
 *   - です・ます. Joy is composed and helpful, neither casual nor stiff keigo.
 *   - "Yorocobu" stays in Latin script. Never ヨロコブ, never 喜ぶ in body copy.
 *     The 喜ぶ etymology appears only where the site is explaining the name.
 *   - "Joy" stays "Joy". Never 喜び — that is the etymology, not her name.
 *   - A real Japanese word beats a katakana transliteration wherever one exists.
 *
 * Anything marked // REVIEW is a line I am not confident in and Ethan should
 * read. They are collected in the phase report rather than only marked here.
 *
 * Keys are flat and named for what they are, never assembled from fragments:
 * a sentence built by concatenation in one language is a sentence that cannot
 * be written naturally in the other.
 */

export const locales = ['en', 'ja'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

/** What each language calls itself, which is the only correct way to label it. */
export const localeNames: Record<Locale, string> = {
  en: 'EN',
  ja: '日本語',
}

/** The lang attribute and hreflang value for each tree. */
export const htmlLang: Record<Locale, string> = {
  en: 'en',
  ja: 'ja',
}

/** og:locale wants the territory form, unlike hreflang. */
export const ogLocale: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
}

const en = {
  // ── Layout and chrome ────────────────────────────────────────────────────
  'skip.toContent': 'Skip to content',
  'theme.toggle': 'Switch between light and dark',
  'theme.light': 'light',
  'theme.dark': 'dark',
  'lang.label': 'Change language',
  'lang.toEnglish': 'EN',
  'lang.toJapanese': '日本語',

  // ── Boot sequence ────────────────────────────────────────────────────────
  'boot.title': 'Yorocobu',
  'boot.skip': 'Press any key to skip',
  'boot.label.knowledgeBase': 'knowledge base',
  'boot.label.portfolio': 'portfolio',
  'boot.label.clientWork': 'client work',
  'boot.label.stack': 'stack',
  'boot.label.founders': 'founders',
  'boot.label.navigator': 'navigator',
  'boot.value.indexed': 'indexed',
  'boot.value.online': 'online',
  'boot.value.open': 'open',
  'boot.value.active': 'active',
  'boot.value.available': 'available',
  // {count} is substituted, never concatenated: the number sits in a different
  // place in the two languages.
  'boot.value.inDevelopment': '{count} in development',
  'boot.value.technologies': '{count} technologies',
  'boot.value.count': '{count}',

  // ── The console ──────────────────────────────────────────────────────────
  'console.placeholder': 'ask Joy for anything on this site',
  'console.hintEngaged': 'ask another',
  'console.inputLabel': 'Ask about Yorocobu',
  'console.submit': 'Ask',
  'console.railLabel': 'Your questions',
  'console.chipsLabel': 'Everything on this site',
  'console.introStatus': 'JOY // NAVIGATOR // ready',
  'console.introClaim': 'This is the future of websites.',
  'console.introProof': 'No menus. No hunting. Just a guide.',
  'console.introBody': 'This is Joy. She can help you find anything here.',
  'console.defaultQuery': 'what is yorocobu',
  'console.degraded': 'answering from the offline index',
  'console.degradedConfig': 'answering from the offline index — navigator not configured',
  'console.degradedRun': 'navigator unreachable — {count} answers from the local index',

  /*
    The honest limitation, shown only on the Japanese tree until Joy answers in
    Japanese. Saying this plainly is better than the alternative the audit
    found, which was Joy answering every Japanese question confidently and
    wrongly from the About the Name entry.
  */
  'console.englishOnlyNotice': '',

  // ── Compose ──────────────────────────────────────────────────────────────
  'compose.sent': 'Sent.',
  'compose.recorded': 'Recorded.',
  'compose.sentReplying': 'Ethan will reply to the address you gave.',
  'compose.sentNoAddress':
    'No address in there, so this one is a note for Ethan rather than a reply to you.',
  'compose.recordedReplying':
    'It is in the queue Ethan reads, and he will reply to the address you gave.',
  'compose.recordedNoAddress':
    'It is in the queue Ethan reads. There is no address in it, so treat it as a note rather than a conversation.',
  'compose.close': 'close',
  'compose.neverMind': 'never mind',
  'compose.next': 'Next',
  'compose.thinking': 'One moment',
  'compose.draftLabel': 'Your message, edit anything',
  'compose.send': 'Send it',
  'compose.sending': 'Sending',
  'compose.genericError': 'that did not go through',
  'compose.errorSuffix': 'The address is on the full index if you would rather write directly.',

  // ── Compose without the model ────────────────────────────────────────────
  'composeFallback.who': 'Who am I passing this to Ethan from?',
  'composeFallback.what': 'And what are you working on?',
  'composeFallback.reply': 'Where should he reply?',
  'composeFallback.ackFirst': 'Happy to pass a message along.',
  'composeFallback.ackNext': 'Got it.',
  'composeFallback.draftIntro': 'Here is what I have. Edit anything, then send it.',
  'composeFallback.draftWho': 'I am {who}',
  'composeFallback.draftReply': 'You can reach me at {reply}',

  // ── Action labels ────────────────────────────────────────────────────────
  'action.sendMessage': 'Send a message',
  'action.openIndex': 'Open the full index',
  'action.sendQuestion': 'Send a question',
  'action.askDirectly': 'Ask directly',
  'action.askAboutProject': 'Ask about a project',
  'action.askToBeKeptPosted': 'Ask to be kept posted',
  'action.askAboutClientWork': 'Ask about client work',
  'action.askAboutIt': 'Ask about it',
  'action.sendTheQuestion': 'Send the question',
  'action.sendQuestionToEthan': 'Send the question to Ethan',

  // ── The offline navigator's refusals ─────────────────────────────────────
  'guard.founderPrivate':
    'The site publishes short bios for Ethan Gailushas and Bence Burton and stops there. Nothing about where either of them is, how to reach them personally, or what they are doing outside Yorocobu is public. I can pass a question along instead.',
  'guard.companyMetrics':
    'That part is not public. The site does not publish funding, revenue, user numbers, or headcount beyond the two founders, and there is no office to visit — the work is remote. What it does say is that Yorocobu was filed in Wyoming in 2025, operates from Chapel Hill, and what it is building.',
  'guard.pricing':
    'Yorocobu has not published pricing, and I am not going to invent a number. What I can tell you is that it does take on client work, and what a project costs is a conversation with Ethan and Bence.',
  'guard.timeline':
    'No launch dates are public. What the site does say is that five projects are in development, and Yorocobu is happy to hear from anyone who wants to know when that changes.',
  'guard.clients':
    'Yorocobu does not publish client names or case studies, so I have nothing to point you to there. It does take on client work, and that conversation starts with an email.',

  // ── The offline navigator's generated answers ────────────────────────────
  'navigator.founders': 'Yorocobu was founded by two Co-Founders. {bios}',
  'navigator.portfolio':
    'Five projects are in development: {titles}. Those are the categories Yorocobu publishes; the product names and descriptions are not public yet.',
  'navigator.projectRefusal':
    '{title} is in development. The site publishes the category and nothing more, so I cannot tell you what it does without guessing, and I would rather not.',
  'navigator.nothingShipped': 'Nothing has shipped yet. Five projects are in development: {titles}.',
  'navigator.unknown':
    'I do not have that one. I can tell you about {offers}, or I can send your question to Ethan.',
  // How a list is punctuated. Separate keys because Japanese does not use "and".
  'navigator.listSeparator': ', ',
  'navigator.listFinal': ', and ',
  'navigator.offerSeparator': ' or ',

  // ── How each entry is described when offered as a next step ──────────────
  'offer.company': 'what Yorocobu builds',
  'offer.name': 'where the name comes from',
  'offer.founders': 'who is behind it',
  'offer.stack': 'the technology it builds with',
  'offer.portfolio': 'the five projects in development',
  'offer.services': 'working together',
  'offer.contact': 'how to get in touch',
  'offer.documentary': 'the documentary',
  'offer.joy': 'what I am',

  // ── Followup chips: questions phrased as a visitor would type them ───────
  'ask.company': 'what do you build',
  'ask.name': 'what does the name mean',
  'ask.founders': 'who is behind this',
  'ask.stack': 'what do you build with',
  'ask.portfolio': 'what kind of apps do you make',
  'ask.services': 'do you take clients',
  'ask.contact': 'how do i get in touch',
  'ask.documentary': 'where can i watch the documentary',
  'ask.joy': 'what are you',
  'ask.inDevelopment': 'what is in development',
  'ask.buildForMyOrg': 'can you build an app for my org',


  // ── The site map: the six chips, by entry id ─────────────────────────────
  'nav.portfolio': 'what we build',
  'nav.founders': 'who runs it',
  'nav.stack': 'the tech',
  'nav.services': 'working together',
  'nav.name': 'the name',
  'nav.contact': 'get in touch',

  // ── Home page ────────────────────────────────────────────────────────────
  'home.title': 'Yorocobu — apps for underserved markets',
  'home.description':
    'Yorocobu LLC finds holes in niche markets and builds apps to fill them. Five projects in development, built with React, Swift, and Flutter. Ask the navigator, or read the full index.',
  'home.heading': 'Yorocobu — apps for underserved markets',
  'home.fullIndexLink': 'full index',

  // ── Full index ───────────────────────────────────────────────────────────
  'index.title': 'Full index — Yorocobu',
  'index.description':
    'Everything Yorocobu publishes, on one page: the mission, the name, the founders, the technology, the five projects in development, client work, and how to get in touch.',
  'index.kicker': 'full index',
  'index.heading': 'Everything on this site',
  'index.lede':
    'The navigator on the home page answers from exactly these {count} entries and nothing else. This is the same material, laid out to read.',
  'index.contentsLabel': 'Contents',
  'index.updated': 'updated {date}',
  'index.direct':
    'Joy can send a message from any page. If you would rather write directly, the address is',
  'index.back': 'back to the navigator',

  // ── The documentary gate ─────────────────────────────────────────────────
  'gate.ask': 'One thing before anything else. Are you here to watch Ethan’s documentary?',
  'gate.yes': 'Yes',
  'gate.no': 'No, I am just looking',
  'gate.language': 'Which language would you like to watch in?',
  'gate.languageAgain': 'Happy to. Which language would you like to watch in?',
  'gate.filmEnglish': 'English',
  'gate.filmJapanese': '日本語',
  'gate.opened': 'Opening 忘れ者 now. If your browser held the tab back, the link is here.',
  'gate.dismiss': 'Never mind',

  // ── Errors that reach the visitor ────────────────────────────────────────
  'error.questionRequired': 'question is required',
  'error.questionTooLong': 'question is too long',
  'error.badEmail': 'that email address does not look right',
  'error.rateLimited': 'a few too many just now. Try again a little later.',
  'error.methodNotAllowed': 'method not allowed',
  'error.expectedJson': 'expected json',
  'error.navigatorUnreachable': 'navigator unreachable',
  'error.navigatorNotConfigured': 'navigator not configured',
  'error.streamFailed': 'stream failed',
} as const

export type UIKey = keyof typeof en

/*
  Typed as a complete record of the English keys, so a missing Japanese string is
  a type error in an editor and a hard failure in scripts/check-i18n.mjs. The
  build does not run tsc, so the script is what actually enforces it.
*/
const ja: Record<UIKey, string> = {
  // ── Layout and chrome ────────────────────────────────────────────────────
  'skip.toContent': '本文へスキップ',
  'theme.toggle': '明るい表示と暗い表示を切り替える',
  'theme.light': 'ライト',
  'theme.dark': 'ダーク',
  'lang.label': '表示言語を変更する',
  'lang.toEnglish': 'EN',
  'lang.toJapanese': '日本語',

  // ── Boot sequence ────────────────────────────────────────────────────────
  'boot.title': 'Yorocobu',
  'boot.skip': 'キーを押すとスキップします',
  'boot.label.knowledgeBase': '知識ベース',
  'boot.label.portfolio': '開発中の案件',
  'boot.label.clientWork': '受託',
  'boot.label.stack': '技術',
  'boot.label.founders': '創業者',
  'boot.label.navigator': 'ナビゲーター',
  'boot.value.indexed': '読み込み済み',
  'boot.value.online': '稼働中',
  'boot.value.open': '受付中',
  'boot.value.active': '進行中',
  'boot.value.available': '公開中',
  'boot.value.inDevelopment': '{count}件 開発中',
  'boot.value.technologies': '{count}種類',
  'boot.value.count': '{count}名',

  // ── The console ──────────────────────────────────────────────────────────
  'console.placeholder': 'このサイトのことなら Joy に何でも聞いてください',
  'console.hintEngaged': '続けて質問できます',
  'console.inputLabel': 'Yorocobu について質問する',
  'console.submit': '質問する',
  'console.railLabel': 'これまでの質問',
  'console.chipsLabel': 'このサイトにあるもの',
  'console.introStatus': 'JOY // NAVIGATOR // ready',
  // REVIEW — the English is a flat claim; this keeps that flatness rather than
  // softening it into 「新しいかたち」, which would read as marketing.
  'console.introClaim': 'これが、これからのウェブサイトです。',
  'console.introProof': 'メニューも、探し回る手間もありません。案内役がひとりいるだけです。',
  'console.introBody': 'Joy です。このサイトの中のことなら、何でもお探しします。',
  'console.defaultQuery': 'Yorocobu とは',
  'console.degraded': 'オフラインの索引から回答しています',
  'console.degradedConfig': 'オフラインの索引から回答しています — ナビゲーターが未設定です',
  'console.degradedRun': 'ナビゲーターに接続できません — {count}件をローカルの索引から回答しました',

  /*
    Shown above the input on the Japanese tree only, until Unit C lands. It says
    what is true today: the site is in Japanese, Joy's answers are not yet.
  */
  // REVIEW — this is the one line whose tone matters most. It has to sound like
  // a limitation stated plainly, not an apology and not a promise.
  'console.englishOnlyNotice':
    'Joy の回答は現在のところ英語のみです。日本語でご質問いただいた場合も、英語でお答えします。',

  // ── Compose ──────────────────────────────────────────────────────────────
  'compose.sent': '送信しました。',
  'compose.recorded': '記録しました。',
  'compose.sentReplying': 'いただいたアドレス宛に Ethan から返信します。',
  'compose.sentNoAddress':
    'アドレスが含まれていないため、返信ではなく Ethan への伝言として届きます。',
  'compose.recordedReplying':
    'Ethan が目を通す一覧に入りました。いただいたアドレス宛に返信します。',
  'compose.recordedNoAddress':
    'Ethan が目を通す一覧に入りました。アドレスが含まれていないため、やり取りではなく伝言としてお考えください。',
  'compose.close': '閉じる',
  'compose.neverMind': 'やめておく',
  'compose.next': '次へ',
  'compose.thinking': '少々お待ちください',
  'compose.draftLabel': 'メッセージの下書きです。自由に書き換えてください',
  'compose.send': '送信する',
  'compose.sending': '送信中',
  'compose.genericError': '送信できませんでした',
  'compose.errorSuffix':
    'ご自身のメールソフトから直接お送りいただく場合は、全体目次にアドレスを掲載しています。',

  // ── Compose without the model ────────────────────────────────────────────
  'composeFallback.who': 'Ethan へのお取り次ぎです。お名前を教えてください。',
  'composeFallback.what': 'どのようなことに取り組んでいらっしゃいますか。',
  'composeFallback.reply': '返信はどちらにお送りすればよいでしょうか。',
  'composeFallback.ackFirst': 'メッセージをお預かりします。',
  'composeFallback.ackNext': 'ありがとうございます。',
  'composeFallback.draftIntro':
    '以下のようにまとめました。自由に書き換えてから送信してください。',
  // REVIEW — these two assemble the draft in the visitor's own voice, so they
  // are deliberately plain です・ます rather than humble forms. A draft written
  // in keigo would not sound like the person who typed it.
  'composeFallback.draftWho': '{who} と申します',
  'composeFallback.draftReply': '連絡先は {reply} です',

  // ── Action labels ────────────────────────────────────────────────────────
  'action.sendMessage': 'メッセージを送る',
  'action.openIndex': '全体目次を開く',
  'action.sendQuestion': '質問を送る',
  'action.askDirectly': '直接聞いてみる',
  'action.askAboutProject': '案件について聞く',
  'action.askToBeKeptPosted': '続報を知らせてもらう',
  'action.askAboutClientWork': '受託について聞く',
  'action.askAboutIt': 'これについて聞く',
  'action.sendTheQuestion': 'この質問を送る',
  'action.sendQuestionToEthan': 'この質問を Ethan に送る',

  // ── The offline navigator's refusals ─────────────────────────────────────
  'guard.founderPrivate':
    'このサイトが公開しているのは Ethan Gailushas と Bence Burton の短い経歴までです。二人が今どこにいるか、個人的な連絡先、Yorocobu 以外での活動については公開していません。代わりに、ご質問をお預かりすることはできます。',
  'guard.companyMetrics':
    'その部分は公開していません。資金調達、売上、利用者数、創業者二名を超える人数については公開しておらず、訪問できる事務所もありません。仕事はすべてリモートです。公開しているのは、2025年に Wyoming 州で登記し、Chapel Hill を拠点にしていること、そして何を作っているかです。',
  'guard.pricing':
    'Yorocobu は料金を公開していません。金額を推測してお伝えするつもりもありません。お伝えできるのは、受託の仕事を受けているということと、費用は Ethan と Bence との相談で決まるということです。',
  'guard.timeline':
    '公開日は公開していません。サイトに書かれているのは、5件が開発中だということだけです。時期が決まったら知りたいというご連絡は歓迎しています。',
  'guard.clients':
    'Yorocobu は取引先の名前も事例も公開していないため、お見せできるものがありません。受託の仕事自体は受けていますので、まずはご連絡からになります。',

  // ── The offline navigator's generated answers ────────────────────────────
  'navigator.founders': 'Yorocobu は二名の Co-Founder が創業しました。{bios}',
  'navigator.portfolio':
    '5件が開発中です。{titles}。公開しているのはこれらの分類までで、製品名や説明はまだ公開していません。',
  'navigator.projectRefusal':
    '{title} は開発中です。サイトが公開しているのは分類までなので、内容をお伝えするとなると推測になってしまいます。それは避けたいと思います。',
  'navigator.nothingShipped': 'まだ公開したものはありません。5件が開発中です。{titles}。',
  'navigator.unknown':
    'それについては分かりません。{offers}についてならお話しできますし、ご質問を Ethan にお送りすることもできます。',
  // Japanese lists take 、 throughout and have no "and", so the final separator
  // is the same as the others. This is why they are two keys.
  'navigator.listSeparator': '、',
  'navigator.listFinal': '、',
  'navigator.offerSeparator': 'か',

  // ── How each entry is described when offered as a next step ──────────────
  'offer.company': 'Yorocobu が作っているもの',
  'offer.name': '社名の由来',
  'offer.founders': '誰がやっているか',
  'offer.stack': '使っている技術',
  'offer.portfolio': '開発中の5件',
  'offer.services': '一緒に仕事をすること',
  'offer.contact': '連絡の取り方',
  'offer.documentary': 'ドキュメンタリー作品',
  'offer.joy': '私が何者か',

  // ── Followup chips: questions phrased as a visitor would type them ───────
  'ask.company': '何を作っているのですか',
  'ask.name': '社名の由来は',
  'ask.founders': '誰がやっているのですか',
  'ask.stack': 'どんな技術を使っていますか',
  'ask.portfolio': 'どんなアプリを作っていますか',
  'ask.services': '受託もしていますか',
  'ask.contact': '連絡はどう取ればいいですか',
  'ask.documentary': 'ドキュメンタリーはどこで見られますか',
  'ask.joy': 'あなたは何ですか',
  'ask.inDevelopment': '今は何を開発中ですか',
  'ask.buildForMyOrg': '自分の団体のアプリを作ってもらえますか',


  // ── The site map: the six chips, by entry id ─────────────────────────────
  'nav.portfolio': '作っているもの',
  'nav.founders': '運営しているのは',
  'nav.stack': '使っている技術',
  'nav.services': '一緒に仕事をする',
  'nav.name': '社名について',
  'nav.contact': '連絡する',

  // ── Home page ────────────────────────────────────────────────────────────
  // Written for a Japanese search result, not translated from the English one.
  'home.title': 'Yorocobu — 手の届いていない市場に、アプリを',
  // REVIEW — 「手の届いていない市場」 for "underserved markets". The alternative
  // 「ニッチ市場」 is the common business term but loses the sense that someone
  // is going without; this phrasing keeps it.
  'home.description':
    'Yorocobu LLC は、ニッチな市場に残された穴を見つけて、それを埋めるアプリを作っています。React、Swift、Flutter で5件を開発中。ナビゲーターに聞くか、全体目次をご覧ください。',
  'home.heading': 'Yorocobu — 手の届いていない市場に、アプリを',
  'home.fullIndexLink': '全体目次',

  // ── Full index ───────────────────────────────────────────────────────────
  'index.title': '全体目次 — Yorocobu',
  'index.description':
    'Yorocobu が公開している内容をすべて1ページに。理念、社名の由来、創業者、技術、開発中の5件、受託、連絡先までまとめています。',
  'index.kicker': '全体目次',
  'index.heading': 'このサイトにあるものすべて',
  'index.lede':
    'トップページのナビゲーターは、ここにある{count}件の項目だけを見て回答しています。同じ内容を、読むためにまとめ直したのがこのページです。',
  'index.contentsLabel': '目次',
  'index.updated': '更新 {date}',
  'index.direct':
    'Joy はどのページからでもメッセージをお送りできます。直接書きたい場合のアドレスはこちらです：',
  'index.back': 'ナビゲーターに戻る',

  // ── The documentary gate ─────────────────────────────────────────────────
  // The Japanese asks by title. 「忘れ者」 is what a Japanese visitor would
  // recognise; "Ethan's documentary" is what an English one would.
  'gate.ask': 'はじめにひとつだけ。「忘れ者」を見に来られましたか。',
  'gate.yes': 'はい',
  'gate.no': 'いいえ、見て回っているだけです',
  'gate.language': 'どちらの言語でご覧になりますか。',
  'gate.languageAgain': 'かしこまりました。どちらの言語でご覧になりますか。',
  'gate.filmEnglish': 'English',
  'gate.filmJapanese': '日本語',
  'gate.opened': '「忘れ者」を開きます。新しいタブが開かなかった場合は、こちらのリンクからどうぞ。',
  'gate.dismiss': 'やめておく',

  // ── Errors that reach the visitor ────────────────────────────────────────
  'error.questionRequired': '質問を入力してください',
  'error.questionTooLong': '質問が長すぎます',
  'error.badEmail': 'メールアドレスの形式が正しくないようです',
  'error.rateLimited': '短い時間に回数が多すぎました。少し時間をおいてお試しください。',
  'error.methodNotAllowed': '許可されていないメソッドです',
  'error.expectedJson': 'JSON が必要です',
  'error.navigatorUnreachable': 'ナビゲーターに接続できません',
  'error.navigatorNotConfigured': 'ナビゲーターが未設定です',
  'error.streamFailed': '通信が中断されました',
}

export const ui: Record<Locale, Record<UIKey, string>> = { en, ja }

/**
 * Look a string up for a locale.
 *
 * Falls back to English for a missing key rather than rendering the key itself:
 * a visitor seeing `console.placeholder` is worse than a visitor seeing English.
 * scripts/check-i18n.mjs is what makes sure the fallback never has to fire.
 */
export function useTranslations(locale: Locale) {
  const dictionary = ui[locale] ?? ui[defaultLocale]
  return function t(key: UIKey, vars?: Record<string, string | number>): string {
    const value = dictionary[key] ?? ui[defaultLocale][key] ?? ''
    if (!vars) return value
    return value.replace(/\{(\w+)\}/g, (whole, name) =>
      name in vars ? String(vars[name]) : whole
    )
  }
}

/** The locale a URL belongs to, derived from its first path segment. */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/').filter(Boolean)[0]
  return locales.includes(first as Locale) && first !== defaultLocale ? (first as Locale) : defaultLocale
}

/**
 * The same page on the other tree.
 *
 * Path-preserving on purpose: someone reading the full index who switches
 * language wants the full index, not the home page.
 */
export function pathForLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter(Boolean)
  if (locales.includes(segments[0] as Locale) && segments[0] !== defaultLocale) segments.shift()
  const rest = segments.join('/')
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  // A bare locale root keeps its trailing slash (/ja/), matching what the edge
  // function redirects to, so switching does not cost an extra round trip.
  if (!rest) return prefix ? `${prefix}/` : '/'
  return `${prefix}/${rest}`.replace(/\/{2,}/g, '/')
}
