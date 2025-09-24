import React, { useState } from 'react';
import Modal from '../Modal';
import ConnectionStatus from './ConnectionStatus';

interface ServiceSettingsProps {
  isOpen: boolean;
  provider: string;
  onClose: () => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onToggleAutoSync: (enabled: boolean) => void;
}

interface ServiceConfig {
  name: string;
  color: string;
  logoUrl: string;
  description: string;
  features: string[];
  syncFrequency: 'hourly' | 'daily' | 'weekly';
  autoSyncEnabled: boolean;
  lastSync?: Date;
  nextSync?: Date;
  dataUsage: {
    subscriptions: number;
    billingRecords: number;
    totalSize: string;
  };
}

const MOCK_SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  netflix: {
    name: 'Netflix',
    color: '#E50914',
    logoUrl: 'https://logo.clearbit.com/netflix.com',
    description: 'Premium subscription with 4K streaming and 4 screens',
    features: ['4K Ultra HD', '4 Screens', 'Unlimited Movies & TV Shows', 'Download & Watch Offline'],
    syncFrequency: 'daily',
    autoSyncEnabled: true,
    lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    nextSync: new Date(Date.now() + 22 * 60 * 60 * 1000), // 22 hours from now
    dataUsage: {
      subscriptions: 1,
      billingRecords: 12,
      totalSize: '2.4 MB'
    }
  },
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    logoUrl: 'https://logo.clearbit.com/spotify.com',
    description: 'Premium Family plan with offline listening',
    features: ['Offline Listening', 'No Ads', 'Unlimited Skips', 'High Quality Audio', 'Family Plan (6 accounts)'],
    syncFrequency: 'weekly',
    autoSyncEnabled: false,
    lastSync: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    nextSync: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    dataUsage: {
      subscriptions: 1,
      billingRecords: 6,
      totalSize: '1.2 MB'
    }
  },
  openai: {
    name: 'ChatGPT',
    color: '#10A37F',
    logoUrl: 'https://logo.clearbit.com/openai.com',
    description: 'ChatGPT Plus subscription',
    features: ['GPT-4 Access', 'Faster Response Times', 'Priority Access', 'Advanced Features'],
    syncFrequency: 'daily',
    autoSyncEnabled: true,
    lastSync: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    nextSync: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours from now
    dataUsage: {
      subscriptions: 1,
      billingRecords: 3,
      totalSize: '0.8 MB'
    }
  },
  amazon: {
    name: 'Amazon Prime',
    color: '#FF9900',
    logoUrl: 'https://logo.clearbit.com/amazon.com',
    description: 'Prime membership with free shipping and streaming',
    features: ['Free Two-Day Shipping', 'Prime Video', 'Prime Music', 'Prime Reading', 'Amazon Photos'],
    syncFrequency: 'weekly',
    autoSyncEnabled: true,
    lastSync: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    nextSync: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
    dataUsage: {
      subscriptions: 1,
      billingRecords: 24,
      totalSize: '4.1 MB'
    }
  }
};

const ServiceSettings: React.FC<ServiceSettingsProps> = ({
  isOpen,
  provider,
  onClose,
  onDisconnect,
  onSyncNow,
  onToggleAutoSync
}) => {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const config = MOCK_SERVICE_CONFIGS[provider];

  if (!config) {
    return null;
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      onClose();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await onSyncNow();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    onToggleAutoSync(enabled);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: config.color }}
          >
            {config.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {config.name} Settings
            </h2>
            <p className="text-sm text-muted-light dark:text-muted-dark">
              {config.description}
            </p>
          </div>
          <ConnectionStatus
            isConnected={true}
            lastSync={config.lastSync}
            size="sm"
          />
        </div>

        {/* Features */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Active Features</h3>
          <div className="grid grid-cols-2 gap-2">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Settings */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Sync Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Auto Sync</div>
                <div className="text-sm text-muted-light dark:text-muted-dark">
                  Automatically sync data {config.syncFrequency}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoSyncEnabled}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-muted-light dark:text-muted-dark">Last Sync</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {config.lastSync ? formatDate(config.lastSync) : 'Never'}
                </div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm text-muted-light dark:text-muted-dark">Next Sync</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {config.nextSync ? formatDate(config.nextSync) : 'Disabled'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Usage */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Data Usage</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-primary">{config.dataUsage.subscriptions}</div>
              <div className="text-sm text-muted-light dark:text-muted-dark">Subscriptions</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-primary">{config.dataUsage.billingRecords}</div>
              <div className="text-sm text-muted-light dark:text-muted-dark">Billing Records</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-primary">{config.dataUsage.totalSize}</div>
              <div className="text-sm text-muted-light dark:text-muted-dark">Total Size</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSyncing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Syncing...</span>
              </>
            ) : (
              <span>Sync Now</span>
            )}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ServiceSettings;