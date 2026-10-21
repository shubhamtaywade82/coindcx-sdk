# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-21

Comprehensive CoinDCX API alignment covering all official documentation endpoints,
WebSocket protocol conformance, dual-gateway streaming, wallet transfers, and
contract parameter normalization.

### Added

- **Dual WebSocket gateway support** (`src/websocket/ws-client.ts`, `src/index.ts`) -
  `CoinDCXClient` now exposes both `ws` (Futures streaming via
  `wss://stream.coindcx.com`) and `spotWs` (Spot streaming via
  `wss://stream-spot.coindcx.com`).
- **Spot WebSocket public channels & private events** (`src/websocket/public-streams.ts`,
  `src/websocket/private-streams.ts`) - typed support for `currentPrices@spot@10s`
  and `priceStats@spot@60s`, plus user events `order-update` and `trade-update`.
- **Wallet & Sub-Account transfers** (`src/rest/spot.ts`, `src/index.ts`) -
  `client.spot.subAccountTransfer()` (`/exchange/v1/wallets/sub_account_transfer`)
  and `client.spot.walletTransfer()` (`/exchange/v1/wallets/transfer`) with
  convenience top-level methods on `CoinDCXClient`.
- **Futures positions & market data endpoints** (`src/rest/futures.ts`,
  `src/rest/market-data.ts`) - `client.futures.cancelAllOpenOrders()`,
  `client.futures.getCurrencyConversions()`, `getFuturesCandles()`,
  `getFuturesOrderBook()`, `getFuturesTrades()`, `getCurrentPricesRT()`, and
  `getFuturesInstrument()`.
- **Flexible parameter normalization** (`src/core/rest-client.ts`, `src/paper/engine.ts`) -
  order creation across Spot, Margin, and Futures seamlessly accepts either
  `quantity` or `total_quantity`, and `price` or `price_per_unit`.
- **Margin & Lend parameter ergonomics** (`src/rest/margin.ts`) - automatic
  `ecode: 'B'` default for margin orders; normalized Lend request inputs to
  `currency_short_name` and `duration`.

### Changed

- **WebSocket private authentication protocol** (`src/core/ws-client.ts`) -
  corrected the authentication payload to emit `join` with
  `{ channelName: 'coindcx', apiKey, authSignature }` matching CoinDCX's
  Socket.IO server expectations.
- **Futures transactions endpoint** (`src/rest/futures.ts`) - corrected URI path
  to `/exchange/v1/derivatives/futures/positions/transactions`.
- **Rate limiting rules** (`src/core/rate-limiter.ts`) - aligned default bucket
  limits with official documentation: 2000 req/min for order endpoints and
  30 req/min for bulk order cancellation.

## [1.2.0] - 2026-08-24

Closes the remaining gaps for driving this SDK from an autonomous agent with
real API keys: a hard guardrail against oversized orders, a way to preview
an order before it's sent, and host-level hints so an MCP client can gate
risky calls behind confirmation.

### Added

- **Order-size guardrails** (`src/core/safety.ts`) - `client.setSafetyLimits({ maxOrderQuantity, maxOrderNotional })`
  (also settable via the `safetyLimits` constructor option) rejects an
  oversized order client-side, before it ever reaches the network, by
  throwing the new `CoinDCXOrderLimitError`. Enforced in
  `spot.createOrder`, `margin.createOrder`, and `futures.createOrder` (and
  therefore in `ops.bracket.placeBracketOrder`, which calls the latter).
  Unset by default - opt in via `client.getSafetyLimits()` /
  `setSafetyLimits()`.
- **`dry_run` on every MCP order-creation tool** (`futures_create_order`,
  `spot_create_order`, `futures_place_bracket_order`, `paper_place_order`) -
  validates the order (including the safety limits above) and returns what
  would be submitted, without placing it.
- **MCP tool annotations** (`readOnlyHint`, `destructiveHint`,
  `idempotentHint`, `openWorldHint` per the
  [MCP tools spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#annotations))
  on every tool in the toolkit, so a compliant MCP host can gate
  order-creation, position-closing, leverage-change, and paper-reset calls
  behind user confirmation while read-only calls pass through freely.
- **`account_get_safety_limits` MCP tool** - lets an agent introspect the
  currently configured guardrails before sizing an order.
- `COINDCX_MAX_ORDER_QUANTITY` / `COINDCX_MAX_ORDER_NOTIONAL` env vars for
  `bin/mcp.ts`, wiring the guardrails above into the standalone MCP server.
  The server logs a startup warning to stderr if neither is set.
- `CoinDCXMcpServer.connect(transport)` - connects the server to any MCP
  transport (not just stdio), so it can be exercised in-process against
  `InMemoryTransport` in tests without spawning a subprocess.
- Test coverage: `tests/safety-limits.test.ts` (guardrail unit + integration
  tests, including proof that a blocked order never reaches the network)
  and `tests/mcp-server.test.ts` (full MCP protocol round-trip over
  `InMemoryTransport`: tool annotations, dry_run, guardrail rejection,
  unknown-tool handling).

### Changed

- `FuturesApi`, `SpotApi`, and `MarginApi` constructors now accept the full
  `RestClientOptions` (previously an ad-hoc inline type missing
  `maxRetries`/`retryBaseDelayMs`/etc.), so all `RestClient` options -
  including the new `safetyLimits` - can be passed when constructing these
  classes directly, not just through `CoinDCXClient`.

## [1.1.0] - 2026-08-24

### Added

- **Native MCP server** (`src/mcp/server.ts`, `bin/mcp.ts`) - a standalone
  stdio MCP server wrapping the existing tool toolkits (`createAllToolkits`),
  for use directly from Claude Desktop, Cursor, or any other MCP host.
  Published via two bin entries: `coindcx-mcp` and `mcp` (so
  `npx @nemesis-oss/coindcx-sdk mcp` works), plus `npm run mcp` for local
  development.
- `suggestedAction` on every `CoinDCXError` subclass - a short, actionable
  hint (e.g. "check balance via client.spot.getBalances()") aimed at
  agent/LLM callers so they can recover from a failure autonomously.
  Existing error classes and guards (`isRetryableError`,
  `isAuthenticationError`, `isInsufficientMarginError`, etc.) are unchanged.
- `@modelcontextprotocol/sdk` dependency (required by the new MCP server).

### Changed

- POST/DELETE requests that carry a `client_order_id` (auto-generated for
  every order-create call) are now retried on 429/5xx like GETs, instead of
  always failing fast. This is safe because CoinDCX rejects a reused
  `client_order_id` rather than executing it twice, so a retry either
  succeeds (the original request never reached the exchange) or surfaces a
  duplicate-id error - it never double-submits an order. Writes without a
  `client_order_id` still fail fast, unchanged from prior behavior.

## [1.0.0] - Initial release

Production-grade TypeScript SDK for CoinDCX Spot, Margin, and Futures
trading with Socket.IO WebSocket support, a local paper-trading engine,
risk ops (position sizing, bracket orders, account snapshots), and
Zod-free JSON-Schema toolkits for LLM/agent tool use.
