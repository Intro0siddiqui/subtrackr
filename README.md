# Subtrackr - Subscription Tracker

Subtrackr is a comprehensive subscription tracking application that helps users manage and monitor their recurring subscriptions across multiple services.

## Features

- Track subscriptions from various services
- Monitor billing cycles and payment dates
- Receive notifications before payments are due
- Analyze spending patterns across services
- OAuth integration with popular services

## Spotify OAuth Integration

This application includes a complete Spotify OAuth integration that allows users to:

- Connect their Spotify accounts securely
- Automatically sync subscription information
- View Spotify subscription details alongside other services

### Implementation Details

The Spotify integration is implemented with:

1. **Secure OAuth Flow**: Implements the Authorization Code flow with PKCE for enhanced security
2. **Token Management**: Secure storage and automatic refresh of access tokens
3. **API Client**: Robust client for interacting with Spotify's Web API with rate limiting and error handling
4. **Data Mapping**: Converts Spotify API responses to the application's internal subscription format
5. **Comprehensive Testing**: Full test coverage for all components

### Key Components

- `SpotifyProvider`: Main OAuth provider implementation
- `SpotifyApiClient`: Client for Spotify Web API interactions
- `SpotifyDataMapper`: Maps Spotify data to internal format
- `SpotifyTypes`: Type definitions and utilities

### Configuration

To enable Spotify integration, set the following environment variables:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5173/oauth/callback/spotify
```

### Required Scopes

The integration requests the following Spotify scopes:
- `user-read-private`: Access to user's subscription level
- `user-read-email`: Access to user's email address
- `user-read-playback-state`: Access to user's current playback state

### Testing

Run tests with:
```bash
npm test
```

## Development

### Prerequisites

- Node.js 16+
- npm or yarn
- Supabase account for backend services

### Installation

```bash
npm install
```

### Running the Application

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

## Database

The application uses Supabase for data storage with a schema that includes:
- OAuth connections
- Service provider configurations
- Subscription data
- Sync logs
- Webhook events

Database migrations are located in the `database/migrations` directory.

## Security

- All OAuth tokens are encrypted before storage
- PKCE is used for secure token exchange
- Rate limiting prevents API abuse
- Proper error handling prevents information leakage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

MIT License - see LICENSE file for details.