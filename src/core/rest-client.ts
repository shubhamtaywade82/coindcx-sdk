import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { TokenBucket, coinDcxRateLimits } from './rate-limiter';
import { RestClientOptions } from './types';
import { TradingSafetyLimits } from './safety';
import {
  CoinDCXAPIError,
  CoinDCXNetworkError,
  CoinDCXRateLimitError,
  CoinDCXAuthenticationError,
  CoinDCXValidationError,
  CoinDCXInsufficientMarginError,
  CoinDCXInvalidPairError,
  CoinDCXOrderError,
  isRetryableError,
} from './errors';
import { defaultLogger } from '../logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPaperHandledEndpoint(endpoint: string): boolean {
  return endpoint.includes('/orders') || endpoint.includes('/positions');
}

export class RestClient {
  protected axiosInstance: AxiosInstance;
  protected apiKey: string | undefined;
  protected apiSecret: string | undefined;
  protected paperMode: boolean;
  protected paperEngineHandler: ((config: InternalAxiosRequestConfig) => Promise<any>) | undefined;
  protected rateLimiters: Map<string, TokenBucket> = new Map();
  protected logger = defaultLogger.child('RestClient');
  protected maxRetries: number;
  protected retryBaseDelayMs: number;
  protected retryMaxDelayMs: number;
  protected retryFactor: number;
  protected safetyLimits: TradingSafetyLimits | undefined;

  constructor(options: RestClientOptions = {}) {
    this.apiKey = options.apiKey ?? undefined;
    this.apiSecret = options.apiSecret ?? undefined;
    this.paperMode = options.paperMode ?? false;
    this.paperEngineHandler = options.paperEngineHandler;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1000;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 30_000;
    this.retryFactor = options.retryFactor ?? 2;
    this.safetyLimits = options.safetyLimits;

    this.axiosInstance = axios.create({
      baseURL: options.baseUrl || 'https://api.coindcx.com',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CoinDCX-SDK/1.0.0',
      },
      timeout: 15000,
      adapter: (config) => this.paperAdapter(config),
    });

