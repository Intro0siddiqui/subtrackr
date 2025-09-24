/**
 * Encryption Service - Enhanced data encryption service
 * 
 * This service provides advanced encryption capabilities for sensitive data
 * including key rotation, multiple encryption algorithms, and secure key management.
 */

// Import the existing encryption service for compatibility
import { encryptionService as existingEncryptionService, EncryptedData } from '../encryption';

/**
 * Enhanced encryption key interface
 */
export interface EnhancedEncryptionKey {
  key: CryptoKey;
  keyId: string;
  createdAt: Date;
  algorithm: string;
}

/**
 * Key rotation configuration
 */
interface KeyRotationConfig {
  // Key rotation interval (in milliseconds)
  rotationInterval: number;
  // Number of old keys to keep for decryption
  keyHistorySize: number;
}

/**
 * Encryption algorithms supported
 */
export enum EncryptionAlgorithm {
  AES_GCM = 'AES-GCM',
  AES_CBC = 'AES-CBC'
}

/**
 * Enhanced Encryption Service
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private keys: Map<string, EnhancedEncryptionKey>;
  private currentKeyId: string;
  private config: KeyRotationConfig;
  private rotationTimer: NodeJS.Timeout | null;

  private constructor() {
    this.keys = new Map();
    this.currentKeyId = 'default';
    this.config = {
      rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      keyHistorySize: 3
    };
    this.rotationTimer = null;
    
    // Initialize with existing encryption service
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the encryption service
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize the existing encryption service
      await existingEncryptionService.initialize();
      
      // Schedule key rotation
      this.scheduleKeyRotation();
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Schedule automatic key rotation
   */
  private scheduleKeyRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    this.rotationTimer = setTimeout(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        console.error('Key rotation failed:', error);
      } finally {
        // Schedule next rotation
        this.scheduleKeyRotation();
      }
    }, this.config.rotationInterval);
 }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    try {
      console.log('Rotating encryption keys...');
      
      // Generate new key
      const newKeyId = `key_${Date.now()}`;
      const newKey = await this.generateKey();
      
      // Store new key
      const enhancedKey: EnhancedEncryptionKey = {
        key: newKey,
        keyId: newKeyId,
        createdAt: new Date(),
        algorithm: 'AES-GCM'
      };
      
      this.keys.set(newKeyId, enhancedKey);
      this.currentKeyId = newKeyId;
      
      // Clean up old keys
      this.cleanupOldKeys();
      
      console.log(`Encryption keys rotated. New key ID: ${newKeyId}`);
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw new Error('Key rotation failed');
    }
  }

  /**
   * Generate a new encryption key
   */
  private async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cleanup old keys based on history size
   */
  private cleanupOldKeys(): void {
    if (this.keys.size <= this.config.keyHistorySize) {
      return;
    }

    // Sort keys by creation date
    const sortedKeys = Array.from(this.keys.entries())
      .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());

    // Remove oldest keys
    for (let i = this.config.keyHistorySize; i < sortedKeys.length; i++) {
      const [keyId] = sortedKeys[i];
      this.keys.delete(keyId);
    }
  }

  /**
   * Get encryption key by ID
   */
  private getKey(keyId: string): EnhancedEncryptionKey | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Get current encryption key
   */
  private getCurrentKey(): EnhancedEncryptionKey {
    const key = this.keys.get(this.currentKeyId);
    if (!key) {
      throw new Error('No current encryption key available');
    }
    return key;
  }

  /**
   * Encrypt data with specified algorithm
   */
  async encrypt(
    data: string | object,
    algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_GCM
  ): Promise<EncryptedData> {
    try {
      const currentKey = this.getCurrentKey();
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataString);

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: algorithm,
          iv: iv
        },
        currentKey.key,
        dataBuffer
      );

      // Convert to base64 strings
      const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      const ivBase64 = btoa(String.fromCharCode(...iv));

      return {
        data: encryptedData,
        iv: ivBase64,
        keyId: currentKey.keyId,
        algorithm: algorithm
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      const key = this.getKey(encryptedData.keyId) || this.getCurrentKey();
      
      // Convert from base64
      const encryptedBuffer = Uint8Array.from(atob(encryptedData.data), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm || 'AES-GCM',
          iv: iv
        },
        key.key,
        encryptedBuffer
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt object data
   */
 async encryptObject<T>(data: T): Promise<EncryptedData> {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt object data
   */
  async decryptObject<T>(encryptedData: EncryptedData): Promise<T> {
    const decryptedString = await this.decrypt(encryptedData);
    return JSON.parse(decryptedString);
  }

  /**
   * Re-encrypt data with current key (for key rotation)
   */
  async reEncrypt(encryptedData: EncryptedData): Promise<EncryptedData> {
    try {
      // Decrypt with old key
      const decryptedData = await this.decrypt(encryptedData);
      
      // Encrypt with current key
      return this.encrypt(decryptedData, encryptedData.algorithm as EncryptionAlgorithm);
    } catch (error) {
      console.error('Re-encryption failed:', error);
      throw new Error('Failed to re-encrypt data');
    }
  }

  /**
   * Get key information
   */
  getKeyInfo(): {
    currentKeyId: string;
    keyCount: number;
    nextRotation: Date | null;
  } {
    return {
      currentKeyId: this.currentKeyId,
      keyCount: this.keys.size,
      nextRotation: this.rotationTimer ? new Date(Date.now() + this.config.rotationInterval) : null
    };
  }

  /**
   * Configure key rotation
   */
  configureKeyRotation(config: Partial<KeyRotationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reschedule rotation with new interval
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.scheduleKeyRotation();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    
    this.keys.clear();
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();

// Export existing encryption service for backward compatibility
export { existingEncryptionService };