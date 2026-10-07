import asyncio, re
from playwright.async_api import async_playwright

LIVE = "http://localhost:3002"
OUT = "screenshots"
ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

PROVIDER = """
(() => {
  const addr = "%s";
  const pad = (n) => BigInt(n).toString(16).padStart(64, "0");
  const provider = {
    isMetaMask: true,
    selectedAddress: addr,
    chainId: "0x38",
    _h: {},
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
      if (method === "eth_chainId") return "0x38";
      if (method === "net_version") return "56";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_getBalance") return "0x" + pad(10n**17n);
      if (method === "eth_estimateGas") return "0x30d40";
      if (method === "eth_blockNumber") return "0x3b9aca00";
      if (method === "eth_gasPrice") return "0x5f5e100";
      if (method === "eth_call") {
        const data = (params?.[0]?.data || "").toLowerCase();
        if (data.startsWith("0x70a08231")) return "0x" + pad(100n * 10n**18n);
        if (data.startsWith("0xdd62ed3e")) return "0x" + pad(0);
        return "0x" + "0".repeat(64);
      }
      if (method === "personal_sign" || method === "eth_signTypedData_v4" || method === "eth_sendTransaction") {
        throw { message: "User rejected the request.", code: 4001 };
      }
      return null;
    },
    on(e, cb) { (provider._h[e] ||= []).push(cb); },
    removeListener(e, cb) { provider._h[e] = (provider._h[e] || []).filter(x => x !== cb); },
    enable: async () => [addr],
  };
  window.ethereum = provider;
})();
""" % ADDR

async def shot(pg, name):
    await pg.wait_for_timeout(400)
    await pg.add_style_tag(content="nav.fixed{position:static!important} header.sticky{position:static!important}")
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print("saved", name)

async def nxt(pg):
    await pg.locator("nav button", has_text="→").click()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        await ctx.add_init_script(PROVIDER)
        pg = await ctx.new_page()
        await pg.goto(LIVE, wait_until="networkidle")
        mode = await (await pg.request.get(LIVE + "/api/mode")).json()
        print("mode", mode)

        await pg.get_by_role("button", name=re.compile("Connect wallet|Browser wallet|MetaMask", re.I)).first.click()
        await pg.wait_for_timeout(1500)
        for name in ["MetaMask", "Browser wallet", "Injected"]:
            loc = pg.get_by_role("button", name=name)
            if await loc.count():
                await loc.first.click()
                await pg.wait_for_timeout(1200)
                break
        print("header", (await pg.locator("header").inner_text()).replace("\n", " | ")[:200])

        search = pg.get_by_placeholder(re.compile("Search by ticker", re.I))
        await search.first.fill("NVDA")
        await pg.wait_for_timeout(700)
        await pg.locator("button", has_text="NVIDIA").first.click()

        for _ in range(5):
            await nxt(pg)
            await pg.wait_for_timeout(500)

        await pg.get_by_text(re.compile("Best price|Your options")).first.wait_for(timeout=30000)
        await pg.wait_for_timeout(2500)
        await nxt(pg)
        await pg.get_by_role("heading", name="Dress rehearsal").wait_for(timeout=30000)
        try:
            await pg.get_by_text("Nothing has been sent").wait_for(timeout=60000)
        except Exception as e:
            print("wait note", e)
            await pg.wait_for_timeout(5000)
        await pg.wait_for_timeout(1500)
        await shot(pg, "live-desktop-07-simulate")
        await b.close()

asyncio.run(main())
