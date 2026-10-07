import asyncio, re
from playwright.async_api import async_playwright

LIVE = "http://localhost:3000"
OUT = "screenshots"
ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

PROVIDER = f"""
(() => {{
  const addr = "{ADDR}";
  const pad = (n) => BigInt(n).toString(16).padStart(64, "0");
  const provider = {{
    isMetaMask: true,
    selectedAddress: null,
    chainId: "0x38",
    _h: {{}},
    request: async ({{ method, params }}) => {{
      console.log("[mock eth]", method);
      if (method === "eth_requestAccounts" || method === "eth_accounts") {{
        provider.selectedAddress = addr;
        return [addr];
      }}
      if (method === "eth_chainId") return "0x38";
      if (method === "net_version") return "56";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_getBalance") return "0x" + pad(10n**17n);
      if (method === "eth_estimateGas") return "0x30d40";
      if (method === "eth_blockNumber") return "0x3b9aca00";
      if (method === "eth_gasPrice") return "0x5f5e100";
      if (method === "eth_call") {{
        const data = (params?.[0]?.data || "").toLowerCase();
        if (data.startsWith("0x70a08231")) return "0x" + pad(100n * 10n**18n);
        return "0x" + "0"*64;
      }}
      if (method === "personal_sign" || method === "eth_signTypedData_v4" || method === "eth_sendTransaction") {{
        throw {{ message: "User rejected", code: 4001 }};
      }}
      return null;
    }},
    on(e, cb) {{ (provider._h[e] ||= []).push(cb); }},
    removeListener(e, cb) {{ provider._h[e] = (provider._h[e] || []).filter(x => x !== cb); }},
    emit(e, ...a) {{ (provider._h[e] || []).forEach(cb => cb(...a)); }},
    enable: async () => provider.request({{ method: "eth_requestAccounts" }}),
  }};
  window.ethereum = provider;
  window.ethereumProviders = [provider];
}})();
"""

async def shot(pg, name):
    await pg.wait_for_timeout(400)
    await pg.add_style_tag(content="nav.fixed{position:static!important} header.sticky{position:static!important}")
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("saved", name)

async def nxt(pg):
    await pg.locator("nav button", has_text="→").click()

async def try_connect(pg):
    # Open connect
    for label in ["Connect wallet"]:
        btn = pg.get_by_role("button", name=label)
        if await btn.count():
            await btn.first.click()
            break
    await pg.wait_for_timeout(1500)
    # Dump modal text for debugging
    txt = await pg.evaluate("""() => {
      const m = document.querySelector('w3m-modal');
      return m ? (m.shadowRoot ? m.shadowRoot.innerHTML.slice(0,500) : m.innerHTML.slice(0,500)) : 'no-modal';
    }""")
    print("modal snippet:", txt[:300])

    # Click anything that looks like a wallet in light DOM + pierce open shadow
    clicked = await pg.evaluate("""() => {
      function* walk(node) {
        if (!node) return;
        yield node;
        if (node.shadowRoot) yield* walk(node.shadowRoot);
        for (const c of node.children || []) yield* walk(c);
      }
      const root = document.querySelector('w3m-modal') || document.body;
      for (const el of walk(root)) {
        const t = (el.textContent || '').trim();
        if (!t) continue;
        if (/MetaMask|Browser Wallet|Injected|Rabby|WalletConnect/i.test(t) && (el.tagName || '').toLowerCase().includes('item') || (el.onclick || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) {
          if (/MetaMask|Browser Wallet|Injected/i.test(t) && t.length < 40) {
            try { el.click(); return t; } catch(e) {}
          }
        }
      }
      // fallback: click first wui-list-item
      for (const el of walk(root)) {
        if ((el.tagName || '').toLowerCase() === 'wui-list-item') {
          try { el.click(); return 'wui-list-item'; } catch(e) {}
        }
      }
      return null;
    }""")
    print("clicked wallet tile:", clicked)
    await pg.wait_for_timeout(2000)
    # Check if connected
    connected = await pg.evaluate("() => !!(window.ethereum && window.ethereum.selectedAddress)")
    header = await pg.locator("header").inner_text()
    print("selectedAddress set:", connected, "header:", header.replace("\\n"," ")[:120])

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        await ctx.add_init_script(PROVIDER)
        pg = await ctx.new_page()
        pg.on("console", lambda m: print("console", m.type, m.text) if "mock eth" in m.text or "error" in m.type else None)
        await pg.goto(LIVE, wait_until="networkidle")
        await try_connect(pg)

        # Close modal if still open
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(400)
        await pg.evaluate("""() => { document.querySelectorAll('w3m-modal').forEach(e => e.remove()); document.body.style.overflow='auto'; }""")

        search = pg.get_by_placeholder(re.compile("Search by ticker", re.I))
        await search.first.fill("NVDA")
        await pg.wait_for_timeout(700)
        await pg.locator("button", has_text="NVIDIA").first.click(force=True)

        for i in range(5):
            await nxt(pg)
            await pg.wait_for_timeout(500)

        # On quote — if connect CTA, try connect again from in-page button
        if await pg.get_by_text("Connect your wallet to get a real quote").count():
            await pg.get_by_role("button", name="Connect wallet").nth(1).click()
            await pg.wait_for_timeout(1000)
            await try_connect(pg)
            await pg.keyboard.press("Escape")
            await pg.evaluate("""() => { document.querySelectorAll('w3m-modal').forEach(e => e.remove()); }""")
            await pg.wait_for_timeout(1500)

        # Wait for routes or proceed
        for _ in range(20):
            if await pg.get_by_text("Best price").count():
                break
            await pg.wait_for_timeout(500)

        if await pg.get_by_text("Best price").count():
            await nxt(pg)
            await pg.get_by_text(re.compile("Dress rehearsal|Nothing has been sent|Running the simulation")).wait_for(timeout=60000)
            await pg.wait_for_timeout(5000)
            await shot(pg, "live-desktop-07-simulate")
        else:
            print("no quote — saving quote state as live-desktop-07 fallback is insufficient")
            await shot(pg, "live-desktop-06-quote-nowallet")
            # Still try to advance if button enabled somehow
            btn = pg.locator("nav button", has_text="→")
            if await btn.count() and await btn.is_enabled():
                await nxt(pg)
                await pg.wait_for_timeout(3000)
                await shot(pg, "live-desktop-07-simulate")
        await b.close()

asyncio.run(main())
