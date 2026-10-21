import { WsClient } from '../core/ws-client';
import { WsCandleData, WsDepthData, WsTradeData, WsPriceChange, WsBatchPrices } from '../models';
import { defaultLogger } from '../logger';

export interface PublicStreamCallbacks {
  onCandle?: (data: WsCandleData) => void;
  onDepthSnapshot?: (data: WsDepthData) => void;
  onDepthUpdate?: (data: WsDepthData) => void;
  onTrade?: (data: WsTradeData) => void;
  onPriceChange?: (data: WsPriceChange) => void;
  onBatchPrices?: (data: WsBatchPrices) => void;
  onSpotBatchPrices?: (data: any) => void;
  onSpotPriceStats?: (data: any) => void;
}

export class PublicStreams {
  private ws: WsClient;
  private logger = defaultLogger.child('PublicStreams');
  private subscribedPairs: Map<string, Set<string>> = new Map();

  constructor(ws: WsClient) {
    this.ws = ws;
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    this.ws.on('candlestick', (data: any) => {
      this.emit('candle', this.normalizeCandle(data));
    });

    this.ws.on('depth-snapshot', (data: any) => {
      this.emit('depthSnapshot', this.normalizeDepth(data));
    });

    this.ws.on('depth-update', (data: any) => {
      this.emit('depthUpdate', this.normalizeDepth(data));
    });

    this.ws.on('new-trade', (data: any) => {
      this.emit('trade', this.normalizeTrade(data));
    });

    this.ws.on('price-change', (data: any) => {
      this.emit('priceChange', this.normalizePriceChange(data));
    });

    this.ws.on('currentPrices@futures#update', (data: any) => {
      this.emit('batchPrices', this.normalizeBatchPrices(data));
    });

    this.ws.on('currentPrices@spot#update', (data: any) => {
      this.emit('spotBatchPrices', data);
    });

    this.ws.on('priceStats@spot#update', (data: any) => {
      this.emit('spotPriceStats', data);
    });
  }

  private normalizeCandle(data: any): WsCandleData {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    const c = Array.isArray(p.data) ? p.data[0] : p;
    return {
      channel: p.channel ?? 'unknown',
      product: p.pr ?? 'unknown',
      eventTime: p.Ets ?? Date.now(),
      open: parseFloat(c.open ?? c.o ?? 0),
      high: parseFloat(c.high ?? c.h ?? 0),
      low: parseFloat(c.low ?? c.l ?? 0),
      close: parseFloat(c.close ?? c.c ?? 0),
      volume: parseFloat(c.volume ?? c.v ?? 0),
      openTime: (c.open_time ?? c.t ?? Date.now()) * (c.open_time < 10000000000 ? 1000 : 1),
      closeTime: (c.close_time ?? (c.t ? c.t + 60 : Date.now())) * (c.close_time < 10000000000 ? 1000 : 1),
      pair: c.pair ?? c.s ?? p.pair ?? 'unknown',
      symbol: c.symbol ?? c.s ?? 'unknown',
    };
  }

  private normalizeDepth(data: any): WsDepthData {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    const mapLevels = (lvls: Record<string, any> | undefined) =>
      lvls ? Object.entries(lvls).reduce((acc, [pr, q]) => {
        acc[pr] = parseFloat(q as any);
        return acc;
      }, {} as Record<string, number>) : {};
    return {
      timestamp: p.ts,
      bids: mapLevels(p.bids),
      asks: mapLevels(p.asks),
    };
  }

  private normalizeTrade(data: any): WsTradeData {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    return {
      timestamp: p.T,
      price: parseFloat(p.p),
      quantity: parseFloat(p.q),
      isMaker: p.m === 1,
      symbol: p.s,
    };
  }

  private normalizePriceChange(data: any): WsPriceChange {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    return {
      timestamp: p.T,
      price: parseFloat(p.p),
      symbol: p.s,
    };
  }

  private normalizeBatchPrices(data: any): WsBatchPrices {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    const prices: Record<string, { markPrice: number; bmST?: string; cmRT?: string }> = {};
    if (p.prices) {
      for (const [pair, d] of Object.entries(p.prices)) {
        prices[pair] = {
          markPrice: parseFloat((d as any).mp),
          bmST: (d as any).bmST,
          cmRT: (d as any).cmRT,
        };
      }
    }
    return { timestamp: p.ts, prices };
  }

