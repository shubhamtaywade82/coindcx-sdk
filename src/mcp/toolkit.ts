import { CoinDCXClient } from '../index';
import { CreateFuturesOrderRequest, CreateSpotOrderRequest } from '../models';
import { PositionSizingParams, BracketOrderParams } from '../ops';
import { assertWithinOrderLimits } from '../core/safety';

/**
 * MCP `ToolAnnotations` hints (see modelcontextprotocol.io) surfaced to MCP
 * hosts so they can gate risky calls - e.g. require user confirmation
 * before a `destructiveHint: true` tool executes. These are hints, not
 * enforcement: they inform a host's UI, they don't block anything on their
 * own. Order-creation tools should always be `destructiveHint: true`.
 */
export interface MCPToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  annotations?: MCPToolAnnotations;
  handler: (args: any) => Promise<any>;
}

const DRY_RUN_SCHEMA = {
  dry_run: {
    type: 'boolean',
    description: 'If true, validate the order (including configured safety limits) and return what would be submitted, without actually placing it.',
    default: false,
  },
};

export function createFuturesToolkit(client: CoinDCXClient): MCPTool[] {
  return [
    {
      name: 'futures_create_order',
      description: 'Create a futures order on CoinDCX. Places real capital at risk unless dry_run is set or the client is in paper mode.',
      annotations: { title: 'Create Futures Order', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['buy', 'sell'], description: 'Order side' },
          order_type: { type: 'string', enum: ['market_order', 'limit_order', 'stop_limit_order'], description: 'Order type' },
          base_currency: { type: 'string', description: 'Base currency (e.g., SOL)' },
          quote_currency: { type: 'string', description: 'Quote currency (e.g., USDT)' },
          target_quantity: { type: 'number', description: 'Quantity to trade' },
          price: { type: 'number', description: 'Limit price (required for limit orders)' },
          leverage: { type: 'number', description: 'Leverage (1-100)', minimum: 1, maximum: 100 },
          stop_loss: { type: 'number', description: 'Stop loss price' },
          take_profit: { type: 'number', description: 'Take profit price' },
          margin_type: { type: 'string', enum: ['isolated', 'cross'], description: 'Margin type' },
          ...DRY_RUN_SCHEMA,
        },
        required: ['side', 'order_type', 'base_currency', 'quote_currency', 'target_quantity'],
      },
      handler: async (args: CreateFuturesOrderRequest & { dry_run?: boolean }) => {
        const { dry_run, ...order } = args;
        if (dry_run) {
          assertWithinOrderLimits({ quantity: order.total_quantity ?? order.target_quantity ?? 0, price: order.price }, client.getSafetyLimits());
          return { dryRun: true, wouldSubmit: order, message: 'Validation passed; no order was submitted (dry_run=true).' };
        }
        return client.futures.trading.createOrder(order);
      },
    },
    {
      name: 'futures_get_positions',
      description: 'Get all open futures positions',
      annotations: { title: 'Get Futures Positions', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Filter by pair (e.g., B-SOL_USDT)' },
        },
      },
      handler: async (args: { pair?: string }) => {
        return client.futures.trading.getPositions(args);
      },
    },
    {
      name: 'futures_close_position',
      description: 'Close a futures position by pair. Irreversible - realizes the position\'s current PnL.',
      annotations: { title: 'Close Futures Position', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair to close (e.g., B-SOL_USDT)' },
        },
        required: ['pair'],
      },
      handler: async (args: { pair: string }) => {
        return client.futures.trading.exitPosition({ pair: args.pair });
      },
    },
    {
      name: 'futures_get_balance',
      description: 'Get futures wallet balance',
      annotations: { title: 'Get Futures Balance', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.futures.account.getWallet();
      },
    },
    {
      name: 'futures_get_ticker',
      description: 'Get futures ticker for a pair',
      annotations: { title: 'Get Futures Ticker', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
        },
        required: ['pair'],
      },
      handler: async (args: { pair: string }) => {
        const tickers = await client.futures.market.getTicker();
        return tickers.find((t: any) => t.pair === args.pair);
      },
    },
    {
      name: 'futures_get_klines',
      description: 'Get futures candlestick data',
      annotations: { title: 'Get Futures Candles', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
          interval: { type: 'string', description: 'Interval (1m, 5m, 15m, 1h, 4h, 1d)' },
          limit: { type: 'number', description: 'Number of candles', default: 100 },
        },
        required: ['pair', 'interval'],
      },
      handler: async (args: { pair: string; interval: string; limit?: number }) => {
        return client.futures.market.getCandles(args.pair, args.interval, args.limit || 100);
      },
    },
    {
      name: 'futures_place_bracket_order',
      description: 'Place a bracket order (entry + stop loss + take profit). Places real capital at risk unless dry_run is set or the client is in paper mode.',
      annotations: { title: 'Place Bracket Order', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          quantity: { type: 'number', description: 'Quantity to trade' },
          entryPrice: { type: 'number', description: 'Entry price (optional, market if not provided)' },
          stopLoss: { type: 'number', description: 'Stop loss price' },
          takeProfit: { type: 'number', description: 'Take profit price' },
          leverage: { type: 'number', description: 'Leverage', minimum: 1, maximum: 100 },
          ...DRY_RUN_SCHEMA,
        },
        required: ['pair', 'side', 'quantity', 'stopLoss', 'takeProfit'],
      },
      handler: async (args: BracketOrderParams & { dry_run?: boolean }) => {
        const { dry_run, ...order } = args;
        if (dry_run) {
          assertWithinOrderLimits({ quantity: order.quantity, price: order.entryPrice }, client.getSafetyLimits());
          return { dryRun: true, wouldSubmit: order, message: 'Validation passed; no order was submitted (dry_run=true).' };
        }
        return client.ops.bracket.placeBracketOrder(order);
      },
    },
    {
      name: 'futures_calculate_position_size',
      description: 'Calculate position size based on risk parameters',
      annotations: { title: 'Calculate Position Size', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          accountBalance: { type: 'number', description: 'Account balance in USDT' },
          riskPercent: { type: 'number', description: 'Risk percentage per trade (e.g., 2 for 2%)' },
          entryPrice: { type: 'number', description: 'Planned entry price' },
          stopLossPrice: { type: 'number', description: 'Stop loss price' },
          leverage: { type: 'number', description: 'Leverage', minimum: 1, maximum: 100 },
          maxPositionSize: { type: 'number', description: 'Maximum position size' },
        },
        required: ['accountBalance', 'riskPercent', 'entryPrice', 'stopLossPrice', 'leverage'],
      },
      handler: async (args: PositionSizingParams) => {
        return client.ops.sizing.calculatePositionSize(args);
      },
    },
    {
      name: 'futures_get_orderbook',
      description: 'Get futures order book depth',
      annotations: { title: 'Get Futures Order Book', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
          depth: { type: 'number', description: 'Order book depth', default: 20 },
        },
        required: ['pair'],
      },
      handler: async (args: { pair: string; depth?: number }) => {
        return client.futures.market.getOrderBook(args.pair, args.depth || 20);
      },
    },
    {
      name: 'futures_update_leverage',
      description: 'Update leverage for a futures pair. Changes account risk parameters for future orders on this pair.',
      annotations: { title: 'Update Leverage', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
          leverage: { type: 'number', description: 'New leverage (1-100)', minimum: 1, maximum: 100 },
        },
        required: ['pair', 'leverage'],
      },
      handler: async (args: { pair: string; leverage: number }) => {
        return client.futures.trading.updateLeverage({ pair: args.pair, leverage: args.leverage });
      },
    },
    {
      name: 'futures_get_funding_rate',
      description: 'Get funding rate history for a pair',
      annotations: { title: 'Get Funding Rate History', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
          limit: { type: 'number', description: 'Number of records', default: 50 },
        },
        required: ['pair'],
      },
      handler: async (args: { pair: string; limit?: number }) => {
        return client.futures.market.getFundingRateHistory(args.pair, args.limit || 50);
      },
    },
  ];
}

