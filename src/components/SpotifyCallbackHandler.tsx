// SpotifyCallbackHandler.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { oauthService } from '@/services/oauth';

interface SpotifyCallbackProps {
  userId: string;
}

const SpotifyCallbackHandler: React.FC<SpotifyCallbackProps> = ({ userId }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        // Check for OAuth errors
        if (error) {
          throw new Error(`Spotify OAuth error: ${error}`);
        }

        // Validate state parameter
        const expectedState = localStorage.getItem('spotify_oauth_state');
        if (!state || state !== expectedState) {
          throw new Error('Invalid state parameter');
        }

        // Get code verifier for PKCE
        const codeVerifier = localStorage.getItem('spotify_code_verifier');

        // Clean up localStorage
        localStorage.removeItem('spotify_oauth_state');
        localStorage.removeItem('spotify_code_verifier');

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Complete OAuth flow
        const redirectUri = `${window.location.origin}/oauth/callback/spotify`;
        const tokens = await oauthService.completeOAuthFlow(
          'spotify',
          userId,
          window.location.href,
          expectedState,
          codeVerifier || undefined
        );

        // Store connection
        await oauthService.createConnection(userId, 'spotify', tokens);

        setStatus('success');
        setMessage('Successfully connected to Spotify!');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } catch (error) {
        console.error('Spotify OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to complete Spotify connection');
      }
    };

    handleCallback();
  }, [userId, navigate]);

  return (
    <div className="spotify-callback">
      <div className="callback-content">
        {status === 'loading' && (
          <div className="loading-state">
            <h2>Completing Spotify Connection</h2>
            <p>Processing your authorization...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="success-state">
            <h2>✅ Success!</h2>
            <p>{message}</p>
            <p>Redirecting to your dashboard...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="error-state">
            <h2>❌ Connection Failed</h2>
            <p>{message}</p>
            <button 
              onClick={() => navigate('/settings')}
              className="retry-button"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyCallbackHandler;