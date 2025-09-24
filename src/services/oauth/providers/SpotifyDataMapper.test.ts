import { SpotifyDataMapper } from './SpotifyDataMapper';

describe('SpotifyDataMapper', () => {
  test('should create subscription from profile', () => {
    const profile = {
      id: 'test-user-id',
      email: 'test@example.com',
      display_name: 'Test User',
      country: 'US',
      product: 'premium',
      images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
      followers: { total: 100 },
      external_urls: { spotify: 'https://open.spotify.com/user/test-user' }
    };

    const subscription = SpotifyDataMapper.createSubscriptionFromProfile(profile);
    
    expect(subscription).toHaveProperty('id', 'spotify_test-user-id');
    expect(subscription).toHaveProperty('name', 'Spotify');
    expect(subscription).toHaveProperty('category', 'Music Streaming');
    expect(subscription).toHaveProperty('amount', 9.99);
    expect(subscription).toHaveProperty('currency', 'USD');
    expect(subscription).toHaveProperty('billingCycle', 'monthly');
    expect(subscription).toHaveProperty('status', 'active');
    expect(subscription).toHaveProperty('description', 'Premium Plan');
    expect(subscription).toHaveProperty('autoRenew', true);
    expect(subscription).toHaveProperty('logoUrl');
    expect(subscription).toHaveProperty('externalId', 'test-user-id');
    expect(subscription).toHaveProperty('providerId', 'spotify');
  });

  test('should handle free tier subscription', () => {
    const profile = {
      id: 'test-user-id',
      email: 'test@example.com',
      display_name: 'Test User',
      country: 'US',
      product: 'free',
      images: [],
      followers: { total: 0 },
      external_urls: { spotify: 'https://open.spotify.com/user/test-user' }
    };

    const subscription = SpotifyDataMapper.createSubscriptionFromProfile(profile);
    
    expect(subscription).toHaveProperty('amount', 0);
    expect(subscription).toHaveProperty('billingCycle', 'none');
    expect(subscription).toHaveProperty('description', 'Free Plan');
    expect(subscription).toHaveProperty('autoRenew', false);
  });

  test('should get tier info', () => {
    const premiumInfo = SpotifyDataMapper.getTierInfo('premium');
    expect(premiumInfo).toHaveProperty('name', 'Premium');
    expect(premiumInfo).toHaveProperty('amount', 9.99);
    expect(premiumInfo).toHaveProperty('currency', 'USD');
    expect(premiumInfo).toHaveProperty('features');

    const freeInfo = SpotifyDataMapper.getTierInfo('free');
    expect(freeInfo).toHaveProperty('name', 'Free');
    expect(freeInfo).toHaveProperty('amount', 0);
  });

  test('should normalize product type', () => {
    expect(SpotifyDataMapper.normalizeProductType('PREMIUM')).toBe('premium');
    expect(SpotifyDataMapper.normalizeProductType('Premium_Family')).toBe('premium_family');
    expect(SpotifyDataMapper.normalizeProductType('unknown')).toBe('free');
  });
});