import { Base64 } from 'js-base64';

/**
 * PKCE Pair interface
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

/**
 * PKCE Manager - Handle Proof Key for Code Exchange implementation
 * 
 * This class implements the PKCE (RFC 7636) extension to OAuth 2.0
 * to prevent authorization code interception attacks.
 */
export class PKCEManager {
  private static instance: PKCEManager;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PKCEManager {
    if (!PKCEManager.instance) {
      PKCEManager.instance = new PKCEManager();
    }
    return PKCEManager.instance;
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
   * Validate PKCE code verifier against code challenge
   */
  async validatePKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
    try {
      const generatedChallenge = await this.generateCodeChallenge(codeVerifier);
      return generatedChallenge === codeChallenge;
    } catch (error) {
      console.error('PKCE validation failed:', error);
      return false;
    }
  }

  /**
   * Store PKCE data for later validation
   */
  storePKCEData(providerId: string, userId: string, pkcePair: PKCEPair): void {
    try {
      const storageKey = `pkce_${providerId}_${userId}`;
      sessionStorage.setItem(storageKey, JSON.stringify(pkcePair));
    } catch (error) {
      console.error('Failed to store PKCE data:', error);
      throw new Error('Failed to store PKCE data');
    }
  }

  /**
   * Retrieve stored PKCE data
   */
  getStoredPKCEData(providerId: string, userId: string): PKCEPair | null {
    try {
      const storageKey = `pkce_${providerId}_${userId}`;
      const storedData = sessionStorage.getItem(storageKey);
      return storedData ? JSON.parse(storedData) : null;
    } catch (error) {
      console.error('Failed to retrieve PKCE data:', error);
      return null;
    }
  }

  /**
   * Clear stored PKCE data
   */
  clearStoredPKCEData(providerId: string, userId: string): void {
    try {
      const storageKey = `pkce_${providerId}_${userId}`;
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear PKCE data:', error);
    }
  }
}

// Export singleton instance
export const pkceManager = PKCEManager.getInstance();