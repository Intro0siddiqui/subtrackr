// SpotifyConnectionExample.tsx
import React, { useState } from 'react';
import { oauthService } from '@/services/oauth';

interface SpotifyConnectionProps {
  userId: string;
}

const SpotifyConnectionExample: React.FC<SpotifyConnectionProps> = ({ userId }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConnectSpotify = async () => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
      // Check if already connected
      const hasConnection = await oauthService.hasActiveConnection(userId, 'spotify');
      
      if (hasConnection) {
        setConnectionStatus('connected');
        setIsConnecting(false);
        return;
      }

      // Initiate OAuth flow
      const redirectUri = `${window.location.origin}/oauth/callback/spotify`;
      const authResult = await oauthService.initiateOAuthFlow(
        'spotify',
        userId,
        redirectUri,
        {
          usePKCE: true
        }
      );

      // Store state for validation in callback
      localStorage.setItem('spotify_oauth_state', authResult.state);
      if (authResult.codeVerifier) {
        localStorage.setItem('spotify_code_verifier', authResult.codeVerifier);
      }

      // Redirect to Spotify authorization page
      window.location.href = authResult.url;
    } catch (error) {
      console.error('Failed to initiate Spotify OAuth flow:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to Spotify');
      setConnectionStatus('error');
      setIsConnecting(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    try {
      await oauthService.revokeConnection(userId, 'spotify');
      setConnectionStatus('idle');
    } catch (error) {
      console.error('Failed to disconnect Spotify:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to disconnect from Spotify');
      setConnectionStatus('error');
    }
  };

  return (
    <div className="spotify-connection">
      <h3>Spotify Connection</h3>
      
      {connectionStatus === 'idle' && (
        <button 
          onClick={handleConnectSpotify}
          disabled={isConnecting}
          className="connect-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect Spotify'}
        </button>
      )}
      
      {connectionStatus === 'connecting' && (
        <div className="connecting-status">
          <p>Redirecting to Spotify for authorization...</p>
        </div>
      )}
      
      {connectionStatus === 'connected' && (
        <div className="connected-status">
          <p>✅ Connected to Spotify</p>
          <button 
            onClick={handleDisconnectSpotify}
            className="disconnect-button"
          >
            Disconnect
          </button>
        </div>
      )}
      
      {connectionStatus === 'error' && (
        <div className="error-status">
          <p>❌ Error: {errorMessage}</p>
          <button 
            onClick={handleConnectSpotify}
            disabled={isConnecting}
            className="retry-button"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default SpotifyConnectionExample;