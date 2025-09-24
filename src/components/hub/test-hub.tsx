import React, { useState } from 'react';
import ServiceConnectionHub from './ServiceConnectionHub';
import type { OAuthConnection } from '../../types/oauth';
import { OAuthConnectionStatus } from '../../types/oauth';

const TestHub: React.FC = () => {
  const [connections, setConnections] = useState<OAuthConnection[]>([
    {
      id: '1',
      userId: 'user1',
      providerId: 'netflix',
      status: OAuthConnectionStatus.ACTIVE,
      accessToken: 'token1',
      tokenType: 'Bearer',
      scope: 'profile subscription billing',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      userId: 'user1',
      providerId: 'spotify',
      status: OAuthConnectionStatus.ACTIVE,
      accessToken: 'token2',
      refreshToken: 'refresh2',
      expiresAt: new Date(Date.now() + 3600000),
      tokenType: 'Bearer',
      scope: 'user-read-private user-read-email',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  const handleServiceConnect = async (providerId: string) => {
    console.log(`Connecting to ${providerId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add new connection
    const newConnection: OAuthConnection = {
      id: `${connections.length + 1}`,
      userId: 'user1',
      providerId,
      status: OAuthConnectionStatus.ACTIVE,
      accessToken: `token${connections.length + 1}`,
      tokenType: 'Bearer',
      scope: 'profile',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setConnections(prev => [...prev, newConnection]);
  };

  const handleServiceDisconnect = async (providerId: string) => {
    console.log(`Disconnecting from ${providerId}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Remove connection
    setConnections(prev => prev.filter(conn => conn.providerId !== providerId));
  };

  return (
    <div className="p-6">
      <ServiceConnectionHub
        onServiceConnect={handleServiceConnect}
        onServiceDisconnect={handleServiceDisconnect}
        connectedServices={connections}
      />
    </div>
  );
};

export default TestHub;