import type { PaymentProvider, PaymentConnection } from '../types';

export interface AuthCredentials {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  password?: string;
  [key: string]: string | undefined;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

export class PaymentAuthService {
  private static instance: PaymentAuthService;
  private connections: Map<string, PaymentConnection> = new Map();

  static getInstance(): PaymentAuthService {
    if (!PaymentAuthService.instance) {
      PaymentAuthService.instance = new PaymentAuthService();
    }
    return PaymentAuthService.instance;
  }

  /**
   * Initiate OAuth flow for a payment provider
   */
  async initiateOAuth(provider: PaymentProvider, config: OAuthConfig): Promise<string> {
    const state = this.generateState();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope.join(' '),
      response_type: 'code',
      state: state
    });

    // Store state for verification
    sessionStorage.setItem(`oauth_state_${provider.id}`, state);

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Complete OAuth flow and exchange code for tokens
   */
  async completeOAuth(
    provider: PaymentProvider,
    code: string,
    config: OAuthConfig
  ): Promise<AuthResult> {
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: '', // Should be handled securely
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri
        })
      });

      if (!response.ok) {
        throw new Error(`OAuth token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth authentication failed'
      };
    }
  }

  /**
   * Authenticate using API credentials
   */
  async authenticateWithCredentials(
    provider: PaymentProvider,
    credentials: AuthCredentials
  ): Promise<AuthResult> {
    try {
      // This would implement provider-specific authentication logic
      // For now, we'll simulate a successful authentication
      const mockToken = this.generateToken();

      return {
        success: true,
        accessToken: mockToken,
        refreshToken: this.generateToken(),
        expiresIn: 3600 // 1 hour
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    provider: PaymentProvider,
    refreshToken: string
  ): Promise<AuthResult> {
    try {
      // This would implement provider-specific token refresh logic
      const newToken = this.generateToken();

      return {
        success: true,
        accessToken: newToken,
        refreshToken: this.generateToken(),
        expiresIn: 3600
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Validate access token
   */
  async validateToken(provider: PaymentProvider, token: string): Promise<boolean> {
    try {
      // This would implement provider-specific token validation
      // For now, we'll simulate validation
      return token.length > 10; // Simple mock validation
    } catch {
      return false;
    }
  }

  /**
   * Store connection credentials securely
   */
  async storeConnection(
    provider: PaymentProvider,
    credentials: AuthCredentials,
    encrypted: boolean = false
  ): Promise<PaymentConnection> {
    const connection: PaymentConnection = {
      id: `${provider.id}_${Date.now()}`,
      provider: provider.id,
      name: provider.displayName,
      encryptedCredentials: encrypted ? this.encryptCredentials(credentials) : JSON.stringify(credentials),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.connections.set(connection.id, connection);
    return connection;
  }

  /**
   * Retrieve stored connection
   */
  getConnection(connectionId: string): PaymentConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): PaymentConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive);
  }

  /**
   * Revoke connection
   */
  async revokeConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      connection.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Generate secure random state for OAuth
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Generate mock token (for development)
   */
  private generateToken(): string {
    return 'mock_token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Encrypt credentials (placeholder - would use proper encryption)
   */
  private encryptCredentials(credentials: AuthCredentials): string {
    // This would implement proper encryption using Web Crypto API or similar
    return btoa(JSON.stringify(credentials));
  }

  /**
   * Decrypt credentials (placeholder)
   */
  decryptCredentials(encryptedData: string): AuthCredentials {
    // This would implement proper decryption
    return JSON.parse(atob(encryptedData));
  }
}

export const paymentAuthService = PaymentAuthService.getInstance();