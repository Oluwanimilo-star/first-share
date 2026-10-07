"""Live step-7 smoke screenshot (mock injected wallet, stop before signing)."""
import asyncio, re
from playwright.async_api import async_playwright

LIVE = "http://localhost:3000"
OUT = "screenshots"
MOCK_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Return non-zero balances so sim isn't only balance-fail (still won't sign).
USDT = "0x55d398326f99059fF775485246999027B3197955"

PROVIDER = f"""
(() => {{
  const addr = "{MOCK_ACCOUNT}";
  const usdt = "{USDT}".toLowerCase();
  const pad = (n) => n.toString(16).padStart(64, "0");
  const provider = {{
    isMetaMask: true,
    selectedAddress: addr,
    chainId: "0x38",
    networkVersion: "56",
    _handlers: {{}},
    request: async ({{ method, params }}) => {{
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
      if (method === "eth_chainId") return "0x38";
      if (method === "net_version") return "56";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_getBalance") return "0x" + pad(10n**17n); // 0.1 BNB
      if (method === "eth_estimateGas") return "0x30d40";
      if (method === "eth_blockNumber") return "0x3b9aca00";
      if (method === "eth_gasPrice") return "0x5f5e100";
      if (method === "eth_call") {{
        const data = (params?.[0]?.data || "").toLowerCase();
        // balanceOf(address) selector 0x70a08231
        if (data.startsWith("0x70a08231")) {{
          // 100 USDT
          return "0x" + pad(100n * 10n**18n);
        }}
        // allowance
        if (data.startsWith("0xdd62ed3e")) return "0x" + pad(0);
        return "0x" + pad(0);
      }}
      if (method === "personal_sign" || method === "eth_signTypedData_v4" || method === "eth_sendTransaction") {{
        throw {{ message: "Smoke test: refusing to sign/send real txs", code: 4001 }};
      }}
      return null;
    }},
    on(event, cb) {{ (provider._handlers[event] ||= []).push(cb); return provider; }},
    removeListener(event, cb) {{
      provider._handlers[event] = (provider._handlers[event] || []).filter(x => x !== cb);
      return provider;
    }},
    enable: async () => [addr],
  }};
  window.ethereum = provider;
}})();
"""

async def shot(pg, name):
    await pg.wait_for_timeout(500)
    await pg.add_style_tag(content="nav.fixed{position:static!important} header.sticky{position:static!important}")
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("saved", name)

async def dismiss_modal(pg):
    await pg.keyboard.press("Escape")
    await pg.wait_for_timeout(300)
    await pg.evaluate("""() => {
      document.querySelectorAll('w3m-modal, w3m-router, [data-testid="w3m-modal"]').forEach(el => {
        try { el.remove(); } catch(e) {}
      });
      document.body.style.overflow = 'auto';
    }""")
    await pg.wait_for_timeout(200)

async def nxt(pg):
    await dismiss_modal(pg)
    await pg.locator("nav button", has_text="→").click()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        await ctx.add_init_script(PROVIDER)
        pg = await ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.goto(LIVE, wait_until="networkidle")
        await dismiss_modal(pg)

        # Try connect via AppKit
        connect = pg.get_by_role("button", name=re.compile("Connect wallet", re.I))
        if await connect.count():
            await connect.first.click()
            await pg.wait_for_timeout(1200)
            # Prefer injected / Browser Wallet / MetaMask tile
            for sel in [
                'button:has-text("MetaMask")',
                'button:has-text("Browser Wallet")',
                'button:has-text("Injected")',
                '[data-testid="wallet-selector-metamask"]',
                'wui-list-item',
                'wui-card',
            ]:
                loc = pg.locator(sel)
                if await loc.count():
                    try:
                        await loc.first.click(timeout=2000)
                        await pg.wait_for_timeout(1500)
                        break
                    except Exception:
                        pass
            await dismiss_modal(pg)

        # If still not connected, proceed anyway — quote/sim may soft-fail with connect CTA
        search = pg.get_by_placeholder(re.compile("Search by ticker", re.I))
        await search.first.fill("NVDA")
        await pg.wait_for_timeout(800)
        # Click the stock row button containing NVIDIA
        row = pg.locator("button", has_text="NVIDIA").first
        await row.click(force=True)
        await pg.wait_for_timeout(500)

        for _ in range(5):
            await nxt(pg)
            await pg.wait_for_timeout(600)

        # Quote step
        try:
            await pg.get_by_text(re.compile("Get a price|Your options|Connect your wallet to get")).wait_for(timeout=20000)
            await pg.wait_for_timeout(2500)
            # If we have a route, continue to rehearsal
            if await pg.locator("nav button", has_text="→").is_enabled():
                await nxt(pg)
            else:
                # Try refreshing quote if wallet connected mid-way
                await pg.wait_for_timeout(2000)
                if await pg.locator("nav button", has_text="→").is_enabled():
                    await nxt(pg)
            await pg.get_by_text(re.compile("Dress rehearsal|Connect your wallet to run|Nothing has been sent|Running the simulation")).wait_for(timeout=45000)
            await pg.wait_for_timeout(4000)
            await shot(pg, "live-desktop-07-simulate")
        except Exception as e:
            print("nav issue", e)
            await shot(pg, "live-desktop-07-simulate")
        print("errors", errors[:8])
        await b.close()

asyncio.run(main())
