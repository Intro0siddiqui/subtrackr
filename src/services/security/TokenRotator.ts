import { OAuthTokens } from '../../types/oauth';
import { tokenManager } from '../oauth/TokenManager';
import { providerRegistry } from '../oauth/ProviderRegistry';
import { securityAuditor, SecurityEventType } from './SecurityAuditor';

/**
 * Token rotation configuration
 */
interface TokenRotationConfig {
  // Buffer time before expiration to rotate tokens (in milliseconds)
  rotationBuffer: number;
  // Maximum number of retry attempts for token refresh
  maxRetryAttempts: number;
  // Delay between retry attempts (in milliseconds)
  retryDelay: number;
}

/**
 * Token rotation result
 */
interface TokenRotationResult {
  success: boolean;
  tokens?: OAuthTokens;
  error?: string;
}

/**
 * Token Rotator - Manage token rotation and refresh cycles
 * 
 * This class handles automatic token rotation before expiration
 * and manages retry logic for failed refresh attempts.
 */
export class TokenRotator {
  private static instance: TokenRotator;
  private config: TokenRotationConfig;
  private rotationTimers: Map<string, NodeJS.Timeout>;

  private constructor() {
    this.config = {
      rotationBuffer: 5 * 60 * 1000, // 5 minutes
      maxRetryAttempts: 3,
      retryDelay: 1000 // 1 second
    };
    this.rotationTimers = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenRotator {
    if (!TokenRotator.instance) {
      TokenRotator.instance = new TokenRotator();
    }
    return TokenRotator.instance;
  }

  /**
   * Configure token rotation settings
   */
  configure(config: Partial<TokenRotationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get valid tokens with automatic rotation
   */
  async getValidTokens(userId: string, providerId: string): Promise<OAuthTokens | null> {
    try {
      let tokens = await tokenManager.getTokens(userId, providerId);

      if (!tokens) {
        return null;
      }

      // Check if token needs rotation
      if (this.shouldRotateTokens(tokens)) {
        console.log(`Token needs rotation for user ${userId}, provider ${providerId}`);
        const rotationResult = await this.rotateTokens(userId, providerId);
        
        if (rotationResult.success && rotationResult.tokens) {
          tokens = rotationResult.tokens;
        } else {
          console.error(`Failed to rotate tokens: ${rotationResult.error}`);
          return null;
        }
      }

      return tokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get valid tokens:', errorMessage);
      await securityAuditor.logSecurityEvent('TOKEN_ROTATION_ERROR', {
        userId,
        providerId,
        error: errorMessage
      });
      return null;
    }
  }

  /**
   * Check if tokens should be rotated
   */
  private shouldRotateTokens(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) {
      return false;
    }

    const now = new Date();
    const timeUntilExpiration = tokens.expiresAt.getTime() - now.getTime();
    
    // Rotate if token expires within the buffer time
    return timeUntilExpiration <= this.config.rotationBuffer;
  }

  /**
   * Rotate tokens by refreshing them
   */
  async rotateTokens(userId: string, providerId: string): Promise<TokenRotationResult> {
    try {
      const connection = await tokenManager.getUserConnections(userId);
      const providerConnection = connection.find(conn => conn.providerId === providerId);
      
      if (!providerConnection) {
        return { success: false, error: 'No connection found for provider' };
      }

      // Attempt to refresh tokens
      const refreshResult = await this.refreshTokensWithRetry(userId, providerId);
      
      if (refreshResult.success && refreshResult.tokens) {
        // Schedule next rotation
        this.scheduleNextRotation(userId, providerId, refreshResult.tokens);
        
        await securityAuditor.logSecurityEvent('TOKEN_ROTATED', {
          userId,
          providerId,
          success: true
        });
        
        return refreshResult;
      } else {
        await securityAuditor.logSecurityEvent('TOKEN_ROTATION_FAILED', {
          userId,
          providerId,
          error: refreshResult.error
        });
        
        return refreshResult;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Token rotation failed:', errorMessage);
      
      await securityAuditor.logSecurityEvent('TOKEN_ROTATION_ERROR', {
        userId,
        providerId,
        error: errorMessage
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Refresh tokens with retry logic
   */
  private async refreshTokensWithRetry(userId: string, providerId: string, attempt: number = 1): Promise<TokenRotationResult> {
    try {
      const refreshResult = await tokenManager.refreshTokens(userId, providerId);
      
      if (refreshResult.success && refreshResult.tokens) {
        return { success: true, tokens: refreshResult.tokens };
      } else if (attempt < this.config.maxRetryAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        return this.refreshTokensWithRetry(userId, providerId, attempt + 1);
      } else {
        return { success: false, error: refreshResult.error || 'Max retry attempts reached' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt < this.config.maxRetryAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        return this.refreshTokensWithRetry(userId, providerId, attempt + 1);
      } else {
        return { success: false, error: errorMessage };
      }
    }
  }

  /**
   * Schedule next token rotation
   */
  private scheduleNextRotation(userId: string, providerId: string, tokens: OAuthTokens): void {
    // Clear any existing timer for this user/provider
    const timerKey = `${userId}_${providerId}`;
    const existingTimer = this.rotationTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (!tokens.expiresAt) {
      return;
    }

    const now = new Date();
    const timeUntilExpiration = tokens.expiresAt.getTime() - now.getTime();
    
    // Schedule rotation before expiration
    const rotationTime = Math.max(
      timeUntilExpiration - this.config.rotationBuffer,
      60 * 1000 // Minimum 1 minute
    );

    if (rotationTime > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.rotateTokens(userId, providerId);
        } catch (error) {
          console.error('Scheduled token rotation failed:', error);
        } finally {
          this.rotationTimers.delete(timerKey);
        }
      }, rotationTime);

      this.rotationTimers.set(timerKey, timer);
      console.log(`Scheduled token rotation for user ${userId}, provider ${providerId} in ${rotationTime}ms`);
    }
  }

  /**
   * Cancel scheduled rotation
   */
  cancelScheduledRotation(userId: string, providerId: string): void {
    const timerKey = `${userId}_${providerId}`;
    const existingTimer = this.rotationTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.rotationTimers.delete(timerKey);
    }
  }

  /**
   * Cancel all scheduled rotations
   */
  cancelAllScheduledRotations(): void {
    for (const timer of this.rotationTimers.values()) {
      clearTimeout(timer);
    }
    this.rotationTimers.clear();
  }

  /**
   * Force immediate token rotation
   */
  async forceRotation(userId: string, providerId: string): Promise<TokenRotationResult> {
    return this.rotateTokens(userId, providerId);
  }

  /**
   * Check token health status
   */
  async getTokenHealth(userId: string, providerId: string): Promise<{
    isValid: boolean;
    needsRotation: boolean;
    expiresAt?: Date;
    canRefresh: boolean;
  }> {
    try {
      const tokens = await tokenManager.getTokens(userId, providerId);
      
      if (!tokens) {
        return {
          isValid: false,
          needsRotation: false,
          canRefresh: false
        };
      }

      const now = new Date();
      const expiresAt = tokens.expiresAt;
      const isValid = !!expiresAt && expiresAt > now;
      const needsRotation = this.shouldRotateTokens(tokens);
      
      return {
        isValid,
        needsRotation,
        expiresAt,
        canRefresh: !!tokens.refreshToken
      };
    } catch (error) {
      console.error('Failed to check token health:', error);
      return {
        isValid: false,
        needsRotation: false,
        canRefresh: false
      };
    }
  }
}

// Export singleton instance
export const tokenRotator = TokenRotator.getInstance();