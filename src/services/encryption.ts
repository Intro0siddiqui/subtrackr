import type { AuthCredentials } from './auth';

export interface EncryptionKey {
  key: CryptoKey;
  keyId: string;
}

export interface EncryptedData {
  data: string;
  iv: string;
  keyId: string;
  algorithm: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: CryptoKey | null = null;
  private keyId: string = 'master_key_v1';

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the encryption service with a master key
   */
  async initialize(): Promise<void> {
    if (this.masterKey) return;

    try {
      // Try to get existing master key from storage
      const storedKeyData = localStorage.getItem('subtrackr_encryption_key');

      if (storedKeyData) {
        const keyData = JSON.parse(storedKeyData);
        const keyMaterial = await this.importKeyMaterial(keyData.keyMaterial);
        this.masterKey = await this.deriveMasterKey(keyMaterial, keyData.salt);
      } else {
        // Generate new master key
        await this.generateMasterKey();
      }
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Generate a new master key for encryption
   */
  private async generateMasterKey(): Promise<void> {
    try {
      // Generate a random salt
      const salt = crypto.getRandomValues(new Uint8Array(16));

      // Generate key material from user input or secure random
      const keyMaterial = await crypto.subtle.generateKey(
        {
          name: 'PBKDF2',
          hash: 'SHA-256'
        } as Pbkdf2Params,
        false,
        ['deriveBits', 'deriveKey']
      ) as CryptoKey;

      // Derive master key
      this.masterKey = await this.deriveMasterKey(keyMaterial, new Uint8Array(salt));

      // Store key material securely (in production, this would be more secure)
      const keyData = {
        keyMaterial: await this.exportKeyMaterial(keyMaterial),
        salt: Array.from(salt)
      };

      localStorage.setItem('subtrackr_encryption_key', JSON.stringify(keyData));
    } catch (error) {
      console.error('Failed to generate master key:', error);
      throw new Error('Master key generation failed');
    }
  }

  /**
   * Derive master key from key material and salt
   */
  private async deriveMasterKey(keyMaterial: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  /**
   * Export key material for storage
   */
  private async exportKeyMaterial(keyMaterial: CryptoKey): Promise<JsonWebKey> {
    return await crypto.subtle.exportKey('jwk', keyMaterial);
  }

  /**
   * Import key material from stored data
   */
  private async importKeyMaterial(keyData: JsonWebKey): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
  }

  /**
   * Encrypt credentials using AES-GCM
   */
  async encryptCredentials(credentials: AuthCredentials): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const data = JSON.stringify(credentials);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.masterKey,
        dataBuffer
      );

      // Convert to base64 strings
      const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      const ivBase64 = btoa(String.fromCharCode(...iv));

      return {
        data: encryptedData,
        iv: ivBase64,
        keyId: this.keyId,
        algorithm: 'AES-GCM'
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt credentials using AES-GCM
   */
  async decryptCredentials(encryptedData: EncryptedData): Promise<AuthCredentials> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Convert from base64
      const encryptedBuffer = Uint8Array.from(atob(encryptedData.data), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.masterKey,
        encryptedBuffer
      );

      // Convert back to string and parse JSON
      const decoder = new TextDecoder();
      const decryptedData = decoder.decode(decryptedBuffer);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Encrypt a string value
   */
  async encryptString(value: string): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(value);

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.masterKey,
        dataBuffer
      );

      // Convert to base64 strings
      const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      const ivBase64 = btoa(String.fromCharCode(...iv));

      return {
        data: encryptedData,
        iv: ivBase64,
        keyId: this.keyId,
        algorithm: 'AES-GCM'
      };
    } catch (error) {
      console.error('String encryption failed:', error);
      throw new Error('Failed to encrypt string');
    }
  }

  /**
   * Decrypt a string value
   */
  async decryptString(encryptedData: EncryptedData): Promise<string> {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      // Convert from base64
      const encryptedBuffer = Uint8Array.from(atob(encryptedData.data), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.masterKey,
        encryptedBuffer
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('String decryption failed:', error);
      throw new Error('Failed to decrypt string');
    }
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0];
      password += charset[randomIndex % charset.length];
    }

    return password;
  }

  /**
   * Hash a password using SHA-256
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(password);
    return hashedPassword === hash;
  }

  /**
   * Clear all stored encryption keys (for logout/reset)
   */
  clearKeys(): void {
    localStorage.removeItem('subtrackr_encryption_key');
    this.masterKey = null;
  }

  /**
   * Check if encryption service is ready
   */
  isReady(): boolean {
    return this.masterKey !== null;
  }
}

export const encryptionService = EncryptionService.getInstance();