  subscribeCandles(pair: string, interval = '1m'): void {
    const channel = `${pair}_${interval}-futures`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to futures candles', { pair, interval });
  }

  unsubscribeCandles(pair: string, interval = '1m'): void {
    const channel = `${pair}_${interval}-futures`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeOrderBook(pair: string, depth = 50): void {
    const channel = `${pair}@orderbook@${depth}-futures`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to futures orderbook', { pair, depth });
  }

  unsubscribeOrderBook(pair: string, depth = 50): void {
    const channel = `${pair}@orderbook@${depth}-futures`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeTrades(pair: string): void {
    const channel = `${pair}@trades-futures`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to futures trades', { pair });
  }

  unsubscribeTrades(pair: string): void {
    const channel = `${pair}@trades-futures`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribePrices(pair: string): void {
    const channel = `${pair}@prices-futures`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to futures prices', { pair });
  }

  unsubscribePrices(pair: string): void {
    const channel = `${pair}@prices-futures`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeCurrentPricesFutures(): void {
    const channel = 'currentPrices@futures@rt';
    this.ws.subscribe(channel);
    this.logger.debug('Subscribed to current futures prices');
  }

  unsubscribeCurrentPricesFutures(): void {
    this.ws.unsubscribe('currentPrices@futures@rt');
  }

  subscribeSpotCandles(pair: string, interval = '1m'): void {
    const channel = `${pair}_${interval}`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to spot candles', { pair, interval });
  }

  unsubscribeSpotCandles(pair: string, interval = '1m'): void {
    const channel = `${pair}_${interval}`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeSpotOrderBook(pair: string, depth = 50): void {
    const channel = `${pair}@orderbook@${depth}`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to spot orderbook', { pair, depth });
  }

  unsubscribeSpotOrderBook(pair: string, depth = 50): void {
    const channel = `${pair}@orderbook@${depth}`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeSpotTrades(pair: string): void {
    const channel = `${pair}@trades`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to spot trades', { pair });
  }

  unsubscribeSpotTrades(pair: string): void {
    const channel = `${pair}@trades`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeSpotPrices(pair: string): void {
    const channel = `${pair}@prices`;
    this.ws.subscribe(channel);
    this.trackSubscription(pair, channel);
    this.logger.debug('Subscribed to spot prices', { pair });
  }

  unsubscribeSpotPrices(pair: string): void {
    const channel = `${pair}@prices`;
    this.ws.unsubscribe(channel);
    this.untrackSubscription(pair, channel);
  }

  subscribeCurrentPricesSpot(): void {
    this.ws.subscribe('currentPrices@spot@10s');
  }

  unsubscribeCurrentPricesSpot(): void {
    this.ws.unsubscribe('currentPrices@spot@10s');
  }

  subscribePriceStatsSpot(): void {
    this.ws.subscribe('priceStats@spot@60s');
  }

  unsubscribePriceStatsSpot(): void {
    this.ws.unsubscribe('priceStats@spot@60s');
  }

  private trackSubscription(pair: string, channel: string): void {
    if (!this.subscribedPairs.has(pair)) {
      this.subscribedPairs.set(pair, new Set());
    }
    this.subscribedPairs.get(pair)!.add(channel);
  }

  private untrackSubscription(pair: string, channel: string): void {
    const channels = this.subscribedPairs.get(pair);
    if (channels) {
      channels.delete(channel);
      if (channels.size === 0) {
        this.subscribedPairs.delete(pair);
      }
    }
  }

  getSubscriptions(pair?: string): string[] {
    if (pair) return Array.from(this.subscribedPairs.get(pair) || []);
    const all: string[] = [];
    this.subscribedPairs.forEach(channels => all.push(...channels));
    return all;
  }

  on<U extends keyof PublicStreamCallbacks>(event: U, listener: PublicStreamCallbacks[U]): WsClient {
    return this.ws.on(event as string, listener as any);
  }

  off<U extends keyof PublicStreamCallbacks>(event: U, listener: PublicStreamCallbacks[U]): WsClient {
    return this.ws.off(event as string, listener as any);
  }

  once<U extends keyof PublicStreamCallbacks>(event: U, listener: PublicStreamCallbacks[U]): WsClient {
    return this.ws.once(event as string, listener as any);
  }

  private emit(event: string, data: any): void {
    this.ws.emit(event, data);
  }
}