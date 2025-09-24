/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  // Maximum requests per window
  maxRequests: number;
  // Time window in milliseconds
  windowMs: number;
  // Enable/disable rate limiting
  enabled: boolean;
}

/**
 * Rate limit info
 */
interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  isLimited: boolean;
}

/**
 * Rate Limiter - Prevent abuse through rate limiting
 * 
 * This class implements rate limiting to prevent abuse of the application
 * through excessive requests.
 */
export class RateLimiter {
  private static instance: RateLimiter;
 private config: RateLimitConfig;
  private requestCounts: Map<string, { count: number; resetTime: Date }>;
  private cleanupTimer: NodeJS.Timeout | null;

  private constructor() {
    this.config = {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      enabled: true
    };
    this.requestCounts = new Map();
    this.cleanupTimer = null;
    
    // Schedule periodic cleanup
    this.scheduleCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Configure rate limiting settings
   */
  configure(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a request is allowed
   */
  isAllowed(identifier: string): { allowed: boolean; info: RateLimitInfo } {
    if (!this.config.enabled) {
      return { 
        allowed: true, 
        info: { 
          remaining: Infinity, 
          resetTime: new Date(Date.now() + this.config.windowMs), 
          isLimited: false 
        } 
      };
    }

    const now = new Date();
    const record = this.requestCounts.get(identifier);

    // If no record exists or the window has expired, create a new one
    if (!record || record.resetTime <= now) {
      const newRecord = {
        count: 1,
        resetTime: new Date(now.getTime() + this.config.windowMs)
      };
      this.requestCounts.set(identifier, newRecord);
      
      return {
        allowed: true,
        info: {
          remaining: this.config.maxRequests - 1,
          resetTime: newRecord.resetTime,
          isLimited: false
        }
      };
    }

    // Check if we're within the limit
    if (record.count < this.config.maxRequests) {
      // Increment the count
      record.count++;
      this.requestCounts.set(identifier, record);
      
      return {
        allowed: true,
        info: {
          remaining: this.config.maxRequests - record.count,
          resetTime: record.resetTime,
          isLimited: false
        }
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      info: {
        remaining: 0,
        resetTime: record.resetTime,
        isLimited: true
      }
    };
  }

  /**
   * Get rate limit info without incrementing count
   */
  getRateLimitInfo(identifier: string): RateLimitInfo {
    if (!this.config.enabled) {
      return { 
        remaining: Infinity, 
        resetTime: new Date(Date.now() + this.config.windowMs), 
        isLimited: false 
      };
    }

    const now = new Date();
    const record = this.requestCounts.get(identifier);

    if (!record || record.resetTime <= now) {
      return {
        remaining: this.config.maxRequests,
        resetTime: new Date(now.getTime() + this.config.windowMs),
        isLimited: false
      };
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - record.count),
      resetTime: record.resetTime,
      isLimited: record.count >= this.config.maxRequests
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.requestCounts.delete(identifier);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requestCounts.clear();
 }

  /**
   * Get all current rate limit records
   */
  getAllRecords(): Map<string, { count: number; resetTime: Date }> {
    return new Map(this.requestCounts);
  }

  /**
   * Schedule periodic cleanup of expired records
   */
  private scheduleCleanup(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    this.cleanupTimer = setTimeout(() => {
      try {
        this.cleanupExpiredRecords();
      } catch (error) {
        console.error('Rate limiter cleanup failed:', error);
      } finally {
        // Schedule next cleanup
        this.scheduleCleanup();
      }
    }, this.config.windowMs);
  }

  /**
   * Clean up expired rate limit records
   */
  private cleanupExpiredRecords(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [identifier, record] of this.requestCounts.entries()) {
      if (record.resetTime <= now) {
        this.requestCounts.delete(identifier);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  /**
   * Get rate limiter statistics
   */
  getStats(): {
    totalRecords: number;
    limitedIdentifiers: number;
    config: RateLimitConfig;
  } {
    const now = new Date();
    let limitedCount = 0;
    
    for (const record of this.requestCounts.values()) {
      if (record.count >= this.config.maxRequests && record.resetTime > now) {
        limitedCount++;
      }
    }
    
    return {
      totalRecords: this.requestCounts.size,
      limitedIdentifiers: limitedCount,
      config: { ...this.config }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.requestCounts.clear();
  }
}

// Export singleton instance
export const rateLimiter = RateLimiter.getInstance();