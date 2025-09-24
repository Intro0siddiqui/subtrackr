import React from 'react';

interface ServiceCardProps {
  provider: string;
  name: string;
  description: string;
  logoUrl: string;
  color: string;
  isConnected: boolean;
  isConnecting?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  lastSync?: Date;
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry?: () => void;
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
  onConnect,
  onDisconnect,
  onRetry
}) => {
  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getStatusColor = () => {
    if (hasError) return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    if (isConnected) return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
    return 'border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (hasError) return 'Connection Failed';
    if (isConnected) return 'Connected';
    return 'Not Connected';
  };

  const getStatusIcon = () => {
    if (isConnecting) {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
      );
    }
    if (hasError) {
      return (
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    }
    if (isConnected) {
      return (
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
      </svg>
    );
  };

  return (
    <div className={`relative rounded-xl border-2 transition-all duration-200 hover:shadow-md ${getStatusColor()}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: color }}
            >
              {name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                {getStatusIcon()}
                <span className={`text-sm font-medium ${
                  isConnected ? 'text-green-600 dark:text-green-400' :
                  hasError ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {getStatusText()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-light dark:text-muted-dark mb-4 line-clamp-2">
          {description}
        </p>

        {/* Last Sync Info */}
        {isConnected && lastSync && (
          <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Last sync:</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {formatLastSync(lastSync)}
              </span>
            </div>
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
                <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
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