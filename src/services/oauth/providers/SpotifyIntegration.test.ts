import { SpotifyProvider } from './SpotifyProvider';
import { SpotifyApiClient } from './SpotifyApiClient';
import { SpotifyDataMapper } from './SpotifyDataMapper';

// This is an integration test that verifies the end-to-end Spotify integration
describe('Spotify Integration', () => {
  let provider: SpotifyProvider;
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';
  const mockRedirectUri = 'http://localhost:3000/callback';

  beforeEach(() => {
    provider = new SpotifyProvider(mockClientId, mockClientSecret, mockRedirectUri);
  });

  test('should have all required components', () => {
    // Verify provider
    expect(provider).toBeInstanceOf(SpotifyProvider);
    expect(provider.getId()).toBe('spotify');
    expect(provider.getDisplayName()).toBe('Spotify');
    
    // Verify API client
    const apiClient = provider.getApiClient();
    expect(apiClient).toBeInstanceOf(SpotifyApiClient);
    
    // Verify data mapper
    const dataMapper = provider.getDataMapper();
    expect(dataMapper).toBe(SpotifyDataMapper);
    
    // Verify configuration
    const config = provider.getProvider();
    expect(config.authUrl).toBe('https://accounts.spotify.com/authorize');
    expect(config.tokenUrl).toBe('https://accounts.spotify.com/api/token');
    expect(config.apiBaseUrl).toBe('https://api.spotify.com');
    expect(config.scopes).toEqual(['user-read-private', 'user-read-email', 'user-read-playback-state']);
    expect(config.features.subscriptionSync).toBe(true);
    expect(config.category).toBe('music');
  });

  test('should support required OAuth flows', () => {
    const flows = provider.getSupportedFlows();
    expect(flows).toContain('authorization_code');
  });

  test('should have correct configuration', () => {
    const providerConfig = provider.getProvider();
    expect(providerConfig.id).toBe('spotify');
    expect(providerConfig.name).toBe('spotify');
    expect(providerConfig.displayName).toBe('Spotify');
    expect(providerConfig.type).toBe('oauth2');
    expect(providerConfig.category).toBe('music');
    expect(providerConfig.isActive).toBe(true);
  });
});