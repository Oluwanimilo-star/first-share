"use client";
import { useEffect, useState } from "react";
import { Badge, Card, DemoChip, ErrorBox, Explainer, ExtLink, SectionTitle, Spinner, Stat, StockLogo } from "../ui";
import type { StockOption } from "@/lib/stocks";
import { PLATFORM_LABEL } from "@/lib/stocks";
import type { MarketStatus, StockBundle } from "@/lib/types";
import { PROTECTION_COPY, REASON_COPY, REASON_MSG_COPY, STATUS_COPY } from "@/lib/explain";
import { countdown, localTime, pct, shortAddr, usd } from "@/lib/format";
import { BSCSCAN } from "@/lib/constants";

/* ───────────── Step 1: pick a stock ───────────── */
export function StepPick(p: {
  demo: boolean;
  platform: "bstock" | "ondo";
  setPlatform: (x: "bstock" | "ondo") => void;
  stocks: StockOption[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  selected: StockOption | null;
  onSelect: (s: StockOption) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle step={1} title="Pick a company you know" subtitle="Start with a brand you use every day. You'll spend just $5." />
      <Explainer>
        <p>
          You don&apos;t need to pick the &ldquo;perfect&rdquo; stock today. The goal is to learn how it works with a tiny amount. Choose a company whose products you
          actually know — it makes the news about it much easier to follow.
        </p>
      </Explainer>

      <div className="flex gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        {(["bstock", "ondo"] as const).map((pl) => (
          <button
            key={pl}
            onClick={() => p.setPlatform(pl)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${p.platform === pl ? "bg-ink text-white" : "text-slate-600 hover:bg-black/5"}`}
          >
            {PLATFORM_LABEL[pl]}
            <span className="block text-[11px] font-normal opacity-70">{pl === "bstock" ? "from $5 · AMM + RFQ" : "min ~$20 · RFQ only"}</span>
          </button>
        ))}
      </div>

      {p.loading ? (
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Spinner /> Loading stocks…
        </div>
      ) : p.error ? (
        <ErrorBox onRetry={p.retry}>{p.error}</ErrorBox>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {p.stocks.map((s) => {
            const active = p.selected?.address === s.address;
            const st = s.marketStatus ? STATUS_COPY[s.marketStatus as MarketStatus] : null;
            return (
              <button
                key={s.address}
                onClick={() => p.onSelect(s)}
                className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left shadow-sm transition active:scale-[0.99] ${
                  active ? "border-bnb ring-4 ring-bnb/20" : "border-transparent hover:border-black/10"
                }`}
              >
                <StockLogo ticker={s.ticker} color={s.color} logoUrl={s.logoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{s.name}</span>
                    <span className="text-xs text-slate-500">{s.ticker}</span>
                  </div>
                  <p className="truncate text-sm text-slate-600">{s.blurb}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold tabular-nums">{s.tokenPrice ? usd(s.tokenPrice) : "—"}</span>
                    {st ? <span className="text-slate-500">{st.emoji} {st.label.split(" —")[0]}</span> : null}
                    {s.kind === "ETF" ? <Badge tone="info">ETF</Badge> : null}
                  </div>
                </div>
                {active ? <span className="text-xl">✅</span> : null}
              </button>
            );
          })}
          {p.stocks.length === 0 ? <p className="text-slate-500">No tokens returned for this platform.</p> : null}
        </div>
      )}
      <div className="flex justify-end">
        <DemoChip show={p.demo} />
      </div>
    </div>
  );
}

/* ───────────── Step 2: what is a tokenized stock ───────────── */
export function StepWhat({ stock, demo }: { stock: StockOption; demo: boolean }) {
  const platform = PLATFORM_LABEL[stock.platformId] ?? stock.platformId;
  return (
    <div className="space-y-4">
      <SectionTitle step={2} title="What is a tokenized stock?" subtitle={`${stock.symbol} is a token that follows ${stock.name}'s share price.`} />
      <Explainer>
        <p>
          Think of it like a <b>coat-check ticket</b>. A company ({platform}) buys real {stock.name} shares and keeps them safe with a regulated custodian. For every
          share in the vault, they issue a matching token on BNB Chain. That token is your ticket.
        </p>
        <p>Because it&apos;s a token, you can hold it in your own wallet, buy as little as $5 worth, and trade it any time the market maker is quoting.</p>
      </Explainer>

      <Card>
        <div className="grid grid-cols-1 items-center gap-2 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-3xl">🏦</div>
            <p className="mt-1 text-sm font-semibold">Real {stock.ticker} shares</p>
            <p className="text-xs text-slate-500">held by a custodian</p>
          </div>
          <div className="text-xl text-slate-400 sm:rotate-0">↓<span className="hidden sm:inline">→</span></div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-3xl">🪙</div>
            <p className="mt-1 text-sm font-semibold">{stock.symbol} token</p>
            <p className="text-xs text-slate-500">issued on BNB Chain by {platform}</p>
          </div>
          <div className="text-xl text-slate-400">↓<span className="hidden sm:inline">→</span></div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-3xl">👛</div>
            <p className="mt-1 text-sm font-semibold">Your wallet</p>
            <p className="text-xs text-slate-500">you hold the keys</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-bold">✅ What you get</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-700">
            <li>A token whose price tracks {stock.name}</li>
            <li>Fractions — $5 buys a slice of one share</li>
            <li>It sits in your own wallet, not an app account</li>
          </ul>
        </Card>
        <Card>
          <p className="font-bold">⚠️ Good to know</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-700">
            <li>It&apos;s not the same as a broker account — voting rights and dividends depend on the issuer&apos;s terms</li>
            <li>Not covered by securities insurance; may be restricted where you live</li>
            <li>Prices go down as well as up</li>
          </ul>
        </Card>
      </div>

      <Card>
        <p className="text-sm text-slate-500">Token details</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Issuer</p>
            <p className="font-semibold">{platform}</p>
          </div>
          <div>
            <p className="text-slate-500">Network</p>
            <p className="font-semibold">BNB Smart Chain</p>
          </div>
          <div className="col-span-2">
            <p className="text-slate-500">Contract (the token&apos;s address)</p>
            <ExtLink href={`${BSCSCAN}/token/${stock.address}`}>{shortAddr(stock.address)} on BscScan ↗</ExtLink>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Other issuers do the same thing: <b>bStocks</b> (symbols end in &ldquo;B&rdquo;), <b>Ondo</b> (end in &ldquo;on&rdquo;) and <b>xStocks</b> (end in &ldquo;x&rdquo;). They are
          different tokens — always check the contract address. {demo ? "" : ""}
        </p>
      </Card>
    </div>
  );
}

