import { z } from 'zod';

export const OrderSideSchema = z.enum(['buy', 'sell']);
export const OrderTypeSchema = z.enum(['market_order', 'limit_order', 'stop_limit_order']);
export const TimeInForceSchema = z.enum(['gtc', 'ioc', 'fok', 'post_only']);
export const MarginTypeSchema = z.enum(['isolated', 'cross']);
export const PositionSideSchema = z.enum(['long', 'short']);
export const WalletTypeSchema = z.enum(['spot', 'margin', 'futures', 'lending']);

export const PairSchema = z.string().regex(/^[A-Z]-[A-Z0-9]+_[A-Z0-9]+$/);
export const SymbolSchema = z.string().regex(/^[A-Z0-9]+$/);
export const PriceSchema = z.number().positive().or(z.string().regex(/^\d+(\.\d+)?$/)).transform(v => Number(v));
export const QuantitySchema = z.number().positive().or(z.string().regex(/^\d+(\.\d+)?$/)).transform(v => Number(v));
export const LeverageSchema = z.number().int().min(1).max(100);

export const CreateOrderRequestSchema = z.object({
  side: OrderSideSchema,
  order_type: OrderTypeSchema,
  market: PairSchema,
  price: PriceSchema.optional(),
  quantity: QuantitySchema,
  client_order_id: z.string().optional(),
  time_in_force: TimeInForceSchema.optional(),
  trigger_price: PriceSchema.optional(),
  stop_loss: PriceSchema.optional(),
  take_profit: PriceSchema.optional(),
});

export const CreateFuturesOrderRequestSchema = z.object({
  side: OrderSideSchema,
  order_type: z.string(),
  pair: z.string().optional(),
  base_currency: SymbolSchema.optional(),
  quote_currency: SymbolSchema.optional(),
  target_quantity: QuantitySchema.optional(),
  total_quantity: QuantitySchema.optional(),
  price: PriceSchema.optional(),
  stop_price: PriceSchema.optional(),
  leverage: LeverageSchema.optional(),
  client_order_id: z.string().optional(),
  time_in_force: z.string().optional(),
  stop_loss: PriceSchema.optional(),
  take_profit: PriceSchema.optional(),
  margin_type: MarginTypeSchema.optional(),
  position_margin_type: z.enum(['isolated', 'crossed']).optional(),
  notification: z.enum(['no_notification', 'email_notification']).optional(),
  margin_currency_short_name: z.string().optional(),
});

export const CandleSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  open_time: z.number(),
  close_time: z.number(),
  pair: z.string().optional(),
  symbol: z.string().optional(),
});

export const OrderBookLevelSchema = z.object({
  price: z.number(),
  quantity: z.number(),
});

export const OrderBookSchema = z.object({
  timestamp: z.number().optional(),
  bids: z.array(OrderBookLevelSchema),
  asks: z.array(OrderBookLevelSchema),
});

export const TradeSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
  quantity: z.number(),
  is_maker: z.boolean().optional(),
  symbol: z.string().optional(),
});

export const TickerSchema = z.object({
  pair: z.string(),
  symbol: z.string().optional(),
  last_price: z.number(),
  bid_price: z.number().optional(),
  ask_price: z.number().optional(),
  high_24h: z.number().optional(),
  low_24h: z.number().optional(),
  volume_24h: z.number().optional(),
  change_24h: z.number().optional(),
  timestamp: z.number().optional(),
});

export const BalanceSchema = z.object({
  currency: z.string(),
  balance: z.number().or(z.string().transform(v => Number(v))),
  locked_balance: z.number().or(z.string().transform(v => Number(v))).optional(),
  available_balance: z.number().or(z.string().transform(v => Number(v))).optional(),
  wallet_type: z.string().optional(),
});

export const PositionSchema = z.object({
  id: z.string().or(z.number()),
  pair: z.string(),
  side: PositionSideSchema,
  size: z.number().or(z.string().transform(v => Number(v))),
  entry_price: z.number().or(z.string().transform(v => Number(v))),
  mark_price: z.number().or(z.string().transform(v => Number(v))).optional(),
  liquidation_price: z.number().or(z.string().transform(v => Number(v))).nullable().optional(),
  unrealized_pnl: z.number().or(z.string().transform(v => Number(v))).optional(),
  realized_pnl: z.number().or(z.string().transform(v => Number(v))).optional(),
  leverage: z.number().optional(),
  margin_type: MarginTypeSchema.optional(),
  margin: z.number().or(z.string().transform(v => Number(v))).optional(),
  timestamp: z.number().optional(),
});

