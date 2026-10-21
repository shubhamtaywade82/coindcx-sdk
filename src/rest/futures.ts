import { RestClient } from '../core/rest-client';
import { RestClientOptions } from '../core/types';
import { assertWithinOrderLimits } from '../core/safety';
import {
  CreateFuturesOrderRequest,
  ListFuturesOrdersRequest,
  GetFuturesOrderRequest,
  CancelFuturesOrderRequest,
  CancelAllFuturesOrdersRequest,
  EditFuturesOrderRequest,
  GetFuturesPositionsRequest,
  CloseFuturesPositionRequest,
  ExitFuturesPositionRequest,
  CreateFuturesTPSLRequest,
  UpdateFuturesMarginTypeRequest,
  UpdateLeverageRequest,
  GetFuturesTradesRequest,
  AddFuturesMarginRequest,
  RemoveFuturesMarginRequest,
  CancelAllOrdersForPositionRequest,
  GetFuturesTransactionsRequest,
  GetFuturesCandlesticksRequest,
  CurrencyConversionResponse,
  FuturesOrderResponse,
  PositionResponse,
  FuturesWalletResponse,
  FuturesWalletTransactionResponse,
  InstrumentResponse,
  CandleResponse,
  OrderBookResponse,
  TradeResponse,
  TickerResponse,
  FundingRateResponse,
  FuturesStatsResponse,
  WalletTransferResponse,
} from '../models';

export class FuturesApi extends RestClient {
  constructor(options?: RestClientOptions) {
    super(options);
  }

