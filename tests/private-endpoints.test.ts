import { CoinDCXClient } from '../src/index';
import { mockPrivateEndpoint } from './setup';

describe('CoinDCX SDK - Private Endpoints (Webmocks)', () => {
  let client: CoinDCXClient;

  beforeEach(() => {
    client = new CoinDCXClient({
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      paperMode: false,
    });
  });

  describe('Spot Trading', () => {
    it('should create a spot market order', async () => {
      const mockResponse = {
        id: '12345',
        client_order_id: 'test-order-1',
        market: 'BTC_USDT',
        side: 'buy' as const,
        order_type: 'market_order' as const,
        price: 0,
        quantity: 0.001,
        filled_quantity: 0.001,
        remaining_quantity: 0,
        status: 'filled',
        time_in_force: 'gtc',
        created_at: Date.now(),
        updated_at: Date.now(),
        stop_loss: undefined,
        take_profit: undefined,
      };

      mockPrivateEndpoint('post', '/exchange/v1/orders/create', mockResponse);

      const order = await client.spot.createOrder({
        side: 'buy',
        order_type: 'market_order',
        market: 'BTC_USDT',
        quantity: 0.001,
      });

      expect(order.id).toBe('12345');
    });

    it('should cancel an existing order', async () => {
      mockPrivateEndpoint('post', '/exchange/v1/orders/cancel', {
        success: true,
        message: 'Order cancelled',
      });

      const result = await client.spot.cancelOrder({ id: '12345' });
      expect(result.success).toBe(true);
    });

    it('should fetch all active orders', async () => {
      const mockResponse = [
        {
          id: '12345',
          market: 'BTC_USDT',
          side: 'buy' as const,
          order_type: 'limit_order' as const,
          price: 50000,
          quantity: 0.001,
          filled_quantity: 0,
          remaining_quantity: 0.001,
          status: 'open',
          time_in_force: 'gtc',
          created_at: Date.now(),
          updated_at: Date.now(),
          stop_loss: undefined,
          take_profit: undefined,
          client_order_id: undefined,
        },
      ];

      mockPrivateEndpoint('post', '/exchange/v1/orders/active_orders', mockResponse);

      const orders = await client.spot.getActiveOrders();
      expect(orders.length).toBe(1);
    });
  });

  describe('Futures Trading', () => {
    it('should create a futures market order', async () => {
      const mockResponse = {
        id: 'fut-12345',
        client_order_id: 'fut-test-1',
        pair: 'B-BTC_USDT',
        base_currency: 'BTC',
        quote_currency: 'USDT',
        side: 'buy' as const,
        order_type: 'market_order' as const,
        target_quantity: 0.01,
        filled_quantity: 0.01,
        remaining_quantity: 0,
        status: 'filled',
        time_in_force: 'gtc',
        created_at: Date.now(),
        updated_at: Date.now(),
        leverage: 10,
        margin_type: 'cross',
        price: undefined,
        stop_loss: undefined,
        take_profit: undefined,
      };

      mockPrivateEndpoint('post', '/exchange/v1/derivatives/futures/orders/create', mockResponse);

      const order = await client.futures.trading.createOrder({
        side: 'buy',
        order_type: 'market_order',
        base_currency: 'BTC',
        quote_currency: 'USDT',
        target_quantity: 0.01,
        leverage: 10,
        price: undefined,
        client_order_id: undefined,
        time_in_force: undefined,
        stop_loss: undefined,
        take_profit: undefined,
        margin_type: undefined,
      });

      expect(order.id).toBe('fut-12345');
    });

    it('should fetch open futures positions', async () => {
      const mockResponse = [
        {
          id: 'pos-1',
          pair: 'B-BTC_USDT',
          side: 'long' as const,
          size: 0.01,
          entry_price: 50000,
          mark_price: 51000,
          liquidation_price: 45000,
          unrealized_pnl: 10,
          realized_pnl: 0,
          leverage: 10,
          margin_type: 'cross' as const,
          margin: 50,
          timestamp: Date.now(),
        },
      ];

      mockPrivateEndpoint('post', '/exchange/v1/derivatives/futures/positions', mockResponse);

      const positions = await client.futures.trading.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]?.side).toBe('long');
    });

    it('should update leverage for a pair', async () => {
      mockPrivateEndpoint('post', '/exchange/v1/derivatives/futures/positions/update_leverage', {
        success: true,
        leverage: 25,
      });

      const result = await client.futures.trading.updateLeverage({
        pair: 'B-BTC_USDT',
        leverage: 25,
      });

      expect(result.leverage).toBe(25);
    });
  });

  describe('Account & Wallet', () => {
    it('should fetch spot balances', async () => {
      const mockResponse = [
        { currency: 'USDT', balance: 10000, locked_balance: 100, available_balance: 9900, wallet_type: 'spot' },
        { currency: 'BTC', balance: 0.5, locked_balance: 0.1, available_balance: 0.4, wallet_type: 'spot' },
      ];

      mockPrivateEndpoint('post', '/exchange/v1/users/balances', mockResponse);

      const balances = await client.spot.getBalances();
      expect(balances.length).toBe(2);
    });

    it('should fetch futures wallet', async () => {
      const mockResponse = [
        { currency: 'USDT', balance: 5000, locked_balance: 500, available_balance: 4500 },
      ];

      mockPrivateEndpoint('get', '/exchange/v1/derivatives/futures/wallets', mockResponse);

      const wallet = await client.futures.account.getWallet();
      expect(wallet[0]?.currency).toBe('USDT');
    });

    it('should perform sub-account transfer', async () => {
      mockPrivateEndpoint('post', '/exchange/v1/wallets/sub_account_transfer', {
        success: true,
        transfer_id: 'sub-tx-123',
      });

      const res = await client.subAccountTransfer({
        from_account_id: 'acc1',
        to_account_id: 'acc2',
        currency_short_name: 'USDT',
        amount: 50,
      });
      expect(res.success).toBe(true);
    });

    it('should perform cross-wallet transfer', async () => {
      mockPrivateEndpoint('post', '/exchange/v1/wallets/transfer', {
        success: true,
        transfer_id: 'wall-tx-456',
      });

      const res = await client.walletTransfer({
        source_wallet_type: 'spot',
        destination_wallet_type: 'futures',
        currency_short_name: 'USDT',
        amount: 100,
      });
      expect(res.success).toBe(true);
    });

    it('should fetch currency conversions', async () => {
      mockPrivateEndpoint('post', '/api/v1/derivatives/futures/data/conversions', {
        symbol: 'USDTINR',
        margin_currency_short_name: 'INR',
        target_currency_short_name: 'USDT',
        conversion_price: 89.5,
        last_updated_at: 1717754279737,
      });

      const res = await client.futures.market.getCurrencyConversions();
      expect(res.conversion_price).toBe(89.5);
    });
  });
});