export function createSpotToolkit(client: CoinDCXClient): MCPTool[] {
  return [
    {
      name: 'spot_create_order',
      description: 'Create a spot order on CoinDCX. Places real capital at risk unless dry_run is set or the client is in paper mode.',
      annotations: { title: 'Create Spot Order', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['buy', 'sell'] },
          order_type: { type: 'string', enum: ['market_order', 'limit_order', 'stop_limit_order'] },
          market: { type: 'string', description: 'Market pair (e.g., BTC_USDT)' },
          price: { type: 'number', description: 'Limit price' },
          quantity: { type: 'number', description: 'Quantity to trade' },
          ...DRY_RUN_SCHEMA,
        },
        required: ['side', 'order_type', 'market', 'quantity'],
      },
      handler: async (args: CreateSpotOrderRequest & { dry_run?: boolean }) => {
        const { dry_run, ...order } = args;
        if (dry_run) {
          assertWithinOrderLimits({ quantity: order.total_quantity ?? order.quantity ?? 0, price: order.price_per_unit ?? order.price }, client.getSafetyLimits());
          return { dryRun: true, wouldSubmit: order, message: 'Validation passed; no order was submitted (dry_run=true).' };
        }
        return client.spot.createOrder(order);
      },
    },
    {
      name: 'spot_get_balances',
      description: 'Get spot wallet balances',
      annotations: { title: 'Get Spot Balances', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.spot.getBalances();
      },
    },
    {
      name: 'spot_get_ticker',
      description: 'Get spot ticker',
      annotations: { title: 'Get Spot Ticker', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          market: { type: 'string', description: 'Market pair (e.g., BTC_USDT)' },
        },
        required: ['market'],
      },
      handler: async (args: { market: string }) => {
        const tickers = await client.marketData.getSpotTicker();
        return tickers.find((t: any) => t.pair === args.market);
      },
    },
  ];
}