  async createOrder(params: CreateFuturesOrderRequest): Promise<FuturesOrderResponse> {
    const total_quantity = params.total_quantity ?? params.target_quantity ?? 0;
    assertWithinOrderLimits({ quantity: total_quantity, price: params.price }, this.safetyLimits);
    const client_order_id = params.client_order_id ?? `js_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pair = params.pair ?? (params.base_currency && params.quote_currency ? `B-${params.base_currency}_${params.quote_currency}` : undefined);
    const payload: any = {
      ...params,
      client_order_id,
      notification: params.notification ?? 'no_notification',
    };
    if (pair) payload.pair = pair;
    if (total_quantity !== undefined) payload.total_quantity = total_quantity;
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders/create', payload);
  }

  async listOrders(params: ListFuturesOrdersRequest = {}): Promise<FuturesOrderResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders', params);
  }

  async getOrder(params: GetFuturesOrderRequest): Promise<FuturesOrderResponse> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders/details', params);
  }

  async cancelOrder(params: CancelFuturesOrderRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders/cancel', params);
  }

  async cancelAllOrders(params: CancelAllFuturesOrdersRequest = {}): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders/cancel_all', params);
  }

  async cancelAllOpenOrders(marginCurrency = 'USDT'): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/cancel_all_open_orders', { margin_currency_short_name: marginCurrency });
  }

  async editOrder(params: EditFuturesOrderRequest): Promise<FuturesOrderResponse> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/orders/edit', params);
  }

  async getPositions(params: GetFuturesPositionsRequest = {}): Promise<PositionResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions', params);
  }

  async closePosition(params: CloseFuturesPositionRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/exit', params);
  }

  async exitPosition(params: ExitFuturesPositionRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/exit', params);
  }

  async createTPSL(params: CreateFuturesTPSLRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/create_tpsl', params);
  }

  async getCrossMarginDetails(): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/cross_margin_details', {});
  }

  async updateMarginType(params: UpdateFuturesMarginTypeRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/margin_type', params);
  }

  async updateLeverage(params: UpdateLeverageRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/update_leverage', params);
  }

  async getTrades(params: GetFuturesTradesRequest = {}): Promise<any[]> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/trades', params);
  }

  async addMargin(params: AddFuturesMarginRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/add_margin', params);
  }

  async removeMargin(params: RemoveFuturesMarginRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/remove_margin', params);
  }

  async cancelAllOrdersForPosition(params: CancelAllOrdersForPositionRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/cancel_all_open_orders_for_position', params);
  }

  async getTransactions(params: GetFuturesTransactionsRequest = {}): Promise<any[]> {
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/positions/transactions', params);
  }

  async getWallet(): Promise<FuturesWalletResponse[]> {
    return this.signedRequest('GET', '/exchange/v1/derivatives/futures/wallets', {});
  }

  async getWalletTransactions(): Promise<FuturesWalletTransactionResponse[]> {
    return this.signedRequest('GET', '/exchange/v1/derivatives/futures/wallets/transactions', {});
  }

  async walletTransfer(params: {
    transfer_type: 'deposit' | 'withdraw' | 'spot_to_futures' | 'futures_to_spot';
    currency_short_name: string;
    amount: number;
  }): Promise<WalletTransferResponse> {
    const transfer_type = (params.transfer_type === 'spot_to_futures' || params.transfer_type === 'deposit') ? 'deposit' : 'withdraw';
    return this.signedRequest('POST', '/exchange/v1/derivatives/futures/wallets/transfer', {
      transfer_type,
      currency_short_name: params.currency_short_name,
      amount: params.amount,
    });
  }

  async getActiveInstruments(marginCurrency = 'USDT'): Promise<string[]> {
    return this.unsignedRequest('GET', '/exchange/v1/derivatives/futures/data/active_instruments', { margin_currency: marginCurrency });
  }

  async getMarketsDetails(): Promise<InstrumentResponse[]> {
    return this.unsignedRequest('GET', '/exchange/v1/markets_details', {}, true);
  }

  async getInstrumentDetails(pair: string): Promise<InstrumentResponse> {
    const all = await this.getMarketsDetails();
    const found = all.find(m => m.pair === pair || m.symbol === pair);
    if (found) return found;
    const activeFutures = await this.getActiveInstruments();
    if (activeFutures.includes(pair)) {
      return {
        pair,
        symbol: pair.split('-')[1]?.replace('_', '') ?? '',
        ecode: pair.split('-')[0],
        base_currency: pair.split('-')[1]?.split('_')[0],
        quote_currency: pair.split('_')[1],
        margin_currency: 'USDT',
        status: 'active',
        type: 'futures',
        min_quantity: undefined,
        max_quantity: undefined,
        min_price: undefined,
        max_price: undefined,
        tick_size: undefined,
        lot_size: undefined,
        max_leverage: undefined,
        maintenance_margin: undefined,
        initial_margin: undefined,
      };
    }
    throw new Error(`Instrument ${pair} not found`);
  }

  async getFuturesInstrument(pair: string, marginCurrency = 'USDT'): Promise<InstrumentResponse> {
    return this.unsignedRequest('GET', '/exchange/v1/derivatives/futures/data/instrument', {
      pair,
      margin_currency_short_name: marginCurrency,
    });
  }

  async getCandles(pair: string, interval: string, limit = 500, startTime?: number, endTime?: number): Promise<CandleResponse[]> {
    const params: any = { pair, interval, limit };
    if (startTime) params.startTime = startTime * 1000;
    if (endTime) params.endTime = endTime * 1000;
    const res = await this.unsignedRequest('GET', '/market_data/candles', params, true);
    return Array.isArray(res) ? res.reverse() : (res as CandleResponse[]);
  }

  async getFuturesCandles(params: GetFuturesCandlesticksRequest): Promise<any> {
    return this.unsignedRequest('GET', '/market_data/candlesticks', { ...params, pcode: params.pcode ?? 'f' }, true);
  }

  async getTradeHistory(pair: string, limit = 50): Promise<TradeResponse[]> {
    return this.unsignedRequest('GET', '/market_data/trade_history', { pair, limit }, true);
  }

  async getFuturesTrades(pair: string): Promise<any> {
    return this.unsignedRequest('GET', '/exchange/v1/derivatives/futures/data/trades', { pair });
  }

  async getOrderBook(pair: string, depth = 50): Promise<OrderBookResponse> {
    return this.unsignedRequest('GET', '/market_data/orderbook', { pair, depth }, true);
  }

  async getFuturesOrderBook(pair: string, depth = 50): Promise<any> {
    return this.unsignedRequest('GET', `/market_data/v3/orderbook/${pair}-futures/${depth}`, {}, true);
  }

  async getTicker(): Promise<TickerResponse[]> {
    return this.unsignedRequest('GET', '/exchange/ticker', {}, true);
  }

  async getCurrentPricesRT(): Promise<any> {
    return this.unsignedRequest('GET', '/market_data/v3/current_prices/futures/rt', {}, true);
  }

  async getFundingRateHistory(pair: string, limit = 50): Promise<FundingRateResponse[]> {
    return this.unsignedRequest('GET', '/exchange/v1/derivatives/futures/data/funding_rate', { pair, limit }, true);
  }

  async getStats(pair?: string): Promise<FuturesStatsResponse> {
    if (pair) {
      return this.signedRequest('POST', `/api/v1/derivatives/futures/data/stats?pair=${pair}`, {});
    }
    return this.unsignedRequest('GET', '/api/v1/derivatives/futures/data/stats', {}, true);
  }

  async getCurrencyConversions(): Promise<CurrencyConversionResponse> {
    return this.signedRequest('POST', '/api/v1/derivatives/futures/data/conversions', {});
  }
}