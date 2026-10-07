"""Network-guard smoke test with a mock injected wallet that starts on Ethereum (chain 1).
The mock refuses every signing / sending method, so nothing can ever be signed or sent.
   /workspace/.venv-pw/bin/python scripts/v3_network_guard.py http://localhost:3100
"""
import asyncio, re, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"  # well-known test address, not ours
PROVIDER = """
(() => {
  const addr = "%s";
  let chain = "0x1";
  const h = {};
  const emit = (e, v) => (h[e] || []).forEach((cb) => { try { cb(v); } catch (_) {} });
  const provider = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
      if (method === "eth_chainId") return chain;
      if (method === "net_version") return String(parseInt(chain, 16));
      if (method === "wallet_switchEthereumChain") { chain = params[0].chainId; setTimeout(() => emit("chainChanged", chain), 50); return null; }
      if (method === "wallet_addEthereumChain") { chain = params[0].chainId; setTimeout(() => emit("chainChanged", chain), 50); return null; }
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      if (/sign|send/i.test(method)) throw { code: 4001, message: "smoke test: refusing to sign/send" };
      return null;
    },
    on(e, cb) { (h[e] ||= []).push(cb); return provider; },
    removeListener(e, cb) { h[e] = (h[e] || []).filter((x) => x !== cb); return provider; },
  };
  window.ethereum = provider;
  const info = { uuid: "11111111-1111-4111-8111-111111111111", name: "MetaMask", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "io.metamask" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
""" % ADDR

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await ctx.add_init_script(PROVIDER)
        pg = await ctx.new_page()
        errors, quotes = [], []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("request", lambda r: quotes.append(r.url) if "/api/quote" in r.url else None)
        await pg.goto(BASE, wait_until="domcontentloaded")
        await pg.wait_for_timeout(4000)
        if await pg.locator("w3m-modal.open").count() == 0:
            await pg.get_by_role("button", name="Connect wallet").first.click()
            await pg.get_by_role("button", name=re.compile("^MetaMask")).first.click(timeout=15000)
            await pg.wait_for_timeout(2500)
        # AppKit shows its own "Switch Network" sheet for chain 1; dismiss it to test OUR guard.
        await pg.screenshot(path="screenshots/v3-mobile-appkit-switch-network.png"); print("saved appkit sheet")
        # AppKit's sheet can't be dismissed while on an unsupported chain (good!). Hide it so we
        # can check that OUR in-page guard also blocks quoting/signing (test-only DOM tweak).
        await pg.add_style_tag(content="w3m-modal{display:none!important;pointer-events:none!important}")
        await pg.wait_for_timeout(500)
        await pg.get_by_test_id("stock-grid").get_by_text("Tesla", exact=True).first.click()
        await pg.locator("nav[aria-label=Steps] button").nth(5).click()
        guard = pg.locator("[data-network-guard]")
        await guard.wait_for(timeout=15000)
        await pg.wait_for_timeout(1500)
        assert not quotes, f"quote fetched on wrong chain: {quotes}"
        assert await pg.get_by_text("Your options").count() == 0
        nav = await pg.get_by_test_id("bottom-nav").inner_text()
        print("nav on wrong chain:", nav.replace("\n", " | "))
        await pg.add_style_tag(content="[data-testid=bottom-nav]{position:static!important} header.sticky{position:static!important}")
        await pg.screenshot(path="screenshots/v3-mobile-network-guard.png", full_page=True); print("saved network guard")
        await pg.add_style_tag(content="[data-testid=bottom-nav]{position:fixed!important} header.sticky{position:sticky!important}")
        await guard.get_by_role("button", name=re.compile("Switch to BNB Smart Chain")).click()
        await guard.wait_for(state="detached", timeout=15000)
        await pg.get_by_test_id("preflight").wait_for(timeout=20000)
        await pg.get_by_text(re.compile("Your options")).wait_for(timeout=20000)
        await pg.wait_for_timeout(4000)
        print("quotes after switch:", len(quotes))
        await pg.add_style_tag(content="[data-testid=bottom-nav]{position:static!important} header.sticky{position:static!important}")
        await pg.screenshot(path="screenshots/v3-mobile-preflight-live-empty-wallet.png", full_page=True); print("saved live preflight")
        print("page errors:", errors)
        await b.close()

asyncio.run(main())
