import { SpotifyUtils, SpotifyErrorCode, SpotifyApiError } from './SpotifyTypes';

describe('SpotifyTypes', () => {
  test('should validate subscription data', () => {
    const validData = {
      id: 'test-id',
      plan_id: 'premium',
      plan_name: 'Premium',
      status: 'active',
      amount: 9.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      start_date: new Date().toISOString()
    };

    const result = SpotifyUtils.validateSubscriptionData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should detect invalid subscription data', () => {
    const invalidData = {
      plan_name: 'Premium', // Missing id
      status: 'active',
      amount: -5, // Invalid amount
      currency: 'USD',
      billing_cycle: 'monthly'
      // Missing start_date
    };

    const result = SpotifyUtils.validateSubscriptionData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Subscription ID is required');
    expect(result.errors).toContain('Valid amount is required');
    expect(result.errors).toContain('Start date is required');
  });

  test('should validate billing data', () => {
    const validData = {
      id: 'bill-123',
      subscription_id: 'sub-123',
      amount: 9.99,
      currency: 'USD',
      date: new Date().toISOString(),
      description: 'Monthly subscription'
    };

    const result = SpotifyUtils.validateBillingData(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should normalize billing cycle', () => {
    expect(SpotifyUtils.normalizeBillingCycle('monthly')).toBe('monthly');
    expect(SpotifyUtils.normalizeBillingCycle('MONTH')).toBe('monthly');
    expect(SpotifyUtils.normalizeBillingCycle('yearly')).toBe('yearly');
    expect(SpotifyUtils.normalizeBillingCycle('annual')).toBe('yearly');
    expect(SpotifyUtils.normalizeBillingCycle('none')).toBe('none');
    expect(SpotifyUtils.normalizeBillingCycle('unknown')).toBe('monthly'); // default
  });

  test('should map payment method', () => {
    expect(SpotifyUtils.mapPaymentMethod('credit_card')).toBe('Credit Card');
    expect(SpotifyUtils.mapPaymentMethod('paypal')).toBe('PayPal');
    expect(SpotifyUtils.mapPaymentMethod('unknown_method')).toBe('Credit Card'); // default
  });

  test('should map status', () => {
    expect(SpotifyUtils.mapStatus('active')).toBe('active');
    expect(SpotifyUtils.mapStatus('free_trial')).toBe('active'); // mapped to active
    expect(SpotifyUtils.mapStatus('unknown')).toBe('unknown');
  });

  test('should map tier', () => {
    expect(SpotifyUtils.mapTier('premium')).toBe('Premium');
    expect(SpotifyUtils.mapTier('premium_family')).toBe('Premium Family');
    expect(SpotifyUtils.mapTier('unknown')).toBe('unknown');
  });

  test('should check if user has premium', () => {
    expect(SpotifyUtils.isPremium('premium')).toBe(true);
    expect(SpotifyUtils.isPremium('premium_family')).toBe(true);
    expect(SpotifyUtils.isPremium('free')).toBe(false);
  });

  test('should get tier amount', () => {
    expect(SpotifyUtils.getTierAmount('premium')).toBe(9.99);
    expect(SpotifyUtils.getTierAmount('premium_family')).toBe(14.99);
    expect(SpotifyUtils.getTierAmount('free')).toBe(0);
    expect(SpotifyUtils.getTierAmount('unknown')).toBe(0);
  });

  test('should create Spotify API error', () => {
    const error = new SpotifyApiError(
      SpotifyErrorCode.INVALID_CLIENT,
      'Invalid client credentials',
      '401',
      { details: 'Client authentication failed' }
    );

    expect(error).toBeInstanceOf(SpotifyApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(SpotifyErrorCode.INVALID_CLIENT);
    expect(error.statusCode).toBe('401');
    expect(error.message).toBe('Invalid client credentials');
    expect(error.details).toHaveProperty('details', 'Client authentication failed');
  });

  test('should check if error is retryable', () => {
    const retryableError = new SpotifyApiError(
      SpotifyErrorCode.SERVER_ERROR,
      'Server error',
      '500'
    );

    const nonRetryableError = new SpotifyApiError(
      SpotifyErrorCode.INVALID_CLIENT,
      'Invalid client',
      '401'
    );

    expect(retryableError.isRetryable()).toBe(true);
    expect(nonRetryableError.isRetryable()).toBe(false);
  });

  test('should check if error is rate limit error', () => {
    const rateLimitError = new SpotifyApiError(
      SpotifyErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      '429'
    );

    const otherError = new SpotifyApiError(
      SpotifyErrorCode.INVALID_CLIENT,
      'Invalid client',
      '401'
    );

    expect(rateLimitError.isRateLimitError()).toBe(true);
    expect(otherError.isRateLimitError()).toBe(false);
  });

  test('should get user-friendly error message', () => {
    const rateLimitError = new SpotifyApiError(
      SpotifyErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      '429'
    );

    const invalidClientError = new SpotifyApiError(
      SpotifyErrorCode.INVALID_CLIENT,
      'Invalid client',
      '401'
    );

    expect(rateLimitError.getUserMessage()).toBe('Spotify API rate limit exceeded. Please try again later.');
    expect(invalidClientError.getUserMessage()).toBe('Invalid Spotify API credentials.');
  });
});