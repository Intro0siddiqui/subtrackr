# Spotify OAuth Integration

This document provides an overview of the Spotify OAuth integration implementation and how to use it in the application.

## Overview

The Spotify OAuth integration allows users to connect their Spotify accounts to the application to retrieve subscription information and sync it with the internal subscription tracking system.

## Key Components

### 1. SpotifyProvider
The main implementation of the OAuth provider that handles the Spotify-specific OAuth flow, token management, and API interactions.

### 2. SpotifyApiClient
A client for interacting with the Spotify Web API with built-in rate limiting, error handling, and retry logic.

### 3. SpotifyDataMapper
Maps Spotify API responses to the internal subscription format used by the application.

### 4. SpotifyTypes
Type definitions and utility functions for working with Spotify API data.

## Implementation Details

### OAuth Flow
The integration implements the Authorization Code flow with PKCE support for secure token exchange.

### Scopes
The integration requests the following scopes:
- `user-read-private`: Access to user's subscription level
- `user-read-email`: Access to user's email address
- `user-read-playback-state`: Access to user's current playback state

### API Endpoints
- Authorization URL: `https://accounts.spotify.com/authorize`
- Token URL: `https://accounts.spotify.com/api/token`
- API Base URL: `https://api.spotify.com/v1`

### Data Mapping
The integration maps Spotify user profile data to internal subscription records:
- Spotify product tier → Subscription type and pricing
- User profile information → User metadata
- Subscription status → Active/Premium status

## Usage

### Initialization
The Spotify provider is automatically registered when the OAuth service initializes:

```typescript
import { oauthService } from '@/services/oauth';

// Initialize the OAuth service (this will register the Spotify provider)
await oauthService.initialize();
```

### Starting OAuth Flow
To initiate the Spotify OAuth flow:

```typescript
import { oauthService } from '@/services/oauth';

const authResult = await oauthService.initiateOAuthFlow(
  'spotify',
  userId,
  redirectUri,
  {
    usePKCE: true // Recommended for security
  }
);

// Redirect user to authResult.url
```

### Completing OAuth Flow
After the user authenticates with Spotify:

```typescript
import { oauthService } from '@/services/oauth';

const tokens = await oauthService.completeOAuthFlow(
  'spotify',
  userId,
  callbackUrl,
  expectedState,
  codeVerifier // If using PKCE
);
```

### Retrieving User Data
Once authenticated, you can retrieve user subscription data:

```typescript
import { oauthService } from '@/services/oauth';

// Get valid tokens for the user
const tokens = await oauthService.getValidTokens(userId, 'spotify');

// Get user profile
const provider = oauthService.getProvider('spotify');
const profile = await provider.getUserProfile(tokens.accessToken);

// Get subscriptions
const subscriptions = await provider.getSubscriptions(tokens.accessToken);
```

### Syncing Data
To sync Spotify subscription data with the internal system:

```typescript
import { oauthService } from '@/services/oauth';

const provider = oauthService.getProvider('spotify');
const syncResult = await (provider as SpotifyProvider).syncSubscriptionData(tokens.accessToken);
```

## Configuration

### Environment Variables
Set the following environment variables:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5173/oauth/callback/spotify
```

### Database Configuration
The Spotify provider is pre-configured in the database with:
- Provider ID: `spotify`
- Required scopes: `user-read-private`, `user-read-email`, `user-read-playback-state`
- Category: `Music`
- Features: Subscription sync enabled

## Error Handling

The integration includes comprehensive error handling for:
- Invalid credentials
- Rate limiting
- Network issues
- Expired tokens
- API errors

Errors are mapped to standardized OAuthError objects with user-friendly messages.

## Testing

Unit tests are provided for all components:
- SpotifyProvider.test.ts
- SpotifyApiClient.test.ts
- SpotifyDataMapper.test.ts
- SpotifyTypes.test.ts
- SpotifyIntegration.test.ts

Run tests with:
```bash
npm test
```

## Security Considerations

- Tokens are encrypted before storage
- PKCE is supported for secure token exchange
- Rate limiting prevents API abuse
- Proper error handling prevents information leakage
- Tokens are automatically refreshed when needed

## Limitations

- Spotify does not provide detailed billing history through their public API
- Token revocation is not supported by Spotify's public API
- Some user data may be limited based on privacy settings

## Future Enhancements

- Webhook support for real-time updates (if Spotify adds webhook support)
- Enhanced usage analytics from playback data
- Playlist and music library integration
- Cross-service subscription comparison