import { RestClient } from '../core/rest-client';
import {
  GetSpotCandlesRequest,
  GetSpotTradeHistoryRequest,
  GetSpotOrderBookRequest,
  CandleResponse,
  TradeResponse,
  OrderBookResponse,
  TickerResponse,
  InstrumentResponse,
} from '../models';

export class MarketDataApi extends RestClient {
  constructor(options?: { baseUrl?: string }) {
    super({ baseUrl: options?.baseUrl ?? 'https://public.coindcx.com', paperMode: false });
  }

  async getSpotCandles(params: GetSpotCandlesRequest): Promise<CandleResponse[]> {
    const { pair, interval = '1m', startTime, endTime, limit = 500 } = params;
    const queryParams: any = { pair, interval, limit };
    if (startTime) queryParams.startTime = startTime;
    if (endTime) queryParams.endTime = endTime;
    const res = await this.unsignedRequest('GET', '/market_data/candles', queryParams, true);
    return Array.isArray(res) ? res.reverse() : (res as CandleResponse[]);
  }

  async getSpotTradeHistory(params: GetSpotTradeHistoryRequest): Promise<TradeResponse[]> {
    return this.unsignedRequest('GET', '/market_data/trade_history', params, true);
  }

  async getSpotOrderBook(params: GetSpotOrderBookRequest): Promise<OrderBookResponse> {
    return this.unsignedRequest('GET', '/market_data/orderbook', params, true);
  }

  async getSpotTicker(): Promise<TickerResponse[]> {
    return this.unsignedRequest('GET', '/exchange/ticker', {}, true);
  }

  async getMarkets(): Promise<string[]> {
    return this.unsignedRequest('GET', '/exchange/v1/markets', {}, true);
  }

  async getMarketsDetails(): Promise<InstrumentResponse[]> {
    return this.unsignedRequest('GET', '/exchange/v1/markets_details', {}, true);
  }

  async getFuturesCandles(pair: string, interval: string, limit = 500, startTime?: number, endTime?: number): Promise<CandleResponse[]> {
    const params: any = { pair, interval, limit };
    if (startTime) params.startTime = startTime * 1000;
    if (endTime) params.endTime = endTime * 1000;
    const res = await this.unsignedRequest('GET', '/market_data/candles', params, true);
    return Array.isArray(res) ? res.reverse() : (res as CandleResponse[]);
  }

  async getFuturesTradeHistory(pair: string, limit = 50): Promise<TradeResponse[]> {
    return this.unsignedRequest('GET', '/market_data/trade_history', { pair, limit }, true);
  }

  async getFuturesOrderBook(pair: string, depth = 50): Promise<OrderBookResponse> {
    return this.unsignedRequest('GET', '/market_data/orderbook', { pair, depth }, true);
  }

  async getFuturesCandlesticks(params: { pair: string; from: number; to: number; resolution: string; pcode?: string }): Promise<any> {
    return this.unsignedRequest('GET', '/market_data/candlesticks', { ...params, pcode: params.pcode ?? 'f' }, true);
  }

  async getFuturesTrades(pair: string): Promise<any> {
    return this.unsignedRequest('GET', '/exchange/v1/derivatives/futures/data/trades', { pair });
  }

  async getFuturesV3OrderBook(pair: string, depth = 50): Promise<any> {
    return this.unsignedRequest('GET', `/market_data/v3/orderbook/${pair}-futures/${depth}`, {}, true);
  }

  async getFuturesCurrentPricesRT(): Promise<any> {
    return this.unsignedRequest('GET', '/market_data/v3/current_prices/futures/rt', {}, true);
  }

  static nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  static buildPair(base: string, target: string, ecode = 'B'): string {
    return `${ecode}-${base}_${target}`;
  }

  static parsePair(pair: string): { ecode: string; base: string; target: string } | null {
    const match = pair.match(/^([A-Z])-([A-Z0-9]+)_([A-Z0-9]+)$/);
    if (match) return { ecode: match[1]!, base: match[2]!, target: match[3]! };
    return null;
  }

  static calculateLiquidationPrice(entryPrice: number, leverage: number, side: string, mm = 0.005): number {
    const dir = side.toLowerCase() === 'buy' || side.toLowerCase() === 'long' ? 1 : -1;
    return dir === 1
      ? entryPrice * (1 - (1 / leverage) + mm)
      : entryPrice * (1 + (1 / leverage) - mm);
  }
}