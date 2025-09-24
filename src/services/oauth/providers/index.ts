/**
 * OAuth Providers - Export all provider implementations
 *
 * This module exports all OAuth provider implementations for easy importing
 * and registration with the OAuth service layer.
 */

import { NetflixProvider } from './NetflixProvider';
import { SpotifyProvider } from './SpotifyProvider';
import { AmazonProvider } from './AmazonProvider';

// Netflix Provider
export { NetflixProvider } from './NetflixProvider';

// Spotify Provider
export { SpotifyProvider } from './SpotifyProvider';

// Amazon Provider
export { AmazonProvider } from './AmazonProvider';

// Provider factory function for Netflix
export function createNetflixProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): NetflixProvider {
  return new NetflixProvider(clientId, clientSecret, redirectUri);
}

// Provider factory function for Spotify
export function createSpotifyProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): SpotifyProvider {
  return new SpotifyProvider(clientId, clientSecret, redirectUri);
}

// Provider factory function for Amazon
export function createAmazonProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): AmazonProvider {
  return new AmazonProvider(clientId, clientSecret, redirectUri);
}

// Re-export types for convenience
export type { NetflixConfig, SpotifyConfig, AmazonConfig } from '../../../types/oauth';