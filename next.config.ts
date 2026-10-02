import type { NextConfig } from "next";

// Optional modules pulled in transitively by wallet SDKs (Coinbase CDP server SDK / x402),
// which this app never uses. Alias them to an empty module so the bundle resolves.
const EMPTY = "./src/lib/empty-module.js";
const optionalModules = [
  "pino-pretty",
  "lokijs",
  "encoding",
];

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      ...Object.fromEntries(optionalModules.map((m) => [m, EMPTY])),
      "@coinbase/cdp-sdk": "./src/lib/cdp-sdk-stub.js",
    },
  },
};

export default nextConfig;
