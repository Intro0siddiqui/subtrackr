/**
 * OAuth Provider Configurations
 *
 * This module contains configuration settings for all OAuth providers
 * including client IDs, secrets, redirect URIs, and other provider-specific settings.
 *
 * In production, these values should come from environment variables.
 */

import { NetflixConfig, SpotifyConfig, OpenAIConfig, AmazonConfig } from '../types/oauth';

/**
 * Netflix OAuth Configuration
 */
export const netflixConfig: NetflixConfig = {
  clientId: process.env.NETFLIX_CLIENT_ID || 'your-netflix-client-id',
  clientSecret: process.env.NETFLIX_CLIENT_SECRET || 'your-netflix-client-secret',
 redirectUri: process.env.NETFLIX_REDIRECT_URI || 'http://localhost:5173/oauth/callback/netflix',
  scopes: ['profile', 'subscription', 'billing']
};

/**
 * Spotify OAuth Configuration
 */
export const spotifyConfig: SpotifyConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID || 'your-spotify-client-id',
 clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'your-spotify-client-secret',
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5173/oauth/callback/spotify',
  scopes: ['user-read-private', 'user-read-email', 'user-read-playback-state']
};

/**
 * Amazon OAuth Configuration
 */
export const amazonConfig: AmazonConfig = {
  clientId: process.env.AMAZON_CLIENT_ID || 'your-amazon-client-id',
  clientSecret: process.env.AMAZON_CLIENT_SECRET || 'your-amazon-client-secret',
  redirectUri: process.env.AMAZON_REDIRECT_URI || 'http://localhost:5173/oauth/callback/amazon',
  scopes: ['profile', 'payments:widget', 'payments:summary']
};

/**
 * OpenAI API Key Configuration
 */
export const openaiConfig: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  organization: process.env.OPENAI_ORGANIZATION || undefined
};

/**
 * Provider Configuration Registry
 *
 * Maps provider IDs to their configuration objects
 */
export const providerConfigs = {
  netflix: netflixConfig,
  spotify: spotifyConfig,
  openai: openaiConfig,
  amazon: amazonConfig
} as const;

/**
 * Get configuration for a specific provider
 */
export function getProviderConfig(providerId: string): NetflixConfig | SpotifyConfig | OpenAIConfig | AmazonConfig | null {
  switch (providerId) {
    case 'netflix':
      return netflixConfig;
    case 'spotify':
      return spotifyConfig;
    case 'openai':
      return openaiConfig;
    case 'amazon':
      return amazonConfig;
    default:
      return null;
  }
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(providerId: string): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const config = getProviderConfig(providerId);
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    missingFields.push('configuration');
    return { isValid: false, missingFields, warnings };
  }

  // Check for Netflix-specific required fields
 if (providerId === 'netflix') {
    const netflixConfig = config as NetflixConfig;

    if (!netflixConfig.clientId || netflixConfig.clientId === 'your-netflix-client-id') {
      missingFields.push('clientId');
    }

    if (!netflixConfig.clientSecret || netflixConfig.clientSecret === 'your-netflix-client-secret') {
      missingFields.push('clientSecret');
    }

    if (!netflixConfig.redirectUri || netflixConfig.redirectUri.includes('localhost')) {
      warnings.push('Using localhost redirect URI - ensure this is correct for your environment');
    }

    // Validate scopes
    const requiredScopes = ['profile', 'subscription', 'billing'];
    const missingScopes = requiredScopes.filter(scope => !netflixConfig.scopes.includes(scope));

    if (missingScopes.length > 0) {
      warnings.push(`Missing recommended scopes: ${missingScopes.join(', ')}`);
    }
  }

  // Check for Spotify-specific required fields
 if (providerId === 'spotify') {
    const spotifyConfig = config as SpotifyConfig;

    if (!spotifyConfig.clientId || spotifyConfig.clientId === 'your-spotify-client-id') {
      missingFields.push('clientId');
    }

    if (!spotifyConfig.clientSecret || spotifyConfig.clientSecret === 'your-spotify-client-secret') {
      missingFields.push('clientSecret');
    }

    if (!spotifyConfig.redirectUri || spotifyConfig.redirectUri.includes('localhost')) {
      warnings.push('Using localhost redirect URI - ensure this is correct for your environment');
    }

    // Validate scopes
    const requiredScopes = ['user-read-private', 'user-read-email', 'user-read-playback-state'];
    const missingScopes = requiredScopes.filter(scope => !spotifyConfig.scopes.includes(scope));

    if (missingScopes.length > 0) {
      warnings.push(`Missing recommended scopes: ${missingScopes.join(', ')}`);
    }
  }

  // Check for OpenAI-specific required fields
  if (providerId === 'openai') {
    const openaiConfig = config as OpenAIConfig;

    if (!openaiConfig.apiKey || openaiConfig.apiKey === 'your-openai-api-key') {
      missingFields.push('apiKey');
    }

    // Validate API key format
    if (openaiConfig.apiKey && !/^sk-(?:[a-zA-Z0-9]{20,}|[a-zA-Z0-9]{48})$/.test(openaiConfig.apiKey.trim())) {
      warnings.push('API key format appears invalid');
    }
  }

  // Check for Amazon-specific required fields
  if (providerId === 'amazon') {
    const amazonConfig = config as AmazonConfig;

    if (!amazonConfig.clientId || amazonConfig.clientId === 'your-amazon-client-id') {
      missingFields.push('clientId');
    }

    if (!amazonConfig.clientSecret || amazonConfig.clientSecret === 'your-amazon-client-secret') {
      missingFields.push('clientSecret');
    }

    if (!amazonConfig.redirectUri || amazonConfig.redirectUri.includes('localhost')) {
      warnings.push('Using localhost redirect URI - ensure this is correct for your environment');
    }

    // Validate scopes
    const requiredScopes = ['profile', 'payments:widget', 'payments:summary'];
    const missingScopes = requiredScopes.filter(scope => !amazonConfig.scopes.includes(scope));

    if (missingScopes.length > 0) {
      warnings.push(`Missing recommended scopes: ${missingScopes.join(', ')}`);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings
  };
}

