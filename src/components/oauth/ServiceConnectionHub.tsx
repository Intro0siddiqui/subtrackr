import React, { useState, useEffect } from 'react';
import ServiceCard from './ServiceCard';
import OAuthModal from './OAuthModal';
import type { OAuthProvider } from '../../services/oauth/OAuthProvider';
import type { OAuthConnection } from '../../types/oauth';

interface ServiceConnectionHubProps {
  onServiceConnect: (provider: string, userId: string) => Promise<void>;
  onServiceDisconnect: (provider: string, userId: string) => Promise<void>;
  connectedServices: OAuthConnection[];
  userId: string;
  className?: string;
}

interface ServiceProvider {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  color: string;
  category: 'streaming' | 'music' | 'ai' | 'shopping';
}

const AVAILABLE_SERVICES: ServiceProvider[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    description: 'Connect your Netflix account to automatically track subscriptions and billing',
    logoUrl: 'https://logo.clearbit.com/netflix.com',
    color: '#E50914',
    category: 'streaming'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Sync your Spotify Premium subscription and music preferences',
    logoUrl: 'https://logo.clearbit.com/spotify.com',
    color: '#1DB954',
    category: 'music'
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    description: 'Connect your OpenAI account to track ChatGPT Plus subscriptions',
    logoUrl: 'https://logo.clearbit.com/openai.com',
    color: '#10A37F',
    category: 'ai'
  },
  {
    id: 'amazon',
    name: 'Amazon Prime',
    description: 'Link your Amazon Prime account for subscription and delivery tracking',
    logoUrl: 'https://logo.clearbit.com/amazon.com',
    color: '#FF9900',
    category: 'shopping'
  }
];

const ServiceConnectionHub: React.FC<ServiceConnectionHubProps> = ({
  onServiceConnect,
  onServiceDisconnect,
  connectedServices,
  userId,
  className = ''
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});

  const isServiceConnected = (providerId: string): boolean => {
    return connectedServices.some(conn => conn.providerId === providerId);
  };

  const getConnection = (providerId: string): OAuthConnection | undefined => {
    return connectedServices.find(conn => conn.providerId === providerId);
  };

  const handleConnect = async (providerId: string) => {
    setIsConnecting(providerId);
    setConnectionErrors(prev => ({ ...prev, [providerId]: '' }));

    try {
      await onServiceConnect(providerId, userId);
      setSelectedProvider(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionErrors(prev => ({ ...prev, [providerId]: errorMessage }));
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await onServiceDisconnect(providerId, userId);
    } catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error);
    }
  };

  const handleRetryConnection = (providerId: string) => {
    handleConnect(providerId);
  };

  const getServicesByCategory = () => {
    const categories: Record<string, ServiceProvider[]> = {};
    AVAILABLE_SERVICES.forEach(service => {
      if (!categories[service.category]) {
        categories[service.category] = [];
      }
      categories[service.category].push(service);
    });
    return categories;
  };

  const categoryLabels = {
    streaming: '🎬 Streaming Services',
    music: '🎵 Music & Audio',
    ai: '🤖 AI & Productivity',
    shopping: '🛒 Shopping & Retail'
  };

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Connect Your Services
        </h2>
        <p className="text-muted-light dark:text-muted-dark">
          Automatically sync your subscriptions and never miss a payment
        </p>
      </div>

      {Object.entries(getServicesByCategory()).map(([category, services]) => (
        <div key={category} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {categoryLabels[category as keyof typeof categoryLabels]}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(service => {
              const isConnected = isServiceConnected(service.id);
              const connection = getConnection(service.id);
              const hasError = !!connectionErrors[service.id];

              return (
                <ServiceCard
                  key={service.id}
                  provider={service.id}
                  name={service.name}
                  description={service.description}
                  logoUrl={service.logoUrl}
                  color={service.color}
                  isConnected={isConnected}
                  isConnecting={isConnecting === service.id}
                  hasError={hasError}
                  errorMessage={connectionErrors[service.id]}
                  lastSync={connection?.updatedAt}
                  onConnect={() => handleConnect(service.id)}
                  onDisconnect={() => handleDisconnect(service.id)}
                  onRetry={() => handleRetryConnection(service.id)}
                />
              );
            })}
          </div>
        </div>
      ))}

      <OAuthModal
        isOpen={!!selectedProvider}
        provider={selectedProvider || ''}
        onClose={() => setSelectedProvider(null)}
        onSuccess={(provider: string) => {
          handleConnect(provider);
        }}
        onError={(provider: string, error: string) => {
          setConnectionErrors(prev => ({ ...prev, [provider]: error }));
          setSelectedProvider(null);
        }}
      />
    </div>
  );
};

export default ServiceConnectionHub;