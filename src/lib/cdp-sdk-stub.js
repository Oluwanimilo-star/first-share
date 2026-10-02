// Stub for @coinbase/cdp-sdk (server-wallet SDK pulled in transitively by
// @base-org/account → wagmi baseAccount connector). First Share never uses it.
export class CdpClient {
  constructor() {
    throw new Error("@coinbase/cdp-sdk is not available in First Share");
  }
}
const stub = {};
export default stub;
