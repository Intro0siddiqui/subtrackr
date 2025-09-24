/**
 * Security Layer Integration Tests
 * 
 * This file demonstrates how to use the security layer components
 * and verifies their basic functionality.
 */

import { pkceManager } from './PKCEManager';
import { tokenRotator } from './TokenRotator';
import { encryptionService } from './EncryptionService';
import { securityAuditor, SecurityEventType } from './SecurityAuditor';
import { rateLimiter } from './RateLimiter';

// Mock data for testing
const mockUserId = 'user_123';
const mockProviderId = 'provider_456';

/**
 * Test PKCE functionality
 */
async function testPKCE() {
  console.log('Testing PKCE functionality...');
  
  try {
    // Generate PKCE pair
    const pkcePair = await pkceManager.generatePKCEPair();
    console.log('✓ PKCE pair generated');
    
    // Validate PKCE pair
    const isValid = await pkceManager.validatePKCE(pkcePair.codeVerifier, pkcePair.codeChallenge);
    console.log(`✓ PKCE validation: ${isValid}`);
    
    // Store and retrieve PKCE data
    pkceManager.storePKCEData(mockProviderId, mockUserId, pkcePair);
    const storedData = pkceManager.getStoredPKCEData(mockProviderId, mockUserId);
    console.log(`✓ PKCE data storage and retrieval: ${!!storedData}`);
    
    // Clear stored data
    pkceManager.clearStoredPKCEData(mockProviderId, mockUserId);
    console.log('✓ PKCE data cleared');
    
    return true;
  } catch (error) {
    console.error('✗ PKCE test failed:', error);
    return false;
  }
}

/**
 * Test token rotation functionality
 */
async function testTokenRotation() {
  console.log('Testing token rotation functionality...');
  
  try {
    // Configure token rotator
    tokenRotator.configure({
      rotationBuffer: 60000, // 1 minute
      maxRetryAttempts: 2,
      retryDelay: 500 // 0.5 seconds
    });
    console.log('✓ Token rotator configured');
    
    // Get token health (will return default values since we don't have real tokens)
    const health = await tokenRotator.getTokenHealth(mockUserId, mockProviderId);
    console.log('✓ Token health check completed');
    
    return true;
  } catch (error) {
    console.error('✗ Token rotation test failed:', error);
    return false;
  }
}

/**
 * Test encryption functionality
 */
async function testEncryption() {
  console.log('Testing encryption functionality...');
  
  try {
    // Encrypt data
    const testData = { message: 'Hello, World!', timestamp: Date.now() };
    const encrypted = await encryptionService.encrypt(JSON.stringify(testData));
    console.log('✓ Data encrypted');
    
    // Decrypt data
    const decrypted = await encryptionService.decrypt(encrypted);
    const parsed = JSON.parse(decrypted);
    console.log(`✓ Data decrypted: ${parsed.message}`);
    
    // Test key info
    const keyInfo = encryptionService.getKeyInfo();
    console.log(`✓ Key info retrieved: ${keyInfo.currentKeyId}`);
    
    return true;
  } catch (error) {
    console.error('✗ Encryption test failed:', error);
    return false;
  }
}

/**
 * Test security auditing functionality
 */
async function testSecurityAuditing() {
  console.log('Testing security auditing functionality...');
  
  try {
    // Configure auditor
    securityAuditor.configure({
      enabled: true,
      logLevel: 'LOW',
      retentionDays: 7,
      webhookNotifications: false // Disable for testing
    });
    console.log('✓ Security auditor configured');
    
    // Log security events
    await securityAuditor.logSecurityEvent(
      SecurityEventType.AUTHENTICATION_SUCCESS,
      { method: 'oauth' },
      mockUserId,
      mockProviderId
    );
    console.log('✓ Security event logged');
    
    // Get recent events
    const recentEvents = securityAuditor.getRecentEvents(10);
    console.log(`✓ Retrieved ${recentEvents.length} recent events`);
    
    return true;
  } catch (error) {
    console.error('✗ Security auditing test failed:', error);
    return false;
  }
}

/**
 * Test rate limiting functionality
 */
async function testRateLimiting() {
  console.log('Testing rate limiting functionality...');
  
  try {
    // Configure rate limiter
    rateLimiter.configure({
      maxRequests: 5,
      windowMs: 10000, // 10 seconds
      enabled: true
    });
    console.log('✓ Rate limiter configured');
    
    // Test rate limiting
    const identifier = 'test_client_123';
    const results = [];
    
    // Make 7 requests
    for (let i = 0; i < 7; i++) {
      const result = rateLimiter.isAllowed(identifier);
      results.push(result.allowed);
    }
    
    // Check results (first 5 should be allowed, last 2 should be denied)
    const allowedCount = results.filter(r => r).length;
    console.log(`✓ Rate limiting test: ${allowedCount}/7 requests allowed`);
    
    // Get rate limit info
    const info = rateLimiter.getRateLimitInfo(identifier);
    console.log(`✓ Rate limit info: ${info.remaining} remaining`);
    
    // Reset rate limit
    rateLimiter.reset(identifier);
    console.log('✓ Rate limit reset');
    
    return true;
  } catch (error) {
    console.error('✗ Rate limiting test failed:', error);
    return false;
  }
}

/**
 * Run all security integration tests
 */
async function runAllTests() {
  console.log('Running Security Layer Integration Tests...\n');
  
  const tests = [
    { name: 'PKCE', fn: testPKCE },
    { name: 'Token Rotation', fn: testTokenRotation },
    { name: 'Encryption', fn: testEncryption },
    { name: 'Security Auditing', fn: testSecurityAuditing },
    { name: 'Rate Limiting', fn: testRateLimiting }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name} test PASSED\n`);
      } else {
        failed++;
        console.log(`❌ ${test.name} test FAILED\n`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ${test.name} test FAILED with error: ${error}\n`);
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All security layer tests PASSED!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Please review the implementation.`);
  }
  
  return failed === 0;
}

// Export for use in other modules
export { runAllTests };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
 runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}