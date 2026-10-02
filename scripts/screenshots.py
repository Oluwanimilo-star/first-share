"""Headless click-through of the whole flow (demo mode). Usage:
   python scripts/screenshots.py http://localhost:3000 [--desktop]
Requires: pip install playwright && playwright install chromium
"""
import asyncio, re, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith("http") else "http://localhost:3000"
OUT = "screenshots"
IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

async def run(p, name, viewport, mobile):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport=viewport, device_scale_factor=2 if mobile else 1, is_mobile=mobile, has_touch=mobile, user_agent=IPHONE_UA if mobile else None)
    pg = await ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))

    async def shot(n):
        await pg.wait_for_timeout(500)
        # full-page captures: put the fixed bottom bar at the end of the page instead of mid-image
        await pg.add_style_tag(content="nav.fixed{position:static!important} header.sticky{position:static!important}")
        await pg.evaluate("window.scrollTo(0,0)")
        await pg.screenshot(path=f"{OUT}/{name}-{n}.png", full_page=True)
        print("saved", f"{name}-{n}.png")

    async def nxt():
        await pg.locator("nav button", has_text="→").click()

    await pg.goto(BASE, wait_until="networkidle")
    await pg.get_by_text("Apple", exact=True).first.wait_for()
    await pg.get_by_text("Apple", exact=True).first.click()
    await shot("01-pick")
    await nxt(); await shot("02-what")
    await nxt(); await pg.get_by_text("Token-to-share ratio").wait_for(); await shot("03-backed")
    await nxt(); await pg.get_by_text("Demo: preview other situations").wait_for(); await shot("04-market")
    await pg.get_by_role("button", name="Closed", exact=True).click(); await pg.get_by_text("Market closed").first.wait_for(); await shot("04b-market-closed")
    await pg.get_by_role("button", name="Pre-market", exact=True).click(); await pg.get_by_text("Pre-market (early morning)").first.wait_for(); await shot("04c-market-premarket")
    await pg.get_by_role("button", name="Live clock", exact=True).click(); await pg.wait_for_timeout(800)
    await nxt(); await pg.get_by_text("On-chain price").first.wait_for(); await shot("05-gap")
    await nxt(); await pg.get_by_text("Best price").wait_for(); await shot("06-quote")
    await nxt(); await pg.get_by_text("Nothing has been sent").wait_for(timeout=20000); await shot("07-simulate")
    await nxt(); await pg.get_by_role("checkbox").check(); await shot("08-confirm")
    await pg.get_by_role("button", name=re.compile("^Buy ")).click()
    await pg.wait_for_timeout(2600); await shot("08b-executing")
    await pg.get_by_text("You own a piece of").wait_for(timeout=30000); await pg.wait_for_timeout(2500); await shot("09-receipt")
    print(name, "page errors:", errors)
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, "mobile", {"width": 390, "height": 844}, True)
        if "--desktop" in sys.argv:
            await run(p, "desktop", {"width": 1280, "height": 900}, False)

asyncio.run(main())
