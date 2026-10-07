"""v3 headless click-through in "Try demo" toggle mode (mobile + desktop).
   /workspace/.venv-pw/bin/python scripts/v3_clickthrough.py http://localhost:3100
Never connects a wallet and never leaves demo mode for trade steps: no real trades possible.
"""
import asyncio, json, re, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
OUT = "screenshots"
IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
RAW = re.compile(r"(Non-JSON response|Network error calling|HTTP \d{3}|Parameter \[|TypeError|undefined is not|\bnull\b is not|0x[0-9a-f]{20,}.*revert|Failed to fetch)", re.I)

summary = {}

async def run(p, vp, viewport, mobile):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport=viewport, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile,
                              user_agent=IPHONE_UA if mobile else None, accept_downloads=True)
    await ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    pg = await ctx.new_page()
    errors, raw_hits = [], []
    pg.on("pageerror", lambda e: errors.append(str(e)))

    async def check_raw(where):
        txt = await pg.locator("main").inner_text()
        m = RAW.search(txt)
        if m: raw_hits.append(f"{where}: {m.group(0)}")

    async def shot(name, full=True, el=None):
        await pg.wait_for_timeout(400)
        path = f"{OUT}/v3-{vp}-{name}.png"
        if el is not None:
            await el.scroll_into_view_if_needed()
            await el.screenshot(path=path)
        else:
            await pg.add_style_tag(content="[data-testid=bottom-nav]{position:static!important} header.sticky{position:static!important}")
            await pg.evaluate("window.scrollTo(0,0)")
            await pg.screenshot(path=path, full_page=full)
            await pg.add_style_tag(content="[data-testid=bottom-nav]{position:fixed!important} header.sticky{position:sticky!important}")
        print("saved", path)

    nav = pg.locator("[data-testid=bottom-nav]")
    async def nxt(label=None):
        btn = nav.get_by_role("button", name=re.compile(label or "→"))
        await btn.click()

    # ── 0. land, flip the toggle ──
    await pg.goto(BASE, wait_until="domcontentloaded")
    await pg.get_by_role("button", name=re.compile("Try demo")).first.click()
    await pg.get_by_test_id("demo-banner").wait_for()
    # ── 1. pick ──
    grid = pg.get_by_test_id("stock-grid")
    await grid.wait_for(timeout=30000)
    assert await grid.get_by_text("—", exact=True).count() == 0, "dash price on pick step"
    await grid.get_by_text("Tesla", exact=True).first.click()
    await shot("01-pick"); await check_raw("pick")
    # ── 2. learn + issuer compare ──
    await nxt()
    await pg.get_by_test_id("issuer-compare").wait_for()
    await pg.wait_for_function("!document.querySelector('[data-testid=issuer-compare]').innerText.includes('checking')", timeout=20000)
    await shot("02-learn")
    await shot("issuer-compare", el=pg.locator("div.rounded-2xl", has=pg.get_by_test_id("issuer-compare")).first)
    await check_raw("learn")
    # ── 3. backed ──
    await nxt(); await pg.get_by_text("Token-to-share ratio").wait_for(timeout=20000); await shot("03-backed"); await check_raw("backed")
    # ── 4. market ──
    await nxt(); await pg.get_by_test_id("market-status").wait_for(timeout=20000); await shot("04-market"); await check_raw("market")
    # ── 5. gap ──
    await nxt(); await pg.get_by_text("On-chain price").first.wait_for(); await shot("05-gap"); await check_raw("gap")
    # ── 6. quote + preflight + timer ──
    await nxt(); await pg.get_by_text("Best price").wait_for(timeout=20000)
    await pg.get_by_test_id("quote-timer").first.wait_for()
    await shot("06-quote"); await check_raw("quote")
    pf = pg.get_by_test_id("preflight")
    await shot("preflight-ok", el=pf)
    await pf.get_by_role("button", name=re.compile("empty wallet")).click()
    await pf.get_by_text("Top up first").wait_for()
    await shot("preflight-missing", el=pf)
    await pf.get_by_role("button", name=re.compile("refill")).click()
    await pf.get_by_text("Ready").wait_for()
    # countdown ticks
    t1 = await pg.get_by_test_id("quote-timer").first.inner_text(); await pg.wait_for_timeout(2200)
    t2 = await pg.get_by_test_id("quote-timer").first.inner_text()
    assert t1 != t2, f"timer not ticking {t1} {t2}"
    # step pills: jump to Learn and back to Quote
    pills = pg.locator("nav[aria-label=Steps] button")
    await pills.nth(1).click(); await pg.get_by_test_id("issuer-compare").wait_for()
    await pills.nth(5).click(); await pg.get_by_text("Best price").wait_for(timeout=20000)
    # ── 7. rehearse ──
    await nxt("Rehearse the trade"); await pg.get_by_text("Nothing has been sent").wait_for(timeout=30000); await shot("07-rehearse"); await check_raw("rehearse")
    # ── 8. confirm (risk check) ──
    await nxt("Looks good"); await pg.get_by_test_id("risk-check").wait_for()
    buy = pg.get_by_role("button", name=re.compile("^Demo buy"))
    assert await buy.is_disabled(), "buy should be disabled before the risk check"
    await pg.get_by_test_id("risk-check").locator("input").check()
    await shot("08-confirm"); await check_raw("confirm")
    await buy.click()
    await pg.wait_for_timeout(2500); await shot("08b-executing")
    # ── 9. receipt + share card ──
    await pg.get_by_text("You own a piece of").wait_for(timeout=40000); await pg.wait_for_timeout(2500)
    await shot("09-receipt"); await check_raw("receipt")
    card = pg.get_by_test_id("share-card")
    await shot("receipt-card", el=card)
    async with pg.expect_download(timeout=20000) as dl:
        await card.get_by_role("button", name=re.compile("Save PNG")).click()
    d = await dl.value
    await d.save_as(f"{OUT}/v3-{vp}-share-card-download.png"); print("saved", f"{OUT}/v3-{vp}-share-card-download.png")
    await card.get_by_role("button", name=re.compile("Copy text")).click()
    await card.get_by_text("Copied!").wait_for(timeout=5000)
    xhref = await card.get_by_role("link", name=re.compile("Share on")).get_attribute("href")
    assert xhref.startswith("https://x.com/intent/tweet?text=") and "Demo" in xhref
    # ── holdings P/L ──
    await pg.get_by_role("button", name=re.compile("View holdings")).click()
    await pg.get_by_test_id("pnl").first.wait_for(timeout=30000)
    await shot("holdings-pnl"); await check_raw("holdings")

    # ── extra: estimated market hours when the status API fails ──
    pg2 = await ctx.new_page(); pg2.on("pageerror", lambda e: errors.append("pg2: " + str(e)))
    async def break_market(route):
        r = await route.fetch(); body = await r.json()
        body["market"] = {"code": 50001, "msg": "upstream boom", "data": None}
        await route.fulfill(response=r, json=body)
    async def strip_list_status(route):
        r = await route.fetch(); body = await r.json()
        for st in body.get("stocks", []): st["marketStatus"] = None; st["openState"] = None
        await route.fulfill(response=r, json=body)
    await pg2.route("**/api/stock/**", break_market)
    await pg2.route("**/api/stocks?**", strip_list_status)
    await pg2.goto(BASE, wait_until="domcontentloaded")
    await pg2.get_by_test_id("stock-grid").get_by_text("Tesla", exact=True).first.click()
    await pg2.locator("nav[aria-label=Steps] button").nth(3).click()
    await pg2.get_by_text("Estimated from market hours").wait_for(timeout=20000)
    pg = pg2  # reuse helpers
    await shot("04-market-estimated")
    assert "upstream boom" not in await pg2.locator("main").inner_text()
    # ── extra: no wallet, demo off → the rehearse button is never dead ──
    await pg2.get_by_role("button", name=re.compile("Demo on")).click() if await pg2.get_by_role("button", name=re.compile("Demo on")).count() else None
    await pg2.locator("nav[aria-label=Steps] button").nth(5).click()
    cbtn = pg2.get_by_test_id("bottom-nav").get_by_role("button", name=re.compile("Connect wallet to rehearse"))
    await cbtn.wait_for(); assert await cbtn.is_enabled()
    await pg2.get_by_text("We never ask for your password or recovery phrase").first.wait_for()
    await pg2.get_by_text("Not available in the US, UK, Canada, Netherlands, Japan").first.wait_for()
    await shot("06-no-wallet")
    await cbtn.click(); await pg2.wait_for_timeout(1500)
    await pg2.screenshot(path=f"{OUT}/v3-{vp}-wallet-sheet.png"); print("saved", f"{OUT}/v3-{vp}-wallet-sheet.png")

    summary[vp] = {"page_errors": errors, "raw_error_text": raw_hits}
    print(vp, "page errors:", errors, "raw:", raw_hits)
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, "mobile", {"width": 390, "height": 844}, True)
        await run(p, "desktop", {"width": 1280, "height": 900}, False)
    print(json.dumps(summary))

asyncio.run(main())
