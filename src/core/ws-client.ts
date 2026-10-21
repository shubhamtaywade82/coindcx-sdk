import { io, Socket } from 'socket.io-client';
import EventEmitter from 'eventemitter3';
import crypto from 'crypto';
import { WsClientOptions } from './types';
import { CoinDCXWebSocketError } from './errors';
import { defaultLogger } from '../logger';

export interface WsEventMap {
  open: () => void;
  close: (reason: string) => void;
  error: (error: Error) => void;
  [channel: string]: (data: any) => void;
}

export class WsClient extends EventEmitter<WsEventMap> {
  private socket: Socket | null = null;
  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxRetries = 10;
  private autoReconnect = true;
  private subscribedChannels: Set<string> = new Set();
  private pendingSubscriptions: Set<string> = new Set();
  private pingInterval: NodeJS.Timeout | undefined;
  private logger = defaultLogger.child('WsClient');

  constructor(options: WsClientOptions = {}) {
    super();
    this.apiKey = options.apiKey ?? undefined;
    this.apiSecret = options.apiSecret ?? undefined;
    this.wsUrl = options.wsUrl ?? 'wss://stream.coindcx.com';
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      try {
        this.socket = io(this.wsUrl, {
          transports: ['websocket'],
          reconnection: false,
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          this.reconnectAttempts = 0;
          this.logger.info('WebSocket connected', { socketId: this.socket?.id });
          this.emit('open');
          this.resubscribeAll();
          this.startPing();
          resolve();
        });

        this.socket.on('disconnect', (reason: string) => {
          this.logger.warn('WebSocket disconnected', { reason });
          this.stopPing();
          this.emit('close', reason);
          if (this.autoReconnect && reason !== 'io client disconnect') {
            this.scheduleReconnect();
          }
        });

        this.socket.on('connect_error', (error: Error) => {
          this.logger.error('WebSocket connection error', { error: error.message });
          this.emit('error', error);
          if (!this.socket?.connected) {
            reject(new CoinDCXWebSocketError(error.message, error));
          }
        });

        this.setupEventHandlers();
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('candlestick', (data: any) => this.emit('candlestick', data));
    this.socket.on('depth-snapshot', (data: any) => this.emit('depth-snapshot', data));
    this.socket.on('depth-update', (data: any) => this.emit('depth-update', data));
    this.socket.on('new-trade', (data: any) => this.emit('new-trade', data));
    this.socket.on('price-change', (data: any) => this.emit('price-change', data));
    this.socket.on('currentPrices@futures#update', (data: any) => this.emit('currentPrices@futures#update', data));
    this.socket.on('currentPrices@spot#update', (data: any) => this.emit('currentPrices@spot#update', data));
    this.socket.on('priceStats@spot#update', (data: any) => this.emit('priceStats@spot#update', data));
    this.socket.on('df-order-update', (data: any) => this.emit('df-order-update', data));
    this.socket.on('order-update', (data: any) => this.emit('order-update', data));
    this.socket.on('df-position-update', (data: any) => this.emit('df-position-update', data));
    this.socket.on('balance-update', (data: any) => this.emit('balance-update', data));
    this.socket.on('trade-update', (data: any) => this.emit('trade-update', data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxRetries) {
      this.logger.error('Max WebSocket reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000) + Math.random() * 1000;
    this.logger.info(`Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  private resubscribeAll(): void {
    const all = [...this.subscribedChannels, ...this.pendingSubscriptions];
    this.subscribedChannels.clear();
    this.pendingSubscriptions.clear();
    
    all.forEach(channel => {
      if (channel === 'coindcx') {
        this.subscribeUserChannel();
      } else {
        this.subscribe(channel);
      }
    });
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  public subscribe(channel: string, payload: Record<string, any> = {}): void {
    if (!this.socket) {
      this.pendingSubscriptions.add(channel);
      return;
    }

    if (!this.socket.connected) {
      this.pendingSubscriptions.add(channel);
      return;
    }

    this.socket.emit('join', { ...payload, channelName: channel });
    this.subscribedChannels.add(channel);
    this.logger.debug('Subscribed to channel', { channel });
  }

  public unsubscribe(channel: string): void {
    if (!this.socket?.connected) return;
    
    this.socket.emit('leave', { channelName: channel });
    this.subscribedChannels.delete(channel);
    this.pendingSubscriptions.delete(channel);
    this.logger.debug('Unsubscribed from channel', { channel });
  }

  public subscribeUserChannel(): void {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API Key and Secret required for private channel subscription');
    }

    const channel = 'coindcx';
    const payload = { channel };
    const signature = crypto.createHmac('sha256', this.apiSecret).update(JSON.stringify(payload)).digest('hex');

    // CoinDCX official spec requires emitting 'join' with { channelName, apiKey, authSignature }
    this.socket?.emit('join', {
      channelName: channel,
      apiKey: this.apiKey,
      authSignature: signature,
    });
    
    this.subscribedChannels.add(channel);
    this.logger.info('Subscribed to private user channel');
  }

  public disconnect(): void {
    this.autoReconnect = false;
    this.stopPing();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscribedChannels.clear();
    this.pendingSubscriptions.clear();
    this.logger.info('WebSocket disconnected manually');
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  public setMaxRetries(retries: number): void {
    this.maxRetries = retries;
  }

  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }
}