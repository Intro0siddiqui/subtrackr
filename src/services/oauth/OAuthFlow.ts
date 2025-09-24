import { Base64 } from 'js-base64';
import { OAuthProvider } from './OAuthProvider';
import { PKCEPair, OAuthTokens } from '../../types/oauth';
import { tokenManager } from './TokenManager';

/**
 * OAuth flow types
 */
export enum OAuthFlowType {
  AUTHORIZATION_CODE = 'authorization_code',
  AUTHORIZATION_CODE_PKCE = 'authorization_code_pkce',
  CLIENT_CREDENTIALS = 'client_credentials',
  IMPLICIT = 'implicit'
}

/**
 * OAuth flow configuration
 */
interface OAuthFlowConfig {
  redirectUri: string;
  state?: string;
  scopes?: string[];
  flowType: OAuthFlowType;
}

/**
 * Authorization URL result
 */
interface AuthorizationUrlResult {
  url: string;
  state: string;
  codeVerifier?: string;
}

/**
 * OAuth flow handler with PKCE implementation
 */
export class OAuthFlow {
  private static instance: OAuthFlow;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): OAuthFlow {
    if (!OAuthFlow.instance) {
      OAuthFlow.instance = new OAuthFlow();
    }
    return OAuthFlow.instance;
  }

  /**
   * Generate cryptographically secure random string
   */
  private generateRandomString(length: number = 43): string {
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto.getRandomValues
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    // Convert to base64url format (RFC 7636)
    return Base64.fromUint8Array(array, true)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge from code verifier
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    try {
      // Use Web Crypto API if available
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const base64Digest = Base64.fromUint8Array(new Uint8Array(digest), true);
        return base64Digest
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } else {
        // Fallback using crypto-js (if available)
        const CryptoJS = await import('crypto-js');
        const hash = CryptoJS.SHA256(codeVerifier);
        const base64Hash = hash.toString(CryptoJS.enc.Base64);
        return base64Hash
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      }
    } catch (error) {
      console.error('Failed to generate code challenge:', error);
      throw new Error('PKCE code challenge generation failed');
    }
  }

  /**
   * Generate PKCE pair
   */
  async generatePKCEPair(): Promise<PKCEPair> {
    const codeVerifier = this.generateRandomString(128); // 128 characters for better security
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  /**
   * Generate OAuth state parameter
   */
  generateState(): string {
    return this.generateRandomString(32);
  }

  /**
   * Validate state parameter
   */
  validateState(providedState: string, expectedState: string): boolean {
    try {
      return providedState === expectedState;
    } catch (error) {
      console.error('State validation failed:', error);
      return false;
    }
  }

  /**
   * Build authorization URL
   */
  async buildAuthorizationUrl(
    provider: OAuthProvider,
    config: OAuthFlowConfig
  ): Promise<AuthorizationUrlResult> {
    const state = config.state || this.generateState();
    let url: string;
    let codeVerifier: string | undefined;

    if (config.flowType === OAuthFlowType.AUTHORIZATION_CODE_PKCE) {
      const pkcePair = await this.generatePKCEPair();
      codeVerifier = pkcePair.codeVerifier;
      url = provider.getAuthorizationUrl(state, pkcePair.codeChallenge);
    } else {
      url = provider.getAuthorizationUrl(state);
    }

    // Add additional parameters
    const urlObj = new URL(url);
    urlObj.searchParams.set('redirect_uri', config.redirectUri);

    if (config.scopes && config.scopes.length > 0) {
      urlObj.searchParams.set('scope', config.scopes.join(' '));
    }

    // Add response_type if not already present
    if (!urlObj.searchParams.has('response_type')) {
      urlObj.searchParams.set('response_type', 'code');
    }

    return {
      url: urlObj.toString(),
      state,
      codeVerifier
    };
  }

  /**
   * Handle authorization callback
   */
  async handleCallback(
    provider: OAuthProvider,
    callbackUrl: string,
    expectedState: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    try {
      // Parse callback URL
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Check for OAuth errors
      if (error) {
        throw new Error(`OAuth error: ${error} - ${url.searchParams.get('error_description') || 'Unknown error'}`);
      }

      // Validate state parameter
      if (!state || !this.validateState(state, expectedState)) {
        throw new Error('Invalid state parameter');
      }

      // Validate authorization code
      if (!code) {
        throw new Error('Authorization code not found');
      }

      // Exchange code for tokens
      const tokens = await provider.exchangeCodeForTokens(
        code,
        codeVerifier,
        new URL(callbackUrl).origin + '/oauth/callback'
      );

      return tokens;
    } catch (error) {
      console.error('Failed to handle OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Complete OAuth flow
   */
  async completeFlow(
    provider: OAuthProvider,
    userId: string,
    callbackUrl: string,
    expectedState: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    try {
      const tokens = await this.handleCallback(provider, callbackUrl, expectedState, codeVerifier);

      // Store tokens securely
      await tokenManager.storeTokens(userId, provider.getId(), tokens);

      console.log(`OAuth flow completed for user ${userId}, provider ${provider.getId()}`);
      return tokens;
    } catch (error) {
      console.error('Failed to complete OAuth flow:', error);
      throw error;
    }
  }

  /**
   * Initiate OAuth flow
   */
  async initiateFlow(
    provider: OAuthProvider,
    userId: string,
    redirectUri: string,
    options: {
      scopes?: string[];
      usePKCE?: boolean;
      customState?: string;
    } = {}
  ): Promise<AuthorizationUrlResult> {
    try {
      const flowType = options.usePKCE !== false
        ? OAuthFlowType.AUTHORIZATION_CODE_PKCE
        : OAuthFlowType.AUTHORIZATION_CODE;

      const config: OAuthFlowConfig = {
        redirectUri,
        state: options.customState,
        scopes: options.scopes,
        flowType
      };

      const result = await this.buildAuthorizationUrl(provider, config);

      // Store flow state for later validation
      // In a real application, you might want to store this in a database or cache
      sessionStorage.setItem(`oauth_state_${provider.getId()}_${userId}`, result.state);
      if (result.codeVerifier) {
        sessionStorage.setItem(`oauth_verifier_${provider.getId()}_${userId}`, result.codeVerifier);
      }

      console.log(`OAuth flow initiated for user ${userId}, provider ${provider.getId()}`);
      return result;
    } catch (error) {
      console.error('Failed to initiate OAuth flow:', error);
      throw error;
    }
  }

  /**
   * Get stored flow state
   */
  getStoredState(providerId: string, userId: string): string | null {
    try {
      return sessionStorage.getItem(`oauth_state_${providerId}_${userId}`);
    } catch (error) {
      console.error('Failed to get stored state:', error);
      return null;
    }
  }

  /**
   * Get stored code verifier
   */
  getStoredCodeVerifier(providerId: string, userId: string): string | null {
    try {
      return sessionStorage.getItem(`oauth_verifier_${providerId}_${userId}`);
    } catch (error) {
      console.error('Failed to get stored code verifier:', error);
      return null;
    }
  }

  /**
   * Clear stored flow data
   */
  clearStoredFlowData(providerId: string, userId: string): void {
    try {
      sessionStorage.removeItem(`oauth_state_${providerId}_${userId}`);
      sessionStorage.removeItem(`oauth_verifier_${providerId}_${userId}`);
    } catch (error) {
      console.error('Failed to clear stored flow data:', error);
    }
  }

  /**
   * Validate authorization callback parameters
   */
  validateCallbackParams(params: URLSearchParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      errors.push(`OAuth error: ${error}`);
      if (params.get('error_description')) {
        errors.push(`Error description: ${params.get('error_description')}`);
      }
    }

    if (!code && !error) {
      errors.push('Authorization code is required');
    }

    if (!state) {
      errors.push('State parameter is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse callback URL and extract parameters
   */
  parseCallbackUrl(callbackUrl: string): URLSearchParams {
    try {
      const url = new URL(callbackUrl);
      return url.searchParams;
    } catch (error) {
      console.error('Failed to parse callback URL:', error);
      return new URLSearchParams();
    }
  }

  /**
   * Check if URL is an OAuth callback
   */
  isCallbackUrl(url: string, expectedRedirectUri: string): boolean {
    try {
      const callbackUrl = new URL(url);
      const expectedUrl = new URL(expectedRedirectUri);
      return callbackUrl.origin === expectedUrl.origin && callbackUrl.pathname === expectedUrl.pathname;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const oauthFlow = OAuthFlow.getInstance();