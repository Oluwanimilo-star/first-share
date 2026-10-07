"""Capture fixed step 7, holdings, and sell/swap UI."""
import asyncio, re, sys
from playwright.async_api import async_playwright

DEMO = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"
LIVE = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3000"
OUT = "screenshots"

MOCK_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

PROVIDER = f"""
(() => {{
  const addr = "{MOCK_ACCOUNT}";
  const provider = {{
    isMetaMask: true,
    selectedAddress: addr,
    chainId: "0x38",
    networkVersion: "56",
    request: async ({{ method, params }}) => {{
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
      if (method === "eth_chainId") return "0x38";
      if (method === "net_version") return "56";
      if (method === "wallet_switchEthereumChain") return null;
      if (method === "eth_getBalance") return "0x2386f26fc10000"; // 0.01 BNB
      if (method === "eth_call") return "0x" + "0"*64;
      if (method === "eth_estimateGas") return "0x5208";
      if (method === "eth_blockNumber") return "0x1";
      if (method === "eth_gasPrice") return "0x5f5e100";
      if (method === "personal_sign" || method === "eth_signTypedData_v4" || method === "eth_sendTransaction") {{
        throw new Error("Smoke test: refusing to sign/send");
      }}
      console.log("mock provider unhandled", method, params);
      return null;
    }},
    on: () => provider,
    removeListener: () => provider,
    enable: async () => [addr],
  }};
  window.ethereum = provider;
}})();
"""

async def shot(pg, name):
    await pg.wait_for_timeout(600)
    await pg.add_style_tag(content="nav.fixed{position:static!important} header.sticky{position:static!important}")
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("saved", name)

async def nxt(pg):
    await pg.locator("nav button", has_text="→").click()

async def demo_flow(p):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
    pg = await ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    await pg.goto(DEMO, wait_until="networkidle")
    await pg.get_by_text("Apple", exact=True).first.wait_for()
    await pg.get_by_text("Apple", exact=True).first.click()
    for _ in range(5):
        await nxt(pg)
        await pg.wait_for_timeout(400)
    # step 6 quote
    await pg.get_by_text("Best price").wait_for(timeout=20000)
    await nxt(pg)
    # step 7 simulate
    await pg.get_by_text("Nothing has been sent").wait_for(timeout=30000)
    await shot(pg, "desktop-07-simulate")
    # continue to confirm but don't need more for this task
    # Holdings
    await pg.get_by_role("button", name="Holdings").click()
    await pg.get_by_text("Your holdings").wait_for()
    await pg.get_by_text("Tokenized stocks").wait_for()
    await shot(pg, "desktop-holdings")
    # Sell
    await pg.get_by_role("button", name="Sell / swap").first.click()
    await pg.get_by_text("Sell ").first.wait_for()
    await pg.get_by_text("How much to sell?").wait_for(timeout=20000)
    await pg.wait_for_timeout(1500)
    await shot(pg, "desktop-sell-swap")
    # mobile holdings too
    await b.close()

    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    pg = await ctx.new_page()
    await pg.goto(DEMO, wait_until="networkidle")
    await pg.get_by_text("Apple", exact=True).first.click()
    for _ in range(5):
        await nxt(pg)
        await pg.wait_for_timeout(300)
    await pg.get_by_text("Best price").wait_for(timeout=20000)
    await nxt(pg)
    await pg.get_by_text("Nothing has been sent").wait_for(timeout=30000)
    await shot(pg, "mobile-07-simulate")
    await pg.get_by_role("button", name="Holdings").click()
    await pg.get_by_text("Your holdings").wait_for()
    await shot(pg, "mobile-holdings")
    await pg.get_by_role("button", name="Sell / swap").first.click()
    await pg.get_by_text("How much to sell?").wait_for(timeout=20000)
    await pg.wait_for_timeout(1200)
    await shot(pg, "mobile-sell-swap")
    print("demo page errors:", errors)
    await b.close()

async def live_step7(p):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": 1280, "height": 900})
    await ctx.add_init_script(PROVIDER)
    pg = await ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    await pg.goto(LIVE, wait_until="networkidle")
    # Connect mock wallet
    # AppKit or injected — try connect
    try:
        btn = pg.get_by_role("button", name=re.compile("Connect wallet", re.I))
        if await btn.count():
            await btn.first.click()
            await pg.wait_for_timeout(800)
            # try MetaMask / Browser wallet / injected
            for label in ["MetaMask", "Browser wallet", "Injected", "Rabby"]:
                loc = pg.get_by_text(label, exact=False)
                if await loc.count():
                    await loc.first.click()
                    break
            await pg.wait_for_timeout(1000)
    except Exception as e:
        print("connect attempt:", e)

    # Pick NVDA
    more = pg.get_by_text("More stocks", exact=False)
    if await more.count():
        await more.first.click()
        await pg.wait_for_timeout(400)
    search = pg.get_by_placeholder(re.compile("search|ticker|company", re.I))
    if await search.count():
        await search.first.fill("NVDA")
        await pg.wait_for_timeout(600)
    nvda = pg.get_by_text("NVIDIA", exact=False)
    await nvda.first.click()
    for i in range(5):
        await nxt(pg)
        await pg.wait_for_timeout(500)
    # Quote may need wallet — wait
    try:
        await pg.get_by_text(re.compile("Best price|Your options|Asking market")).wait_for(timeout=25000)
        await pg.wait_for_timeout(2000)
        # if routes present, continue
        if await pg.get_by_text("Best price").count():
            await nxt(pg)
            await pg.get_by_text(re.compile("Dress rehearsal|Nothing has been sent|Connect your wallet to run")).wait_for(timeout=45000)
            await pg.wait_for_timeout(2000)
            await shot(pg, "live-desktop-07-simulate")
        else:
            await shot(pg, "live-desktop-06-quote-state")
    except Exception as e:
        print("live step7 nav issue:", e)
        await shot(pg, "live-desktop-07-simulate-fallback")
    print("live page errors:", errors[:5])
    await b.close()

async def main():
    async with async_playwright() as p:
        await demo_flow(p)
        await live_step7(p)

asyncio.run(main())
