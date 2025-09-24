import React from 'react';
import StatusIndicator from './StatusIndicator';
import SyncStatus from './SyncStatus';

interface ServiceCardProps {
  provider: string;
  name: string;
  description: string;
  logoUrl?: string;
  color: string;
  isConnected: boolean;
  isConnecting?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  lastSync?: Date;
  isSyncing?: boolean;
  syncStatus?: 'success' | 'failed' | 'pending';
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry?: () => void;
  className?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  provider,
  name,
  description,
  logoUrl,
  color,
  isConnected,
  isConnecting = false,
  hasError = false,
 errorMessage,
  lastSync,
  isSyncing = false,
  syncStatus = 'pending',
  onConnect,
  onDisconnect,
  onRetry,
  className = ''
}) => {
  const getStatus = () => {
    if (isConnecting) return 'connecting';
    if (hasError) return 'error';
    if (isConnected) return 'connected';
    return 'disconnected';
  };

  return (
    <div className={`relative rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
      hasError ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
      isConnected ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
      'border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark'
    } ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={name} 
                className="w-12 h-12 rounded-lg object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.nextSibling && target.nextSibling instanceof HTMLElement) {
                    target.nextSibling.classList.remove('hidden');
                  }
                }}
              />
            ) : null}
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg ${
              !logoUrl ? '' : 'hidden'
            }`} style={{ backgroundColor: color }}>
              {name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
              <StatusIndicator 
                status={getStatus()} 
                size="sm" 
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-light dark:text-muted-dark mb-4 line-clamp-2">
          {description}
        </p>

        {/* Sync Status */}
        {isConnected && (
          <div className="mb-4">
            <SyncStatus 
              lastSync={lastSync}
              isSyncing={isSyncing}
              syncStatus={syncStatus}
            />
          </div>
        )}

        {/* Error Message */}
        {hasError && errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-70 dark:text-red-300">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          {isConnected ? (
            <button
              onClick={onDisconnect}
              disabled={isConnecting}
              className="flex-1 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Connect</span>
              )}
            </button>
          )}

          {hasError && onRetry && (
            <button
              onClick={onRetry}
              disabled={isConnecting}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;