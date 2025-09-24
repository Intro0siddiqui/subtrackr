import { SpotifyProvider } from './SpotifyProvider';
import { SpotifyApiClient } from './SpotifyApiClient';
import { SpotifyDataMapper } from './SpotifyDataMapper';

// Mock the fetch function
global.fetch = jest.fn();

describe('SpotifyProvider', () => {
  let provider: SpotifyProvider;
  const mockClientId = 'test-client-id';
  const mockClientSecret = 'test-client-secret';
  const mockRedirectUri = 'http://localhost:3000/callback';

  beforeEach(() => {
    provider = new SpotifyProvider(mockClientId, mockClientSecret, mockRedirectUri);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should create provider instance', () => {
    expect(provider).toBeInstanceOf(SpotifyProvider);
    expect(provider.getId()).toBe('spotify');
  });

  test('should generate authorization URL', () => {
    const state = 'test-state';
    const url = provider.getAuthorizationUrl(state);
    
    expect(url).toContain('https://accounts.spotify.com/authorize');
    expect(url).toContain(`client_id=${mockClientId}`);
    expect(url).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
    expect(url).toContain(`state=${state}`);
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=user-read-private+user-read-email+user-read-playback-state');
  });

  test('should have correct scopes', () => {
    const scopes = provider.getScopes();
    expect(scopes).toEqual(['user-read-private', 'user-read-email', 'user-read-playback-state']);
  });

  test('should support subscription sync', () => {
    expect(provider.supportsSubscriptionSync()).toBe(true);
  });

  test('should have API client', () => {
    const apiClient = provider.getApiClient();
    expect(apiClient).toBeInstanceOf(SpotifyApiClient);
  });

  test('should have data mapper', () => {
    const dataMapper = provider.getDataMapper();
    expect(dataMapper).toBe(SpotifyDataMapper);
  });
});