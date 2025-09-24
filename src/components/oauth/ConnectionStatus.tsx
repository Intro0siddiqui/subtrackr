import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
  hasError?: boolean;
  lastSync?: Date;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting = false,
  hasError = false,
  lastSync,
  size = 'md',
  showText = true,
  className = ''
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

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          icon: 'h-3 w-3',
          text: 'text-xs'
        };
      case 'lg':
        return {
          icon: 'h-5 w-5',
          text: 'text-sm'
        };
      default:
        return {
          icon: 'h-4 w-4',
          text: 'text-sm'
        };
    }
  };

  const getStatusDisplay = () => {
    if (isConnecting) {
      return {
        icon: (
          <div className={`animate-spin rounded-full border-2 border-primary border-t-transparent ${getSizeClasses().icon}`}></div>
        ),
        text: 'Connecting...',
        color: 'text-primary'
      };
    }

    if (hasError) {
      return {
        icon: (
          <svg className={`${getSizeClasses().icon} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        ),
        text: 'Error',
        color: 'text-red-500'
      };
    }

    if (isConnected) {
      return {
        icon: (
          <svg className={`${getSizeClasses().icon} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
        text: 'Connected',
        color: 'text-green-500'
      };
    }

    return {
      icon: (
        <svg className={`${getSizeClasses().icon} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
        </svg>
      ),
      text: 'Disconnected',
      color: 'text-gray-400'
    };
  };

  const statusDisplay = getStatusDisplay();
  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {statusDisplay.icon}
      {showText && (
        <div className="flex flex-col">
          <span className={`${sizeClasses.text} font-medium ${statusDisplay.color}`}>
            {statusDisplay.text}
          </span>
          {isConnected && lastSync && (
            <span className={`${size === 'sm' ? 'text-xs' : 'text-xs'} text-muted-light dark:text-muted-dark`}>
              Synced {formatLastSync(lastSync)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;