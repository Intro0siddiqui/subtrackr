import { SpotifyApiClient } from './SpotifyApiClient';

describe('SpotifyApiClient', () => {
  let apiClient: SpotifyApiClient;
  const mockConfig = {
    baseUrl: 'https://api.spotify.com',
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000
  };

  beforeEach(() => {
    apiClient = new SpotifyApiClient(mockConfig);
  });

  test('should create API client instance', () => {
    expect(apiClient).toBeInstanceOf(SpotifyApiClient);
  });

  test('should get configuration', () => {
    const config = apiClient.getConfig();
    expect(config).toEqual(mockConfig);
  });

  test('should get rate limit status', () => {
    const status = apiClient.getRateLimitStatus();
    expect(status).toHaveProperty('requestCount');
    expect(status).toHaveProperty('rateLimitResetTime');
    expect(status).toHaveProperty('isRateLimited');
  });

  test('should get client status', () => {
    const status = apiClient.getStatus();
    expect(status).toHaveProperty('config');
    expect(status).toHaveProperty('rateLimitStatus');
    expect(status).toHaveProperty('isHealthy');
  });
});