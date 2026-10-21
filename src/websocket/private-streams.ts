import { WsClient } from '../core/ws-client';
import { WsOrderUpdate, WsPositionUpdate, WsBalanceUpdate } from '../models';
import { defaultLogger } from '../logger';

export interface PrivateStreamCallbacks {
  onOrderUpdate?: (data: WsOrderUpdate) => void;
  onPositionUpdate?: (data: WsPositionUpdate) => void;
  onBalanceUpdate?: (data: WsBalanceUpdate) => void;
  onTradeUpdate?: (data: any) => void;
}

export class PrivateStreams {
  private ws: WsClient;
  private logger = defaultLogger.child('PrivateStreams');
  private isSubscribed = false;

  constructor(ws: WsClient) {
    this.ws = ws;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    const handleOrder = (data: any) => {
      this.emit('orderUpdate', this.normalizeOrderUpdate(data));
    };
    this.ws.on('df-order-update', handleOrder);
    this.ws.on('order-update', handleOrder);

    this.ws.on('df-position-update', (data: any) => {
      this.emit('positionUpdate', this.normalizePositionUpdate(data));
    });

    this.ws.on('balance-update', (data: any) => {
      this.emit('balanceUpdate', this.normalizeBalanceUpdate(data));
    });

    this.ws.on('trade-update', (data: any) => {
      const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
      this.emit('tradeUpdate', p);
    });
  }

  private normalizeOrderUpdate(data: any): WsOrderUpdate {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    return {
      id: p.id,
      client_order_id: p.client_order_id,
      pair: p.pair,
      side: p.side,
      order_type: p.order_type,
      price: p.price ? parseFloat(p.price) : undefined,
      quantity: parseFloat(p.quantity),
      filled_quantity: p.filled_quantity ? parseFloat(p.filled_quantity) : undefined,
      status: p.status,
      timestamp: p.timestamp ?? p.T ?? Date.now(),
    };
  }

  private normalizePositionUpdate(data: any): WsPositionUpdate {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    return {
      id: p.id,
      pair: p.pair,
      side: p.side,
      size: parseFloat(p.size),
      entry_price: parseFloat(p.entry_price),
      mark_price: p.mark_price ? parseFloat(p.mark_price) : undefined,
      unrealized_pnl: p.unrealized_pnl ? parseFloat(p.unrealized_pnl) : undefined,
      timestamp: p.timestamp ?? Date.now(),
    };
  }

  private normalizeBalanceUpdate(data: any): WsBalanceUpdate {
    const p = data.data && typeof data.data === 'string' ? JSON.parse(data.data) : data;
    return {
      currency: p.currency,
      balance: parseFloat(p.balance),
      locked_balance: p.locked_balance ? parseFloat(p.locked_balance) : undefined,
      available_balance: p.available_balance ? parseFloat(p.available_balance) : undefined,
      wallet_type: p.wallet_type,
      timestamp: p.timestamp ?? Date.now(),
    };
  }

  subscribe(): void {
    if (this.isSubscribed) {
      this.logger.warn('Already subscribed to private channel');
      return;
    }
    this.ws.subscribeUserChannel();
    this.isSubscribed = true;
    this.logger.info('Subscribed to private user channel');
  }

  unsubscribe(): void {
    if (!this.isSubscribed) return;
    this.ws.unsubscribe('coindcx');
    this.isSubscribed = false;
    this.logger.info('Unsubscribed from private user channel');
  }

  isActive(): boolean {
    return this.isSubscribed;
  }

  on<U extends keyof PrivateStreamCallbacks>(event: U, listener: PrivateStreamCallbacks[U]): WsClient {
    return this.ws.on(event as string, listener as any);
  }

  off<U extends keyof PrivateStreamCallbacks>(event: U, listener: PrivateStreamCallbacks[U]): WsClient {
    return this.ws.off(event as string, listener as any);
  }

  once<U extends keyof PrivateStreamCallbacks>(event: U, listener: PrivateStreamCallbacks[U]): WsClient {
    return this.ws.once(event as string, listener as any);
  }

  private emit(event: string, data: any): void {
    this.ws.emit(event, data);
  }
}