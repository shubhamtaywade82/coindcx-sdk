import { RestClient } from '../core/rest-client';
import { RestClientOptions } from '../core/types';
import { assertWithinOrderLimits } from '../core/safety';
import {
  CreateMarginOrderRequest,
  CancelMarginOrderRequest,
  ExitMarginPositionRequest,
  EditMarginTargetRequest,
  EditMarginPriceOfTargetOrderRequest,
  EditMarginSLRequest,
  EditMarginTrailingSLRequest,
  AddMarginRequest,
  RemoveMarginRequest,
  FetchMarginOrdersRequest,
  GetMarginOrderRequest,
  LendRequest,
  SettleLendOrderRequest,
  MarginOrderResponse,
  MarginPositionResponse,
  LendOrderResponse,
} from '../models';

export class MarginApi extends RestClient {
  constructor(options?: RestClientOptions) {
    super(options);
  }

  async createOrder(params: CreateMarginOrderRequest): Promise<MarginOrderResponse> {
    assertWithinOrderLimits({ quantity: params.quantity, price: params.price }, this.safetyLimits);
    const client_order_id = params.client_order_id ?? `js_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = { ...params, ecode: params.ecode ?? 'B', client_order_id };
    return this.signedRequest('POST', '/exchange/v1/margin/create', payload);
  }

  async cancelOrder(params: CancelMarginOrderRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/cancel', params);
  }

  async exitPosition(params: ExitMarginPositionRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/exit', params);
  }

  async editTarget(params: EditMarginTargetRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/edit_target', params);
  }

  async editPriceOfTargetOrder(params: EditMarginPriceOfTargetOrderRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/edit_price_of_target_order', params);
  }

  async editStopLoss(params: EditMarginSLRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/edit_sl', params);
  }

  async editTrailingStopLoss(params: EditMarginTrailingSLRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/edit_trailing_sl', params);
  }

  async addMargin(params: AddMarginRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/add_margin', params);
  }

  async removeMargin(params: RemoveMarginRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/margin/remove_margin', params);
  }

  async fetchOrders(params: FetchMarginOrdersRequest = {}): Promise<MarginPositionResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/margin/fetch_orders', params);
  }

  async getOrder(params: GetMarginOrderRequest): Promise<MarginPositionResponse> {
    return this.signedRequest('POST', '/exchange/v1/margin/order', params);
  }

  async fetchLendOrders(): Promise<LendOrderResponse[]> {
    return this.signedRequest('POST', '/exchange/v1/funding/fetch_orders', {});
  }

  async lend(params: LendRequest): Promise<LendOrderResponse> {
    const payload = {
      currency_short_name: params.currency_short_name ?? params.currency,
      amount: params.amount,
      duration: params.duration ?? 7,
    };
    return this.signedRequest('POST', '/exchange/v1/funding/lend', payload);
  }

  async settleLendOrder(params: SettleLendOrderRequest): Promise<any> {
    return this.signedRequest('POST', '/exchange/v1/funding/settle', params);
  }
}