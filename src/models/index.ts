// Enums are exported from core/types.ts
// These were duplicate definitions causing conflicts

export interface CreateSpotOrderRequest {
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order' | string;
  market: string;
  price?: number;
  price_per_unit?: number;
  quantity?: number;
  total_quantity?: number;
  client_order_id?: string;
  ecode?: string;
  time_in_force?: 'gtc' | 'ioc' | 'fok' | 'post_only';
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface CreateMultipleSpotOrdersRequest {
  orders: CreateSpotOrderRequest[];
}

export interface CreateFuturesOrderRequest {
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order' | 'market' | 'limit' | 'stop_limit' | 'stop_market' | 'take_profit_limit' | 'take_profit_market' | string;
  pair?: string;
  base_currency?: string;
  quote_currency?: string;
  target_quantity?: number;
  total_quantity?: number;
  price?: number | undefined;
  stop_price?: number | undefined;
  leverage?: number | undefined;
  client_order_id?: string | undefined;
  time_in_force?: 'gtc' | 'ioc' | 'fok' | 'post_only' | 'good_till_cancel' | 'fill_or_kill' | 'immediate_or_cancel' | undefined;
  stop_loss?: number | undefined;
  take_profit?: number | undefined;
  margin_type?: 'isolated' | 'cross' | undefined;
  position_margin_type?: 'isolated' | 'crossed' | undefined;
  notification?: 'no_notification' | 'email_notification';
  margin_currency_short_name?: string;
}

export interface CreateMarginOrderRequest {
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order' | string;
  market: string;
  price?: number;
  quantity: number;
  leverage?: number;
  ecode?: string;
  client_order_id?: string;
  time_in_force?: 'gtc' | 'ioc' | 'fok' | 'post_only';
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface EditOrderRequest {
  id: string | number;
  price?: number;
  price_per_unit?: number;
  client_order_id?: string;
}

export interface EditFuturesOrderRequest {
  id: string | number;
  price?: number;
  quantity?: number;
}

export interface CancelOrderRequest {
  id: string | number;
}

export interface CancelAllOrdersRequest {
  side?: 'buy' | 'sell';
  market?: string;
}

export interface CancelAllFuturesOrdersRequest {
  pair?: string;
  side?: 'buy' | 'sell';
  margin_currency_short_name?: string;
}

export interface CancelFuturesOrderRequest {
  id: string | number;
}

export interface GetOrderStatusRequest {
  id: string | number;
}

export interface GetOrderStatusMultipleRequest {
  ids: (string | number)[];
}

export interface GetActiveOrdersRequest {}

export interface GetUserSpotTradeHistoryRequest {
  market: string;
  limit?: number;
}

export interface CreateMarginOrderRequestFull extends CreateMarginOrderRequest {}

export interface CancelMarginOrderRequest {
  id: string | number;
}

export interface ExitMarginPositionRequest {
  id: string | number;
}

export interface EditMarginTargetRequest {
  id: string | number;
  target_price: number;
}

export interface EditMarginPriceOfTargetOrderRequest {
  id: string | number;
  price: number;
}

export interface EditMarginSLRequest {
  id: string | number;
  sl_price: number;
}

export interface EditMarginTrailingSLRequest {
  id: string | number;
  trailing_sl: number;
}

export interface AddMarginRequest {
  id: string | number;
  amount: number;
}

export interface RemoveMarginRequest {
  id: string | number;
  amount: number;
}

export interface FetchMarginOrdersRequest {
  market?: string;
  side?: 'buy' | 'sell';
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetMarginOrderRequest {
  id: string | number;
}

export interface FetchLendOrdersRequest {}

export interface LendRequest {
  currency?: string;
  currency_short_name?: string;
  amount: number;
  duration?: number;
  side?: 'lend' | 'borrow';
}

export interface SettleLendOrderRequest {
  id: string | number;
}

export interface ListFuturesOrdersRequest {
  pair?: string;
  side?: 'buy' | 'sell';
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetFuturesOrderRequest {
  id: string | number;
}

export interface EditFuturesOrderRequest {
  id: string | number;
  price?: number;
  quantity?: number;
}

export interface GetFuturesPositionsRequest {
  pair?: string;
  status?: string;
}

export interface CloseFuturesPositionRequest {
  id: string | number;
}

export interface ExitFuturesPositionRequest {
  pair: string;
}

export interface CreateFuturesTPSLRequest {
  position_id: string | number;
  stop_loss: number | undefined;
  take_profit: number | undefined;
}

export interface GetFuturesCrossMarginDetailsRequest {}

export interface UpdateFuturesMarginTypeRequest {
  pair: string;
  margin_type: 'isolated' | 'cross';
}

export interface UpdateLeverageRequest {
  pair: string;
  leverage: number;
}

export interface GetFuturesTradesRequest {
  pair?: string;
  side?: 'buy' | 'sell';
  limit?: number;
  offset?: number;
}

export interface AddFuturesMarginRequest {
  id: string | number;
  amount: number;
}

export interface RemoveFuturesMarginRequest {
  id: string | number;
  amount: number;
}

export interface CancelAllOrdersForPositionRequest {
  position_id: string | number;
}

export interface GetFuturesTransactionsRequest {
  pair?: string;
  limit?: number;
  offset?: number;
}

export interface GetBalancesRequest {}

export interface GetUserInfoRequest {}

export interface GetFuturesWalletRequest {}

export interface GetFuturesWalletTransactionsRequest {}

export interface FuturesWalletTransferRequest {
  transfer_type: 'deposit' | 'withdraw' | 'spot_to_futures' | 'futures_to_spot';
  currency_short_name: string;
  amount: number;
}

export interface CurrencyConversionResponse {
  symbol: string;
  margin_currency_short_name: string;
  target_currency_short_name: string;
  conversion_price: number;
  last_updated_at: number;
}

export interface GetFuturesCandlesticksRequest {
  pair: string;
  from: number;
  to: number;
  resolution: string;
  pcode?: string;
}

export interface WalletTransferRequest {
  source_wallet_type: 'spot' | 'margin' | 'futures' | 'lending';
  destination_wallet_type: 'spot' | 'margin' | 'futures' | 'lending';
  currency_short_name: string;
  amount: number;
}

export interface SubAccountTransferRequest {
  from_account_id: string;
  to_account_id: string;
  currency_short_name: string;
  amount: number;
}

export interface GetActiveInstrumentsRequest {
  margin_currency?: string;
}

export interface GetMarketsDetailsRequest {}

export interface GetInstrumentDetailsRequest {
  pair: string;
}

export interface GetFuturesCandlesRequest {
  pair: string;
  interval: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface GetFuturesTradeHistoryRequest {
  pair: string;
  limit?: number;
}

export interface GetFuturesOrderBookRequest {
  pair: string;
  depth?: number;
}

export interface GetTickerRequest {}

export interface GetFundingRateHistoryRequest {
  pair: string;
  limit?: number;
}

export interface GetFuturesStatsRequest {}

export interface GetSpotCandlesRequest {
  pair: string;
  interval?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface GetSpotTradeHistoryRequest {
  pair: string;
  limit?: number;
}

export interface GetSpotOrderBookRequest {
  pair: string;
  depth?: number;
}

export interface GetActiveOrdersCountRequest {}

export interface SpotOrderResponse {
  id: string | number;
  client_order_id?: string;
  market: string;
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order';
  price?: number;
  quantity: number;
  filled_quantity?: number;
  remaining_quantity?: number;
  status: string;
  time_in_force?: string;
  created_at: number;
  updated_at: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface FuturesOrderResponse {
  id: string | number;
  client_order_id: string | undefined;
  pair: string;
  base_currency: string;
  quote_currency: string;
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order';
  price: number | undefined;
  target_quantity: number;
  filled_quantity: number | undefined;
  remaining_quantity: number | undefined;
  status: string;
  time_in_force: string | undefined;
  created_at: number;
  updated_at: number;
  leverage: number | undefined;
  margin_type: 'isolated' | 'cross' | undefined;
  stop_loss: number | undefined;
  take_profit: number | undefined;
}

export interface MarginOrderResponse {
  id: string | number;
  client_order_id?: string;
  market: string;
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order';
  price?: number;
  quantity: number;
  filled_quantity?: number;
  remaining_quantity?: number;
  status: string;
  leverage?: number;
  time_in_force?: string;
  created_at: number;
  updated_at: number;
  target_price?: number;
  stop_loss?: number;
  trailing_sl?: number;
}

export interface BalanceResponse {
  currency: string;
  balance: number;
  locked_balance?: number;
  available_balance?: number;
  wallet_type?: string;
}

export interface UserInfoResponse {
  user_id: string;
  email: string;
  kyc_status: string;
  created_at: number;
}

export interface FuturesWalletResponse {
  currency: string;
  balance: number;
  locked_balance: number;
  available_balance: number;
}

export interface FuturesWalletTransactionResponse {
  id: string | number;
  currency: string;
  amount: number;
  type: string;
  status: string;
  timestamp: number;
  fee?: number;
  txid?: string;
}

export interface InstrumentResponse {
  pair: string;
  symbol: string | undefined;
  ecode: string | undefined;
  base_currency: string | undefined;
  quote_currency: string | undefined;
  margin_currency: string | undefined;
  status: string | undefined;
  type: string | undefined;
  min_quantity: number | undefined;
  max_quantity: number | undefined;
  min_price: number | undefined;
  max_price: number | undefined;
  tick_size: number | undefined;
  lot_size: number | undefined;
  max_leverage: number | undefined;
  maintenance_margin: number | undefined;
  initial_margin: number | undefined;
}

export interface CandleResponse {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_time: number;
  close_time: number;
  pair?: string;
  symbol?: string;
}

export interface OrderBookResponse {
  timestamp?: number;
  bids: Record<string, number | string>;
  asks: Record<string, number | string>;
}

export interface TradeResponse {
  timestamp: number;
  price: number;
  quantity: number;
  is_maker?: boolean;
  symbol?: string;
}

export interface TickerResponse {
  pair: string;
  symbol?: string;
  last_price: number;
  bid_price?: number;
  ask_price?: number;
  high_24h?: number;
  low_24h?: number;
  volume_24h?: number;
  change_24h?: number;
  timestamp?: number;
}

export interface FundingRateResponse {
  pair: string;
  funding_rate: number;
  timestamp: number;
  next_funding_time?: number;
}

export interface FuturesStatsResponse {
  total_volume_24h: number;
  total_open_interest: number;
  total_funding_paid_24h: number;
  top_gainers: any[];
  top_losers: any[];
}

export interface PositionResponse {
  id: string | number;
  pair: string;
  side: 'long' | 'short';
  size: number;
  entry_price: number;
  mark_price?: number;
  liquidation_price?: number | null;
  unrealized_pnl?: number;
  realized_pnl?: number;
  leverage?: number;
  margin_type?: 'isolated' | 'cross';
  margin?: number;
  timestamp?: number;
}

export interface MarginPositionResponse {
  id: string | number;
  market: string;
  side: 'buy' | 'sell';
  size: number;
  entry_price: number;
  current_price: number;
  target_price?: number;
  stop_loss?: number;
  trailing_sl?: number;
  pnl: number;
  leverage: number;
  margin: number;
  status: string;
  created_at: number;
}

export interface LendOrderResponse {
  id: string | number;
  currency: string;
  amount: number;
  side: 'lend' | 'borrow';
  rate: number;
  status: string;
  created_at: number;
  expires_at: number;
}

export interface WalletTransferResponse {
  id: string | number;
  status: string;
  timestamp: number;
}

export interface ActiveOrdersCountResponse {
  count: number;
}

export interface WsCandleData {
  channel?: string;
  product?: string;
  eventTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openTime: number;
  closeTime: number;
  pair?: string;
  symbol?: string;
}

export interface WsDepthData {
  timestamp?: number;
  bids: Record<string, number | string>;
  asks: Record<string, number | string>;
}

export interface WsTradeData {
  timestamp: number;
  price: number;
  quantity: number;
  isMaker?: boolean;
  symbol?: string;
}

export interface WsOrderUpdate {
  id: string | number;
  client_order_id: string | undefined;
  pair: string | undefined;
  side: 'buy' | 'sell';
  order_type: 'market_order' | 'limit_order' | 'stop_limit_order';
  price: number | undefined;
  quantity: number;
  filled_quantity: number | undefined;
  status: string;
  timestamp: number | undefined;
}

export interface WsPositionUpdate {
  id: string | number;
  pair: string;
  side: 'long' | 'short';
  size: number;
  entry_price: number;
  mark_price: number | undefined;
  unrealized_pnl: number | undefined;
  timestamp: number | undefined;
}

export interface WsBalanceUpdate {
  currency: string;
  balance: number;
  locked_balance: number | undefined;
  available_balance: number | undefined;
  wallet_type: string | undefined;
  timestamp: number | undefined;
}

export interface WsPriceChange {
  timestamp: number;
  price: number;
  symbol: string;
}

export interface WsBatchPrices {
  timestamp: number;
  prices: Record<string, {
    markPrice: number;
    bmST?: string;
    cmRT?: string;
  }>;
}