import React from 'react';

interface SyncStatusProps {
  lastSync?: Date;
  isSyncing?: boolean;
  syncStatus?: 'success' | 'failed' | 'pending';
  className?: string;
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  lastSync,
  isSyncing = false,
  syncStatus = 'pending',
  className = ''
}) => {
  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never synced';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getStatusDisplay = () => {
    if (isSyncing) {
      return {
        icon: (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        ),
        text: 'Syncing...',
        color: 'text-blue-600 dark:text-blue-400'
      };
    }

    switch (syncStatus) {
      case 'success':
        return {
          icon: (
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: 'Synced',
          color: 'text-green-600 dark:text-green-400'
        };
      case 'failed':
        return {
          icon: (
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.7-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ),
          text: 'Sync failed',
          color: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          icon: (
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          ),
          text: 'Not synced',
          color: 'text-gray-500 dark:text-gray-400'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      {statusDisplay.icon}
      <div className="flex flex-col">
        <span className={`font-medium ${statusDisplay.color}`}>
          {statusDisplay.text}
        </span>
        {lastSync && (
          <span className="text-xs text-muted-light dark:text-muted-dark">
            Last sync: {formatLastSync(lastSync)}
          </span>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;