/* ───────────── Step 3: is it really backed? ───────────── */
export function StepBacked({ stock, bundle, loading, error, retry }: { stock: StockOption; bundle: StockBundle | null; loading: boolean; error: string | null; retry: () => void }) {
  const profile = bundle?.profile.code === 0 ? bundle.profile.data : null;
  const ratio = profile?.tokenToShareRatio ?? stock.tokenToShareRatio;
  const protections = Object.entries(profile?.protections ?? {});
  return (
    <div className="space-y-4">
      <SectionTitle step={3} title="Is it really backed?" subtitle="Trust, but verify. Here's the evidence." />
      <Explainer>
        <p>
          An <b>attestation report</b> is like an independent auditor walking into the vault, counting the real shares, and signing a note saying &ldquo;yes, they&apos;re all here.&rdquo;
          You don&apos;t have to read every page — but it&apos;s a great habit to know where it is.
        </p>
      </Explainer>
      {loading ? (
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Spinner /> Checking the backing…
        </div>
      ) : error ? (
        <ErrorBox onRetry={retry}>{error}</ErrorBox>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Token-to-share ratio</p>
              <DemoChip show={!!bundle?.demo} />
            </div>
            <p className="mt-1 text-2xl font-extrabold">
              1 {stock.symbol} ≈ {ratio ? Number(ratio).toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {stock.ticker} share{ratio && Number(ratio) !== 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {ratio && Number(ratio) !== 1
                ? "Slightly more than 1 — usually because dividends get reinvested into the token over time."
                : "One token tracks exactly one real share."}
            </p>
          </Card>
          <Card>
            <p className="font-bold">Proof documents</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {protections.length === 0 ? <li className="py-2 text-sm text-slate-500">The API didn&apos;t return any reports for this token.</li> : null}
              {protections.map(([key, v]) => {
                const copy = PROTECTION_COPY[key] ?? { title: key, text: "" };
                return (
                  <li key={key} className="flex items-start gap-3 py-3">
                    <span className="text-xl">{v.supported ? "📄" : "➖"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{copy.title}</p>
                      <p className="text-sm text-slate-600">{copy.text}</p>
                      {v.supported && v.url ? (
                        <p className="mt-1 text-sm">
                          <ExtLink href={v.url}>Open report ↗</ExtLink>
                          {bundle?.demo ? <span className="ml-2 text-xs text-amber-700">(demo: example link format)</span> : null}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Not offered for this token.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          {profile?.companyInfo ? (
            <Card>
              <p className="font-bold">About {profile.underlyingFullName}</p>
              <p className="mt-1 text-[15px] text-slate-700">{profile.companyInfo.descriptionEn}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {profile.companyInfo.industry ? <Badge>{profile.companyInfo.industry}</Badge> : null}
                {profile.companyInfo.ceo ? <Badge>CEO: {profile.companyInfo.ceo}</Badge> : null}
                {(profile.companyInfo.conceptsEn ?? []).map((c) => (
                  <Badge key={c} tone="info">
                    {c}
                  </Badge>
                ))}
              </div>
              {profile.companyInfo.website ? (
                <p className="mt-2 text-sm">
                  <ExtLink href={profile.companyInfo.website}>{profile.companyInfo.website.replace(/^https?:\/\//, "")} ↗</ExtLink>
                </p>
              ) : null}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ───────────── Step 4: can I buy right now? ───────────── */
const PREVIEW: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "Live clock" },
  { key: "regular", label: "Regular" },
  { key: "premarket", label: "Pre-market" },
  { key: "postmarket", label: "After-hours" },
  { key: "overnight", label: "Overnight" },
  { key: "closed", label: "Closed" },
  { key: "pause", label: "Paused" },
];

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function StepMarket(p: {
  stock: StockOption;
  bundle: StockBundle | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  demoStatus: string | undefined;
  setDemoStatus: (s: string | undefined) => void;
}) {
  const now = useNow();
  const market = p.bundle?.market.code === 0 ? p.bundle.market.data : null;
  const si = market?.statusInfo;
  const copy = si ? STATUS_COPY[si.marketStatus] : null;
  const nyNow = new Date(now).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  const tone = copy?.tone ?? "neutral";
  const ring = { good: "ring-emerald-300 bg-emerald-50", ok: "ring-sky-300 bg-sky-50", warn: "ring-amber-300 bg-amber-50", bad: "ring-rose-300 bg-rose-50", neutral: "ring-slate-200 bg-white" }[tone];

  return (
    <div className="space-y-4">
      <SectionTitle step={4} title="Can I buy right now?" subtitle={`It's ${nyNow} in New York, where ${p.stock.ticker} trades.`} />
      {p.loading ? (
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Spinner /> Checking the market…
        </div>
      ) : p.error ? (
        <ErrorBox onRetry={p.retry}>{p.error}</ErrorBox>
      ) : si && copy ? (
        <>
          <div className={`rounded-2xl p-5 ring-2 ${ring}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-4xl">{copy.emoji}</p>
                <p className="mt-2 text-2xl font-extrabold">{copy.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{si.openState ? "✔ Tradable now" : "✖ Not tradable right now"}</p>
              </div>
              <DemoChip show={!!p.bundle?.demo} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {si.nextCloseTime ? <Stat label="Closes" value={countdown(si.nextCloseTime, now)} sub={localTime(si.nextCloseTime)} /> : null}
              {si.nextOpenTime ? <Stat label={si.marketStatus === "closed" ? "Trading resumes" : "Regular session opens"} value={countdown(si.nextOpenTime, now)} sub={localTime(si.nextOpenTime)} /> : null}
            </div>
          </div>
          <Explainer>
            <p>{copy.text}</p>
            {si.reasonCode && si.reasonCode !== "TRADING" ? (
              <p>
                <b>Why:</b> {REASON_COPY[si.reasonCode]} {si.reasonMsg ? REASON_MSG_COPY[si.reasonMsg] ?? si.reasonMsg : ""}
              </p>
            ) : null}
            <p className="text-sm text-slate-600">Times are shown in your own time zone.</p>
          </Explainer>
          {!si.openState ? (
            <div className="rounded-xl bg-white p-3 text-sm text-slate-700 ring-1 ring-black/5">
              You can keep going to learn the rest of the steps. When you get to the quote, it may be refused until the market reopens.
            </div>
          ) : null}
          {p.bundle?.demo ? (
            <Card>
              <p className="text-sm font-semibold">Demo: preview other situations</p>
              <p className="text-xs text-slate-500">See how the guide explains each market state.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PREVIEW.map((x) => (
                  <button
                    key={x.label}
                    onClick={() => p.setDemoStatus(x.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${p.demoStatus === x.key ? "bg-ink text-white ring-ink" : "bg-white text-slate-700 ring-black/10"}`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : (
        <ErrorBox onRetry={p.retry}>Market status wasn&apos;t returned for this token.</ErrorBox>
      )}
    </div>
  );
}

/* ───────────── Step 5: on-chain price vs reference price ───────────── */
export function StepGap({ stock, bundle }: { stock: StockOption; bundle: StockBundle | null }) {
  const priceRow = bundle?.price.code === 0 ? bundle.price.data?.[0] : null;
  const market = bundle?.market.code === 0 ? bundle.market.data : null;
  const ratio = Number(bundle?.profile.data?.tokenToShareRatio ?? stock.tokenToShareRatio ?? 1) || 1;
  const tokenPrice = Number(priceRow?.tokenPrice ?? stock.tokenPrice ?? NaN);
  const refPrice = Number(priceRow?.referencePrice ?? market?.marketData.referencePrice ?? stock.referencePrice ?? NaN);
  const perShare = tokenPrice / ratio;
  const gap = ((perShare - refPrice) / refPrice) * 100;
  const abs = Math.abs(gap);
  const verdict = !isFinite(gap)
    ? { tone: "neutral" as const, text: "We couldn't load both prices." }
    : abs < 0.5
      ? { tone: "good" as const, text: "Tiny gap — the token is tracking the stock closely. 👍" }
      : abs < 2
        ? { tone: "ok" as const, text: "A normal, small gap. Common outside busy trading hours." }
        : { tone: "warn" as const, text: "A big gap! You might pay noticeably more (or less) than the stock is worth. Consider waiting." };
  const hi = Number(market?.marketData.high52W ?? NaN);
  const lo = Number(market?.marketData.low52W ?? NaN);
  const pos = isFinite(hi) && isFinite(lo) && hi > lo ? Math.min(100, Math.max(0, ((refPrice - lo) / (hi - lo)) * 100)) : null;

  return (
    <div className="space-y-4">
      <SectionTitle step={5} title="Is the token price fair?" subtitle="Compare the token's price with the stock's reference price." />
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Right now</p>
          <DemoChip show={!!bundle?.demo} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Stat label={`On-chain price (1 ${stock.symbol})`} value={usd(tokenPrice)} sub="what the token trades at" />
          <Stat label={`Reference price (1 ${stock.ticker} share)`} value={usd(refPrice)} sub="per-share benchmark" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Gap</span>
          <Badge tone={verdict.tone}>{isFinite(gap) ? `${pct(gap)} ${gap > 0 ? "premium" : gap < 0 ? "discount" : ""}` : "—"}</Badge>
        </div>
        <p className="mt-2 text-[15px] font-medium">{verdict.text}</p>
        {ratio !== 1 ? <p className="mt-1 text-xs text-slate-500">Adjusted for the {ratio} token-to-share ratio.</p> : null}
        {priceRow?.tokenPriceUpdatedAt ? <p className="mt-1 text-xs text-slate-500">Token price updated {new Date(priceRow.tokenPriceUpdatedAt).toLocaleTimeString()}</p> : null}
      </Card>
      <Explainer>
        <p>
          The token and the real stock are two different markets that are glued together by traders. When the token gets a bit pricier than the stock (a{" "}
          <b>premium</b>), someone can sell tokens and buy shares to pocket the difference — which pushes the prices back together.
        </p>
        <p>
          Gaps open up when the main stock market is closed, when big news breaks, or when few people are trading the token. For a $5 first buy, a gap under 1% is
          nothing to worry about.
        </p>
      </Explainer>
      {pos !== null ? (
        <Card>
          <p className="text-sm font-semibold">Where {stock.ticker} sits in its 52-week range</p>
          <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-rose-300 via-amber-300 to-emerald-300">
            <div className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-white bg-ink shadow" style={{ left: `${pos}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>Low {usd(lo)}</span>
            <span>High {usd(hi)}</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