export function createMarketDataToolkit(client: CoinDCXClient): MCPTool[] {
  return [
    {
      name: 'market_get_instruments',
      description: 'Get all active futures instruments',
      annotations: { title: 'Get Active Instruments', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          marginCurrency: { type: 'string', description: 'Margin currency', default: 'USDT' },
        },
      },
      handler: async (args: { marginCurrency?: string }) => {
        return client.futures.market.getActiveInstruments(args.marginCurrency || 'USDT');
      },
    },
    {
      name: 'market_get_instrument_details',
      description: 'Get detailed instrument information',
      annotations: { title: 'Get Instrument Details', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          pair: { type: 'string', description: 'Pair (e.g., B-SOL_USDT)' },
        },
        required: ['pair'],
      },
      handler: async (args: { pair: string }) => {
        return client.futures.market.getInstrumentDetails(args.pair);
      },
    },
  ];
}

export function createAccountToolkit(client: CoinDCXClient): MCPTool[] {
  return [
    {
      name: 'account_get_overview',
      description: 'Get complete account overview (balances, positions, equity)',
      annotations: { title: 'Get Account Overview', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.ops.snapshot.getAccountOverview();
      },
    },
    {
      name: 'account_get_balances',
      description: 'Get all wallet balances',
      annotations: { title: 'Get All Balances', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const [spot, futures] = await Promise.all([
          client.spot.getBalances(),
          client.futures.account.getWallet(),
        ]);
        return { spot, futures };
      },
    },
    {
      name: 'account_get_safety_limits',
      description: 'Get the order-size guardrails currently configured on this client (maxOrderQuantity / maxOrderNotional). Check this before sizing an order.',
      annotations: { title: 'Get Safety Limits', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.getSafetyLimits() ?? { maxOrderQuantity: null, maxOrderNotional: null, note: 'No safety limits configured - orders of any size will be forwarded to the exchange.' };
      },
    },
  ];
}

export function createPaperToolkit(client: CoinDCXClient): MCPTool[] {
  return [
    {
      name: 'paper_place_order',
      description: 'Place a paper trading order (simulated, no real funds)',
      annotations: { title: 'Place Paper Order', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['buy', 'sell'] },
          order_type: { type: 'string', enum: ['market_order', 'limit_order', 'stop_limit_order'] },
          base_currency: { type: 'string' },
          quote_currency: { type: 'string' },
          target_quantity: { type: 'number' },
          price: { type: 'number' },
          leverage: { type: 'number' },
          stop_loss: { type: 'number' },
          take_profit: { type: 'number' },
          ...DRY_RUN_SCHEMA,
        },
        required: ['side', 'order_type', 'base_currency', 'quote_currency', 'target_quantity'],
      },
      handler: async (args: CreateFuturesOrderRequest & { dry_run?: boolean }) => {
        const { dry_run, ...order } = args;
        assertWithinOrderLimits({ quantity: order.total_quantity ?? order.target_quantity ?? 0, price: order.price }, client.getSafetyLimits());
        if (dry_run) {
          return { dryRun: true, wouldSubmit: order, message: 'Validation passed; no paper order was submitted (dry_run=true).' };
        }
        return client.paper.placeOrder(order);
      },
    },
    {
      name: 'paper_get_account',
      description: 'Get paper trading account status',
      annotations: { title: 'Get Paper Account', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.paper.getAccount();
      },
    },
    {
      name: 'paper_get_positions',
      description: 'Get paper trading positions',
      annotations: { title: 'Get Paper Positions', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        return client.paper.getPositions();
      },
    },
    {
      name: 'paper_reset',
      description: 'Reset paper trading engine. Irreversibly wipes the simulated account back to its initial balance.',
      annotations: { title: 'Reset Paper Engine', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          initialBalance: { type: 'number' },
        },
      },
      handler: async (args: { initialBalance?: number }) => {
        client.paper.reset(args.initialBalance ? { initialBalance: args.initialBalance } : undefined);
        return { success: true };
      },
    },
  ];
}

export function createAllToolkits(client: CoinDCXClient): MCPTool[] {
  return [
    ...createFuturesToolkit(client),
    ...createSpotToolkit(client),
    ...createMarketDataToolkit(client),
    ...createAccountToolkit(client),
    ...createPaperToolkit(client),
  ];
}