export const OrderSchema = z.object({
  id: z.string().or(z.number()),
  client_order_id: z.string().optional(),
  pair: z.string().optional(),
  base_currency: z.string().optional(),
  quote_currency: z.string().optional(),
  side: OrderSideSchema,
  order_type: OrderTypeSchema,
  price: z.number().or(z.string().transform(v => Number(v))).optional(),
  quantity: z.number().or(z.string().transform(v => Number(v))),
  filled_quantity: z.number().or(z.string().transform(v => Number(v))).optional(),
  remaining_quantity: z.number().or(z.string().transform(v => Number(v))).optional(),
  status: z.string(),
  time_in_force: TimeInForceSchema.optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  stop_loss: z.number().or(z.string().transform(v => Number(v))).nullable().optional(),
  take_profit: z.number().or(z.string().transform(v => Number(v))).nullable().optional(),
  leverage: z.number().optional(),
  margin_type: MarginTypeSchema.optional(),
});

export const FundingRateSchema = z.object({
  pair: z.string(),
  funding_rate: z.number().or(z.string().transform(v => Number(v))),
  timestamp: z.number(),
  next_funding_time: z.number().optional(),
});

export const InstrumentSchema = z.object({
  pair: z.string(),
  symbol: z.string().optional(),
  ecode: z.string().optional(),
  base_currency: z.string().optional(),
  quote_currency: z.string().optional(),
  margin_currency: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  min_quantity: z.number().optional(),
  max_quantity: z.number().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  tick_size: z.number().optional(),
  lot_size: z.number().optional(),
  max_leverage: z.number().optional(),
  maintenance_margin: z.number().optional(),
  initial_margin: z.number().optional(),
});

export const WalletTransactionSchema = z.object({
  id: z.string().or(z.number()),
  currency: z.string(),
  amount: z.number().or(z.string().transform(v => Number(v))),
  type: z.string(),
  status: z.string(),
  timestamp: z.number(),
  fee: z.number().optional(),
  txid: z.string().optional(),
});

export const WsCandleDataSchema = z.object({
  channel: z.string().optional(),
  product: z.string().optional(),
  eventTime: z.number().optional(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  openTime: z.number(),
  closeTime: z.number(),
  pair: z.string().optional(),
  symbol: z.string().optional(),
});

export const WsDepthDataSchema = z.object({
  timestamp: z.number().optional(),
  bids: z.record(z.string(), z.number().or(z.string())),
  asks: z.record(z.string(), z.number().or(z.string())),
});

export const WsTradeDataSchema = z.object({
  timestamp: z.number(),
  price: z.number().or(z.string().transform(v => Number(v))),
  quantity: z.number().or(z.string().transform(v => Number(v))),
  isMaker: z.boolean().optional(),
  symbol: z.string().optional(),
});

export const WsOrderUpdateSchema = z.object({
  id: z.string().or(z.number()),
  client_order_id: z.string().optional(),
  pair: z.string().optional(),
  side: OrderSideSchema,
  order_type: OrderTypeSchema,
  price: z.number().or(z.string().transform(v => Number(v))).optional(),
  quantity: z.number().or(z.string().transform(v => Number(v))),
  filled_quantity: z.number().or(z.string().transform(v => Number(v))).optional(),
  status: z.string(),
  timestamp: z.number().optional(),
});

export const WsPositionUpdateSchema = z.object({
  id: z.string().or(z.number()),
  pair: z.string(),
  side: PositionSideSchema,
  size: z.number().or(z.string().transform(v => Number(v))),
  entry_price: z.number().or(z.string().transform(v => Number(v))),
  mark_price: z.number().or(z.string().transform(v => Number(v))).optional(),
  unrealized_pnl: z.number().or(z.string().transform(v => Number(v))).optional(),
  timestamp: z.number().optional(),
});

export const WsBalanceUpdateSchema = z.object({
  currency: z.string(),
  balance: z.number().or(z.string().transform(v => Number(v))),
  locked_balance: z.number().or(z.string().transform(v => Number(v))).optional(),
  available_balance: z.number().or(z.string().transform(v => Number(v))).optional(),
  wallet_type: z.string().optional(),
  timestamp: z.number().optional(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type CreateFuturesOrderRequest = z.infer<typeof CreateFuturesOrderRequestSchema>;
export type Candle = z.infer<typeof CandleSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type FundingRate = z.infer<typeof FundingRateSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;
export type WsCandleData = z.infer<typeof WsCandleDataSchema>;
export type WsDepthData = z.infer<typeof WsDepthDataSchema>;
export type WsTradeData = z.infer<typeof WsTradeDataSchema>;
export type WsOrderUpdate = z.infer<typeof WsOrderUpdateSchema>;
export type WsPositionUpdate = z.infer<typeof WsPositionUpdateSchema>;
export type WsBalanceUpdate = z.infer<typeof WsBalanceUpdateSchema>;