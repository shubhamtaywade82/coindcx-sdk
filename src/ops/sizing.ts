import { FuturesApi } from '../rest/futures';

export interface PositionSizingParams {
  accountBalance: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  leverage: number;
  maxPositionSize?: number;
}

export interface PositionSizeResult {
  quantity: number;
  marginRequired: number;
  notionalValue: number;
  riskAmount: number;
}

export class SizingOps {
  constructor(private futuresApi: FuturesApi) {}

  calculatePositionSize(params: PositionSizingParams): PositionSizeResult {
    const { accountBalance, riskPercent, entryPrice, stopLossPrice, leverage, maxPositionSize } = params;

    const riskAmount = accountBalance * (riskPercent / 100);
    const priceDiff = Math.abs(entryPrice - stopLossPrice);
    const quantity = riskAmount / priceDiff / leverage;

    let finalQuantity = quantity;
    if (maxPositionSize && finalQuantity > maxPositionSize) {
      finalQuantity = maxPositionSize;
    }

    return {
      quantity: finalQuantity,
      marginRequired: finalQuantity * entryPrice / leverage,
      notionalValue: finalQuantity * entryPrice,
      riskAmount,
    };
  }

  async quantizeQuantity(pair: string, quantity: number): Promise<number> {
    try {
      const instrument = await this.futuresApi.getInstrumentDetails(pair);
      const lotSize = instrument.lot_size ?? 0.001;
      return Math.floor(quantity / lotSize) * lotSize;
    } catch {
      return Math.floor(quantity * 1000) / 1000;
    }
  }

  async quantizePrice(pair: string, price: number): Promise<number> {
    try {
      const instrument = await this.futuresApi.getInstrumentDetails(pair);
      const tickSize = instrument.tick_size ?? 0.01;
      return Math.round(price / tickSize) * tickSize;
    } catch {
      return Math.round(price * 100) / 100;
    }
  }

  calculateLiquidationPrice(entryPrice: number, leverage: number, side: 'long' | 'short', maintenanceMargin = 0.005): number {
    const dir = side === 'long' ? 1 : -1;
    return dir === 1
      ? entryPrice * (1 - (1 / leverage) + maintenanceMargin)
      : entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }

  calculateRequiredMargin(quantity: number, entryPrice: number, leverage: number): number {
    return (quantity * entryPrice) / leverage;
  }

  calculatePnL(entryPrice: number, currentPrice: number, quantity: number, side: 'long' | 'short'): number {
    const diff = currentPrice - entryPrice;
    return side === 'long' ? diff * quantity : -diff * quantity;
  }

  calculateROE(entryPrice: number, currentPrice: number, quantity: number, side: 'long' | 'short', leverage: number): number {
    const pnl = this.calculatePnL(entryPrice, currentPrice, quantity, side);
    const margin = this.calculateRequiredMargin(quantity, entryPrice, leverage);
    return (pnl / margin) * 100;
  }
}