/**
 * Get all provider configurations
 */
export function getAllProviderConfigs(): Record<string, NetflixConfig | SpotifyConfig | OpenAIConfig | AmazonConfig> {
  return {
    netflix: netflixConfig,
    spotify: spotifyConfig,
    openai: openaiConfig,
    amazon: amazonConfig
  };
}

/**
 * Environment variable validation
 */
export function validateEnvironmentVariables(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check for Netflix environment variables
  if (!process.env.NETFLIX_CLIENT_ID) {
    missing.push('NETFLIX_CLIENT_ID');
  }

  if (!process.env.NETFLIX_CLIENT_SECRET) {
    missing.push('NETFLIX_CLIENT_SECRET');
  }

  if (!process.env.NETFLIX_REDIRECT_URI) {
    warnings.push('NETFLIX_REDIRECT_URI not set, using default localhost URI');
  }

  // Check for Spotify environment variables
  if (!process.env.SPOTIFY_CLIENT_ID) {
    missing.push('SPOTIFY_CLIENT_ID');
  }

  if (!process.env.SPOTIFY_CLIENT_SECRET) {
    missing.push('SPOTIFY_CLIENT_SECRET');
  }

  if (!process.env.SPOTIFY_REDIRECT_URI) {
    warnings.push('SPOTIFY_REDIRECT_URI not set, using default localhost URI');
  }

  // Check for OpenAI environment variables
  if (!process.env.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY');
  }

  // Check for Amazon environment variables
  if (!process.env.AMAZON_CLIENT_ID) {
    missing.push('AMAZON_CLIENT_ID');
  }

  if (!process.env.AMAZON_CLIENT_SECRET) {
    missing.push('AMAZON_CLIENT_SECRET');
  }

  if (!process.env.AMAZON_REDIRECT_URI) {
    warnings.push('AMAZON_REDIRECT_URI not set, using default localhost URI');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Provider configuration metadata
 */
export const providerMetadata = {
  netflix: {
    name: 'Netflix',
    description: 'Netflix streaming service OAuth integration',
    category: 'streaming',
    features: {
      subscriptionSync: true,
      webhookSupport: false,
      realTimeUpdates: false
    },
    requiredScopes: ['profile', 'subscription', 'billing'],
    optionalScopes: [],
    documentationUrl: 'https://developer.netflix.com/docs',
    supportUrl: 'https://help.netflix.com/en/contactus'
  },
  spotify: {
    name: 'Spotify',
    description: 'Spotify music streaming service OAuth integration',
    category: 'music',
    features: {
      subscriptionSync: true,
      webhookSupport: false,
      realTimeUpdates: false
    },
    requiredScopes: ['user-read-private', 'user-read-email', 'user-read-playback-state'],
    optionalScopes: [],
    documentationUrl: 'https://developer.spotify.com/documentation',
    supportUrl: 'https://support.spotify.com/'
  },
  openai: {
    name: 'OpenAI',
    description: 'OpenAI API key integration for subscription data',
    category: 'ai',
    features: {
      subscriptionSync: true,
      webhookSupport: false,
      realTimeUpdates: false
    },
    requiredScopes: ['read:user', 'read:subscription'],
    optionalScopes: [],
    documentationUrl: 'https://platform.openai.com/docs',
    supportUrl: 'https://help.openai.com/'
  },
  amazon: {
    name: 'Amazon Prime',
    description: 'Amazon Prime subscription OAuth integration',
    category: 'streaming',
    features: {
      subscriptionSync: true,
      webhookSupport: false,
      realTimeUpdates: false
    },
    requiredScopes: ['profile', 'payments:widget', 'payments:summary'],
    optionalScopes: [],
    documentationUrl: 'https://developer.amazon.com/apps-and-games/login-with-amazon/docs',
    supportUrl: 'https://www.amazon.com/help'
  }
} as const;

/**
 * Get provider metadata
 */
export function getProviderMetadata(providerId: string): typeof providerMetadata.netflix | typeof providerMetadata.spotify | typeof providerMetadata.openai | typeof providerMetadata.amazon | null {
  return providerMetadata[providerId as keyof typeof providerMetadata] || null;
}