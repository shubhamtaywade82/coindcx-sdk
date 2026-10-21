import { RestClient } from '../core/rest-client';
import { RestClientOptions } from '../core/types';
import { assertWithinOrderLimits } from '../core/safety';
import {
  CreateSpotOrderRequest,
  CreateMultipleSpotOrdersRequest,
  GetOrderStatusRequest,
  GetOrderStatusMultipleRequest,
  CancelOrderRequest,
  CancelAllOrdersRequest,
  EditOrderRequest,
  GetUserSpotTradeHistoryRequest,
  SpotOrderResponse,
  BalanceResponse,
  UserInfoResponse,
  ActiveOrdersCountResponse,
  SubAccountTransferRequest,
  WalletTransferRequest,
} from '../models';

export class SpotApi extends RestClient {
  constructor(options?: RestClientOptions) {
    super(options);
  }

  async createOrder(params: CreateSpotOrderRequest): Promise<SpotOrderResponse> {
    const total_quantity = params.total_quantity ?? params.quantity ?? 0;
    const price_per_unit = params.price_per_unit ?? params.price;
    assertWithinOrderLimits({ quantity: total_quantity, price: price_per_unit }, this.safetyLimits);
    const client_order_id = params.client_order_id ?? `js_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: any = { ...params, total_quantity, client_order_id };
    if (price_per_unit !== undefined) payload.price_per_unit = price_per_unit;
    return this.signedRequest('POST', '/exchange/v1/orders/create', payload);
  }

  async createMultipleOrders(params: CreateMultipleSpotOrdersRequest): Promise<SpotOrderResponse[]> {
    const normalizedOrders = params.orders.map(o => {
      const total_quantity = o.total_quantity ?? o.quantity ?? 0;
      const price_per_unit = o.price_per_unit ?? o.price;
      assertWithinOrderLimits({ quantity: total_quantity, price: price_per_unit }, this.safetyLimits);
      const client_order_id = o.client_order_id ?? `js_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const order: any = { ...o, total_quantity, client_order_id, ecode: o.ecode ?? 'B' };
      if (price_per_unit !== undefined) order.price_per_unit = price_per_unit;
      return order;
    });
    return this.signedRequest('POST', '/exchange/v1/orders/create_multiple', { orders: normalizedOrders });
  }

  async getOrderStatus(params: GetOrderStatusRequest): Promise<SpotOrderResponse> {
    return this.signedRequest('POST', '/exchange/v1/orders/status', params);
  }

  async getOrderStatusMultiple(params: GetOrderStatusMultipleRequest): Promise<SpotOrderResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/orders/status_multiple', params);
  }

  async getActiveOrders(): Promise<SpotOrderResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/orders/active_orders', {});
  }

  async cancelOrder(params: CancelOrderRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/orders/cancel', params);
  }

  async cancelAllOrders(params: CancelAllOrdersRequest = {}): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/orders/cancel_all', params);
  }

  async cancelOrdersByIds(ids: (string | number)[]): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/orders/cancel_by_ids', { ids });
  }

  async editOrder(params: EditOrderRequest): Promise<SpotOrderResponse> {
    const price_per_unit = params.price_per_unit ?? params.price;
    const payload: any = { ...params };
    if (price_per_unit !== undefined) payload.price_per_unit = price_per_unit;
    return this.signedRequest('POST', '/exchange/v1/orders/edit', payload);
  }

  async getUserTradeHistory(params: GetUserSpotTradeHistoryRequest): Promise<SpotOrderResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/orders/trade_history', params);
  }

  async getActiveOrdersCount(): Promise<number> {
    const response = await this.signedRequest<ActiveOrdersCountResponse>(
      'POST',
      '/exchange/v1/orders/active_orders_count',
      {}
    );
    return response.count;
  }

  async getBalances(): Promise<BalanceResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/users/balances', {});
  }

  async getUserInfo(): Promise<UserInfoResponse> {
    return this.signedRequest('POST', '/exchange/v1/users/info', {});
  }

  async subAccountTransfer(params: SubAccountTransferRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/wallets/sub_account_transfer', params);
  }

  async walletTransfer(params: WalletTransferRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/wallets/transfer', params);
  }
}