export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens: number = 1): Promise<void> {
    await this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    const deficit = tokens - this.tokens;
    const waitTime = deficit / this.refillRate;
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    await this.consume(tokens);
  }

  private async refill(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillAmount = (elapsed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

export class MultiEndpointRateLimiter {
  private limiters: Map<string, TokenBucket> = new Map();
  private defaultConfig: TokenBucketConfig;

  constructor(defaultConfig: TokenBucketConfig = { capacity: 1500, refillRate: 25 }) {
    this.defaultConfig = defaultConfig;
  }

  getLimiter(endpoint: string, config?: TokenBucketConfig): TokenBucket {
    if (!this.limiters.has(endpoint)) {
      this.limiters.set(endpoint, new TokenBucket(config || this.defaultConfig));
    }
    return this.limiters.get(endpoint)!;
  }

  async consume(endpoint: string, tokens: number = 1, config?: TokenBucketConfig): Promise<void> {
    const limiter = this.getLimiter(endpoint, config);
    await limiter.consume(tokens);
  }

  getAvailableTokens(endpoint: string): number {
    const limiter = this.limiters.get(endpoint);
    return limiter ? limiter.getAvailableTokens() : this.defaultConfig.capacity;
  }

  reset(endpoint?: string): void {
    if (endpoint) {
      this.limiters.get(endpoint)?.reset();
    } else {
      this.limiters.forEach(limiter => limiter.reset());
    }
  }
}

export const coinDcxRateLimits = {
  orders: { capacity: 2000, refillRate: 33.33 },
  cancelAll: { capacity: 30, refillRate: 0.5 },
  positions: { capacity: 50, refillRate: 0.83 },
  account: { capacity: 200, refillRate: 3.33 },
  marketData: { capacity: 300, refillRate: 5 },
  wallet: { capacity: 100, refillRate: 1.67 },
  default: { capacity: 1500, refillRate: 25 },
} as const;