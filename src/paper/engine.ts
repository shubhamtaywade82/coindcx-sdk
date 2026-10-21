import EventEmitter from 'eventemitter3';
import { CreateFuturesOrderRequest, FuturesOrderResponse } from '../models';
import { defaultLogger } from '../logger';

export interface PaperEngineConfig {
  initialBalance: number;
  initialFuturesBalance?: number;
  makerFee?: number;
  takerFee?: number;
  slippage?: number;
  binanceWs?: any;
}

export interface PaperOrder {
  id: string;
  clientOrderId: string;
  pair: string;
  side: 'buy' | 'sell';
  orderType: 'market_order' | 'limit_order' | 'stop_limit_order';
  price: number | undefined;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
  leverage: number | undefined;
  marginType: 'isolated' | 'cross' | undefined;
  stopLoss: number | undefined;
  takeProfit: number | undefined;
  createdAt: number;
  updatedAt: number;
  fills: PaperFill[];
}

export interface PaperFill {
  price: number;
  quantity: number;
  timestamp: number;
  fee: number;
}

export interface PaperPosition {
  id: string;
  pair: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number | null;
  unrealizedPnl: number;
  realizedPnl: number;
  leverage: number;
  marginType: 'isolated' | 'cross';
  margin: number;
  timestamp: number;
}

export interface PaperAccount {
  spotBalance: number;
  futuresBalance: number;
  availableMargin: number;
  usedMargin: number;
  unrealizedPnl: number;
  totalEquity: number;
}

export class PaperTradingEngine extends EventEmitter {
  private config: PaperEngineConfig;
  private orders: Map<string, PaperOrder> = new Map();
  private positions: Map<string, PaperPosition> = new Map();
  private account: PaperAccount;
  private priceCache: Map<string, { bid: number; ask: number; timestamp: number }> = new Map();
  private orderIdCounter = 0;
  private positionIdCounter = 0;
  private logger = defaultLogger.child('PaperEngine');

  constructor(config: PaperEngineConfig) {
    super();
    this.config = {
      makerFee: 0.0002,
      takerFee: 0.0005,
      slippage: 0.0005,
      ...config,
    };

    this.account = {
      spotBalance: config.initialBalance,
      futuresBalance: config.initialFuturesBalance ?? config.initialBalance,
      availableMargin: config.initialFuturesBalance ?? config.initialBalance,
      usedMargin: 0,
      unrealizedPnl: 0,
      totalEquity: config.initialBalance + (config.initialFuturesBalance ?? config.initialBalance),
    };
  }

  updatePrice(pair: string, bid: number, ask: number): void {
    this.priceCache.set(pair, { bid, ask, timestamp: Date.now() });
    this.checkLimitOrders(pair);
    this.updatePositionsMarkPrice(pair, (bid + ask) / 2);
  }

  getMidPrice(pair: string): number | null {
    const cached = this.priceCache.get(pair);
    if (!cached) return null;
    return (cached.bid + cached.ask) / 2;
  }

  getBidAsk(pair: string): { bid: number; ask: number } | null {
    return this.priceCache.get(pair) || null;
  }

