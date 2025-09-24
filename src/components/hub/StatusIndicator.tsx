import React from 'react';

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
  className = ''
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'lg':
        return 'w-4 h-4';
      default:
        return 'w-3 h-3';
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          label: 'Connected',
          textColor: 'text-green-600 dark:text-green-400'
        };
      case 'disconnected':
        return {
          color: 'bg-gray-400',
          label: 'Disconnected',
          textColor: 'text-gray-500 dark:text-gray-400'
        };
      case 'connecting':
        return {
          color: 'bg-blue-500',
          label: 'Connecting',
          textColor: 'text-blue-600 dark:text-blue-400'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          label: 'Error',
          textColor: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          color: 'bg-gray-400',
          label: 'Unknown',
          textColor: 'text-gray-500 dark:text-gray-400'
        };
    }
  };

  const config = getStatusConfig();
  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div className={`rounded-full ${sizeClasses} ${config.color}`}></div>
        {status === 'connecting' && (
          <div className={`absolute inset-0 rounded-full ${sizeClasses} ${config.color} animate-ping opacity-75`}></div>
        )}
      </div>
      {showLabel && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;