    this.initializeRateLimiters();
    this.setupInterceptors();
  }

  private async paperAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const endpoint = config.url || '';
    if (this.paperMode && this.paperEngineHandler && isPaperHandledEndpoint(endpoint)) {
      return this.paperEngineHandler(config);
    }
    return this.httpAdapter(config);
  }

  private httpAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
    const adapter = axios.getAdapter(['http', 'fetch']);
    return adapter(config as any);
  }

  private initializeRateLimiters(): void {
    Object.entries(coinDcxRateLimits).forEach(([key, config]) => {
      this.rateLimiters.set(key, new TokenBucket(config));
    });
  }

  private getRateLimiter(endpoint: string): TokenBucket {
    if (endpoint.includes('/cancel_all')) return this.rateLimiters.get('cancelAll') || this.rateLimiters.get('orders')!;
    if (endpoint.includes('/orders/create') || endpoint.includes('/orders/cancel') || endpoint.includes('/orders/edit')) {
      return this.rateLimiters.get('orders')!;
    }
    if (endpoint.includes('/positions')) return this.rateLimiters.get('positions')!;
    if (endpoint.includes('/wallets') || endpoint.includes('/balances') || endpoint.includes('/transfer')) {
      return this.rateLimiters.get('wallet')!;
    }
    if (endpoint.includes('/users/') || endpoint.includes('/account')) return this.rateLimiters.get('account')!;
    if (endpoint.includes('/market_data/') || endpoint.includes('/ticker') || endpoint.includes('/candles') || endpoint.includes('/orderbook') || endpoint.includes('/trade_history')) {
      return this.rateLimiters.get('marketData')!;
    }
    return this.rateLimiters.get('default')!;
  }

  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const endpoint = config.url || '';
      const limiter = this.getRateLimiter(endpoint);
      await limiter.consume(1);
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response) {
          const { status, data, config } = error.response;
          const method = config?.method?.toUpperCase() || 'UNKNOWN';
          const url = config?.url || 'UNKNOWN';
          
          const message = (data as any)?.message || error.message || 'API Error';
          const code = (data as any)?.code;

          if (status === 429) {
            const header = Number(error.response.headers['retry-after']);
            const retryAfter = Number.isFinite(header) && header >= 0 ? header : 60;
            throw new CoinDCXRateLimitError(message, status, data, method, url, retryAfter);
          }
          if (status === 401 || status === 403) {
            throw new CoinDCXAuthenticationError(message, status, data, method, url);
          }
          if (status === 400) {
            if (message.includes('insufficient') || message.includes('margin')) {
              throw new CoinDCXInsufficientMarginError(message, status, data, method, url);
            }
            if (message.includes('invalid') && message.includes('pair')) {
              throw new CoinDCXInvalidPairError(message, status, data, method, url);
            }
            if (message.includes('order')) {
              throw new CoinDCXOrderError(message, status, data, method, url);
            }
            throw new CoinDCXValidationError(message, status, data, method, url);
          }
          throw new CoinDCXAPIError(message, status, data, method, url, code);
        }
        throw new CoinDCXNetworkError(error.message, error);
      }
    );
  }

  protected sign(payload: string): string {
    if (!this.apiSecret) throw new Error('API Secret required for signed requests');
    return crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex');
  }

  protected async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data: Record<string, any> = {}
  ): Promise<T> {
    return this.runWithRetry(method, data, async () => {
      const paperHandled = this.paperMode && this.paperEngineHandler && isPaperHandledEndpoint(endpoint);
      if (!paperHandled && (!this.apiKey || !this.apiSecret)) {
        throw new Error('API Key and Secret required for signed requests');
      }

      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
      };

      if (!paperHandled) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payload = { ...data, timestamp };
        const payloadStr = JSON.stringify(payload);
        const signature = this.sign(payloadStr);
        config.headers = {
          'X-AUTH-APIKEY': this.apiKey,
          'X-AUTH-SIGNATURE': signature,
        };
        if (method === 'GET') {
          config.params = payload;
        } else {
          config.data = payload;
        }
      } else {
        if (method === 'GET') {
          config.params = data;
        } else {
          config.data = data;
        }
      }

      this.logger.debug(`${method} ${endpoint}`, data);
      const response = await this.axiosInstance.request<T>(config);
      return response.data;
    });
  }

  protected async unsignedRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data: Record<string, any> = {},
    usePublicBase: boolean = false
  ): Promise<T> {
    return this.runWithRetry(method, data, async () => {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
      };

      if (usePublicBase) {
        config.baseURL = 'https://public.coindcx.com';
      }

      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }

      this.logger.debug(`${method} ${endpoint}`, data);
      const response = await this.axiosInstance.request<T>(config);
      return response.data;
    });
  }

  /**
   * Re-runs a request with exponential backoff on retryable errors.
   * GET is always safe to retry. A POST/DELETE carrying a `client_order_id`
   * is also retried: CoinDCX rejects a reused `client_order_id` instead of
   * executing it again (see docs.coindcx.com), so a retry either succeeds
   * (the original request never reached the exchange) or surfaces a
   * duplicate-id validation error - it never double-submits the order.
   * Any other write path fails fast and surfaces the original error.
   */
  private async runWithRetry<T>(method: string, params: Record<string, any> | undefined, run: () => Promise<T>): Promise<T> {
    const isIdempotentWrite = (method === 'POST' || method === 'DELETE') && Boolean(params?.client_order_id);
    const maxRetries = method === 'GET' || isIdempotentWrite ? this.maxRetries : 0;
    let attempt = 0;
    for (;;) {
      try {
        return await run();
      } catch (error) {
        if (attempt >= maxRetries || !isRetryableError(error)) throw error;
        await this.retryDelay(error, attempt);
        attempt += 1;
      }
    }
  }

  private async retryDelay(error: unknown, attempt: number): Promise<void> {
    const backoff = this.retryBaseDelayMs * Math.pow(this.retryFactor, attempt);
    const retryAfter = error instanceof CoinDCXRateLimitError ? error.retryAfter * 1000 : 0;
    await sleep(Math.min(Math.max(backoff, retryAfter), this.retryMaxDelayMs));
  }

  getRetryConfig(): { maxRetries: number; baseDelayMs: number; maxDelayMs: number; factor: number } {
    return {
      maxRetries: this.maxRetries,
      baseDelayMs: this.retryBaseDelayMs,
      maxDelayMs: this.retryMaxDelayMs,
      factor: this.retryFactor,
    };
  }

  configureRetry(options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
  }): void {
    if (options.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options.baseDelayMs !== undefined) this.retryBaseDelayMs = options.baseDelayMs;
    if (options.maxDelayMs !== undefined) this.retryMaxDelayMs = options.maxDelayMs;
    if (options.factor !== undefined) this.retryFactor = options.factor;
  }

  setPaperMode(enabled: boolean, handler?: (config: InternalAxiosRequestConfig) => Promise<any>): void {
    this.paperMode = enabled;
    if (handler) this.paperEngineHandler = handler;
  }

  setSafetyLimits(limits: TradingSafetyLimits | undefined): void {
    this.safetyLimits = limits;
  }

  getSafetyLimits(): TradingSafetyLimits | undefined {
    return this.safetyLimits;
  }

  getRateLimitStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    this.rateLimiters.forEach((limiter, key) => {
      status[key] = limiter.getAvailableTokens();
    });
    return status;
  }
}