import CryptoJS from 'crypto-js';
import { oauthDatabase } from '../oauthDatabase';
import { OAuthTokens, OAuthConnection, OAuthConnectionStatus } from '../../types/oauth';
import { providerRegistry } from './ProviderRegistry';

/**
 * Configuration for token encryption
 */
interface TokenEncryptionConfig {
  key: string;
  algorithm: string;
}

/**
 * Token refresh result
 */
interface TokenRefreshResult {
  success: boolean;
  tokens?: OAuthTokens;
  error?: string;
}

/**
 * Secure token storage, refresh, and rotation manager
 */
export class TokenManager {
  private static instance: TokenManager;
  private encryptionConfig: TokenEncryptionConfig;

  private constructor() {
    // In production, this should come from environment variables
    this.encryptionConfig = {
      key: process.env.OAUTH_ENCRYPTION_KEY || 'default-encryption-key-change-in-production',
      algorithm: 'AES-256-CBC'
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Encrypt token data
   */
  private encryptToken(token: string): string {
    try {
      return CryptoJS.AES.encrypt(token, this.encryptionConfig.key).toString();
    } catch (error) {
      console.error('Failed to encrypt token:', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt token data
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionConfig.key);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Failed to decrypt token:', error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * Store tokens securely
   */
  async storeTokens(
    userId: string,
    providerId: string,
    tokens: OAuthTokens
  ): Promise<OAuthConnection> {
    try {
      const encryptedAccessToken = this.encryptToken(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? this.encryptToken(tokens.refreshToken)
        : undefined;

      const connection: Omit<OAuthConnection, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        providerId,
        status: OAuthConnectionStatus.ACTIVE,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        metadata: {
          encrypted: true,
          storedAt: new Date().toISOString()
        }
      };

      const result = await oauthDatabase.createConnection(connection);
      console.log(`Stored tokens for user ${userId}, provider ${providerId}`);
      return result;
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error(`Failed to store tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve tokens for a user and provider
   */
  async getTokens(userId: string, providerId: string): Promise<OAuthTokens | null> {
    try {
      const connection = await oauthDatabase.getConnectionByUserAndProvider(userId, providerId);

      if (!connection) {
        return null;
      }

      const decryptedAccessToken = this.decryptToken(connection.accessToken);
      const decryptedRefreshToken = connection.refreshToken
        ? this.decryptToken(connection.refreshToken)
        : undefined;

      return {
        accessToken: decryptedAccessToken,
        refreshToken: decryptedRefreshToken,
        expiresAt: connection.expiresAt,
        tokenType: connection.tokenType,
        scope: connection.scope
      };
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Refresh tokens automatically
   */
  async refreshTokens(
    userId: string,
    providerId: string
  ): Promise<TokenRefreshResult> {
    try {
      const connection = await oauthDatabase.getConnectionByUserAndProvider(userId, providerId);

      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      if (!connection.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      const provider = providerRegistry.getProvider(providerId);
      if (!provider) {
        return { success: false, error: 'Provider not found' };
      }

      const decryptedRefreshToken = this.decryptToken(connection.refreshToken);
      const newTokens = await provider.refreshAccessToken(decryptedRefreshToken);

      // Store the new tokens
      const encryptedAccessToken = this.encryptToken(newTokens.accessToken);
      const encryptedRefreshToken = newTokens.refreshToken
        ? this.encryptToken(newTokens.refreshToken)
        : undefined;

      await oauthDatabase.updateConnection(connection.id, {
        userId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: newTokens.expiresAt,
        tokenType: newTokens.tokenType,
        scope: newTokens.scope,
        status: OAuthConnectionStatus.ACTIVE
      });

      console.log(`Refreshed tokens for user ${userId}, provider ${providerId}`);
      return { success: true, tokens: newTokens };
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get valid tokens (refresh if needed)
   */
  async getValidTokens(
    userId: string,
    providerId: string
  ): Promise<OAuthTokens | null> {
    try {
      let tokens = await this.getTokens(userId, providerId);

      if (!tokens) {
        return null;
      }

      // Check if token is expired or about to expire
      const now = new Date();
      const expiresAt = tokens.expiresAt;
      const needsRefresh = !expiresAt || (expiresAt.getTime() - now.getTime()) <= (5 * 60 * 1000); // 5 minutes buffer

      if (needsRefresh && tokens.refreshToken) {
        console.log(`Token expired or expiring soon, refreshing for user ${userId}, provider ${providerId}`);
        const refreshResult = await this.refreshTokens(userId, providerId);

        if (refreshResult.success && refreshResult.tokens) {
          tokens = refreshResult.tokens;
        } else {
          console.error(`Failed to refresh token: ${refreshResult.error}`);
          return null;
        }
      }

      return tokens;
    } catch (error) {
      console.error('Failed to get valid tokens:', error);
      return null;
    }
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(userId: string, providerId: string): Promise<boolean> {
    try {
      const connection = await oauthDatabase.getConnectionByUserAndProvider(userId, providerId);

      if (!connection) {
        return false;
      }

      const provider = providerRegistry.getProvider(providerId);
      if (provider) {
        try {
          const decryptedAccessToken = this.decryptToken(connection.accessToken);
          await provider.revokeTokens(decryptedAccessToken, connection.refreshToken);
        } catch (error) {
          console.error('Failed to revoke tokens with provider:', error);
          // Continue with local revocation even if provider revocation fails
        }
      }

      await oauthDatabase.updateConnection(connection.id, {
        userId,
        status: OAuthConnectionStatus.REVOKED
      });

      console.log(`Revoked tokens for user ${userId}, provider ${providerId}`);
      return true;
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const count = await oauthDatabase.cleanupExpiredTokens();
      console.log(`Cleaned up ${count} expired tokens`);
      return count;
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get token status for a user and provider
   */
  async getTokenStatus(userId: string, providerId: string): Promise<{
    hasTokens: boolean;
    isExpired: boolean;
    expiresAt?: Date;
    canRefresh: boolean;
  }> {
    try {
      const tokens = await this.getTokens(userId, providerId);

      if (!tokens) {
        return {
          hasTokens: false,
          isExpired: true,
          canRefresh: false
        };
      }

      const now = new Date();
      const expiresAt = tokens.expiresAt;
      const isExpired = !expiresAt || expiresAt <= now;

      return {
        hasTokens: true,
        isExpired,
        expiresAt,
        canRefresh: !!tokens.refreshToken
      };
    } catch (error) {
      console.error('Failed to get token status:', error);
      return {
        hasTokens: false,
        isExpired: true,
        canRefresh: false
      };
    }
  }

  /**
   * Update encryption key (for key rotation)
   */
  updateEncryptionKey(newKey: string): void {
    this.encryptionConfig.key = newKey;
    console.log('Updated token encryption key');
  }

  /**
   * Validate token format
   */
  private validateTokenFormat(token: string): boolean {
    // Basic validation - tokens should be non-empty strings
    return typeof token === 'string' && token.length > 0;
  }

  /**
   * Get all connections for a user
   */
  async getUserConnections(userId: string): Promise<OAuthConnection[]> {
    try {
      return await oauthDatabase.getUserConnections(userId);
    } catch (error) {
      console.error('Failed to get user connections:', error);
      return [];
    }
  }

  /**
   * Check if user has active connection to provider
   */
  async hasActiveConnection(userId: string, providerId: string): Promise<boolean> {
    try {
      return await oauthDatabase.hasActiveConnection(userId, providerId);
    } catch (error) {
      console.error('Failed to check active connection:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();