  async placeOrder(params: CreateFuturesOrderRequest): Promise<FuturesOrderResponse> {
    const orderId = `paper_${++this.orderIdCounter}_${Date.now()}`;
    const clientOrderId = params.client_order_id ?? `paper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const baseCurrency = params.base_currency;
    const quoteCurrency = params.quote_currency;
    const pair = `B-${baseCurrency}_${quoteCurrency}`;

    const order: PaperOrder = {
      id: orderId,
      clientOrderId,
      pair,
      side: params.side,
      orderType: (params.order_type as any) ?? 'market_order',
      price: params.price,
      quantity: params.total_quantity ?? params.target_quantity ?? 0,
      filledQuantity: 0,
      remainingQuantity: params.total_quantity ?? params.target_quantity ?? 0,
      status: 'new',
      leverage: params.leverage,
      marginType: params.margin_type,
      stopLoss: params.stop_loss,
      takeProfit: params.take_profit,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fills: [],
    };

    const requiredMargin = this.calculateRequiredMargin(order);
    if (this.account.availableMargin < requiredMargin) {
      order.status = 'rejected';
      this.orders.set(orderId, order);
      throw new Error('Insufficient margin for paper order');
    }

    this.account.availableMargin -= requiredMargin;
    this.account.usedMargin += requiredMargin;
    this.orders.set(orderId, order);

    if (params.order_type === 'market_order') {
      await this.fillMarketOrder(order);
    }

    this.emit('orderUpdate', this.toOrderResponse(order));
    return this.toOrderResponse(order);
  }

  async cancelOrder(orderId: string | number): Promise<boolean> {
    const order = this.orders.get(String(orderId));
    if (!order) return false;

    if (order.status === 'filled' || order.status === 'cancelled') {
      return false;
    }

    const reservedMargin = order.remainingQuantity * (order.price ?? 0) / (order.leverage ?? 1);
    this.account.availableMargin += reservedMargin;
    this.account.usedMargin -= reservedMargin;

    order.status = 'cancelled';
    order.updatedAt = Date.now();
    this.emit('orderUpdate', this.toOrderResponse(order));
    return true;
  }

  getOrder(orderId: string | number): PaperOrder | undefined {
    return this.orders.get(String(orderId));
  }

  getOrders(): PaperOrder[] {
    return Array.from(this.orders.values());
  }

  getOpenOrders(): PaperOrder[] {
    return Array.from(this.orders.values()).filter(o => o.status === 'new' || o.status === 'partially_filled');
  }

  getPositions(): PaperPosition[] {
    return Array.from(this.positions.values());
  }

  getPosition(pair: string): PaperPosition | undefined {
    return this.positions.get(pair);
  }

  getAccount(): PaperAccount {
    this.updateAccountEquity();
    return { ...this.account };
  }

  reset(config?: Partial<PaperEngineConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.orders.clear();
    this.positions.clear();
    this.orderIdCounter = 0;
    this.positionIdCounter = 0;
    this.account = {
      spotBalance: this.config.initialBalance,
      futuresBalance: this.config.initialFuturesBalance ?? this.config.initialBalance,
      availableMargin: this.config.initialFuturesBalance ?? this.config.initialBalance,
      usedMargin: 0,
      unrealizedPnl: 0,
      totalEquity: this.config.initialBalance + (this.config.initialFuturesBalance ?? this.config.initialBalance),
    };
    this.logger.info('Paper engine reset');
  }

  private async fillMarketOrder(order: PaperOrder): Promise<void> {
    const priceData = this.priceCache.get(order.pair);
    if (!priceData) {
      order.status = 'rejected';
      this.emit('orderUpdate', this.toOrderResponse(order));
      return;
    }

    const fillPrice = order.side === 'buy' ? priceData.ask : priceData.bid;
    const slippage = this.config.slippage ?? 0;
    const finalPrice = order.side === 'buy'
      ? fillPrice * (1 + slippage)
      : fillPrice * (1 - slippage);

    await this.executeFill(order, finalPrice, order.remainingQuantity);
  }

  private checkLimitOrders(pair: string): void {
    const priceData = this.priceCache.get(pair);
    if (!priceData) return;

    const midPrice = (priceData.bid + priceData.ask) / 2;

    for (const order of this.orders.values()) {
      if (order.pair !== pair) continue;
      if (order.status !== 'new' && order.status !== 'partially_filled') continue;
      if (order.orderType !== 'limit_order') continue;

      const shouldFill = order.side === 'buy'
        ? midPrice <= (order.price ?? 0)
        : midPrice >= (order.price ?? 0);

      if (shouldFill) {
        const fillPrice = order.side === 'buy' ? priceData.ask : priceData.bid;
        const slippage = this.config.slippage ?? 0;
        const finalPrice = order.side === 'buy'
          ? fillPrice * (1 + slippage)
          : fillPrice * (1 - slippage);

        this.executeFill(order, finalPrice, order.remainingQuantity);
      }
    }
  }

  private async executeFill(order: PaperOrder, price: number, quantity: number): Promise<void> {
    const feeRate = order.orderType === 'market_order' ? (this.config.takerFee ?? 0.0005) : (this.config.makerFee ?? 0.0002);
    const fee = price * quantity * feeRate;

    order.filledQuantity += quantity;
    order.remainingQuantity -= quantity;
    order.fills.push({ price, quantity, timestamp: Date.now(), fee });
    order.updatedAt = Date.now();

    if (order.remainingQuantity <= 0) {
      order.status = 'filled';
    } else {
      order.status = 'partially_filled';
    }

    await this.updatePosition(order, price, quantity);

    this.emit('fill', {
      orderId: order.id,
      clientOrderId: order.clientOrderId,
      pair: order.pair,
      side: order.side,
      price,
      quantity,
      fee,
    });

    this.emit('orderUpdate', this.toOrderResponse(order));
  }

  private async updatePosition(order: PaperOrder, fillPrice: number, fillQuantity: number): Promise<void> {
    let position = this.positions.get(order.pair);

    if (!position) {
      const positionId = `pos_${++this.positionIdCounter}_${Date.now()}`;
      const side = order.side === 'buy' ? 'long' : 'short';
      const leverage = order.leverage ?? 1;
      const margin = (fillPrice * fillQuantity) / leverage;
      const liquidationPrice = this.calculateLiquidationPrice(fillPrice, leverage, side);

      position = {
        id: positionId,
        pair: order.pair,
        side,
        size: fillQuantity,
        entryPrice: fillPrice,
        markPrice: fillPrice,
        liquidationPrice,
        unrealizedPnl: 0,
        realizedPnl: 0,
        leverage,
        marginType: order.marginType ?? 'cross',
        margin,
        timestamp: Date.now(),
      };
      this.positions.set(order.pair, position);
    } else {
      const isSameSide = (position.side === 'long' && order.side === 'buy') ||
                         (position.side === 'short' && order.side === 'sell');

      if (isSameSide) {
        const newSize = position.size + fillQuantity;
        const newEntryPrice = ((position.entryPrice * position.size) + (fillPrice * fillQuantity)) / newSize;
        position.size = newSize;
        position.entryPrice = newEntryPrice;
        position.margin = (newEntryPrice * newSize) / position.leverage;
        position.liquidationPrice = this.calculateLiquidationPrice(newEntryPrice, position.leverage, position.side);
      } else {
        if (fillQuantity >= position.size) {
          const closedPnl = this.calculatePnl(position, fillPrice) * (position.size / fillQuantity);
          position.realizedPnl += closedPnl;

          if (fillQuantity > position.size) {
            const remainingQty = fillQuantity - position.size;
            const newSide = order.side === 'buy' ? 'long' : 'short';
            position.side = newSide;
            position.size = remainingQty;
            position.entryPrice = fillPrice;
            position.margin = (fillPrice * remainingQty) / position.leverage;
            position.liquidationPrice = this.calculateLiquidationPrice(fillPrice, position.leverage, newSide);
          } else {
            this.positions.delete(order.pair);
            this.releaseMargin(position.margin);
            return;
          }
        } else {
          const closedPnl = this.calculatePnl(position, fillPrice) * (fillQuantity / position.size);
          position.realizedPnl += closedPnl;
          position.size -= fillQuantity;
          position.margin = (position.entryPrice * position.size) / position.leverage;
        }
      }
    }

    position.timestamp = Date.now();
    this.emit('positionUpdate', position);
  }

  private updatePositionsMarkPrice(pair: string, markPrice: number): void {
    const position = this.positions.get(pair);
    if (!position) return;

    position.markPrice = markPrice;
    position.unrealizedPnl = this.calculatePnl(position, markPrice);
    position.liquidationPrice = this.calculateLiquidationPrice(position.entryPrice, position.leverage, position.side);
    position.timestamp = Date.now();

    this.emit('positionUpdate', position);
  }

  private calculatePnl(position: PaperPosition, currentPrice: number): number {
    const diff = currentPrice - position.entryPrice;
    return position.side === 'long' ? diff * position.size : -diff * position.size;
  }

  private calculateLiquidationPrice(entryPrice: number, leverage: number, side: 'long' | 'short', maintenanceMargin = 0.005): number {
    const dir = side === 'long' ? 1 : -1;
    return dir === 1
      ? entryPrice * (1 - (1 / leverage) + maintenanceMargin)
      : entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }

  private calculateRequiredMargin(order: PaperOrder): number {
    const price = order.price ?? this.getMidPrice(order.pair) ?? 0;
    const leverage = order.leverage ?? 1;
    return (price * order.quantity) / leverage;
  }

  private releaseMargin(margin: number): void {
    this.account.availableMargin += margin;
    this.account.usedMargin = Math.max(0, this.account.usedMargin - margin);
  }

  private updateAccountEquity(): void {
    let unrealizedPnl = 0;
    for (const position of this.positions.values()) {
      unrealizedPnl += position.unrealizedPnl;
    }
    this.account.unrealizedPnl = unrealizedPnl;
    this.account.totalEquity = this.account.spotBalance + this.account.futuresBalance + unrealizedPnl;
  }

  private toOrderResponse(order: PaperOrder): FuturesOrderResponse {
    return {
      id: order.id,
      client_order_id: order.clientOrderId,
      pair: order.pair,
      base_currency: order.pair.split('-')[1]?.split('_')[0] ?? '',
      quote_currency: order.pair.split('_')[1] ?? 'USDT',
      side: order.side,
      order_type: order.orderType,
      price: order.price,
      target_quantity: order.quantity,
      filled_quantity: order.filledQuantity,
      remaining_quantity: order.remainingQuantity,
      status: order.status,
      time_in_force: 'gtc',
      created_at: order.createdAt,
      updated_at: order.updatedAt,
      leverage: order.leverage,
      margin_type: order.marginType,
      stop_loss: order.stopLoss,
      take_profit: order.takeProfit,
    };
  }
}