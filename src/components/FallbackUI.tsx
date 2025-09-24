import React from 'react';

interface FallbackUIProps {
  error?: Error;
  errorInfo?: React.ErrorInfo;
  onReset?: () => void;
}

/**
 * Fallback UI components for error states
 */
const FallbackUI: React.FC<FallbackUIProps> = ({ error, errorInfo, onReset }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            We're sorry, but an unexpected error occurred. Our team has been notified.
          </p>
        </div>

        {error && (
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-left">
            <h3 className="font-medium text-gray-900 dark:text-white">Error Details:</h3>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 font-mono">
              {error.message}
            </p>
            {errorInfo?.componentStack && (
              <details className="mt-2">
                <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  Component stack trace
                </summary>
                <pre className="mt-2 text-xs text-gray-500 dark:text-gray-400 overflow-auto max-h-40">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={onReset}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white dark:focus:ring-offset-gray-800"
          >
            Reload Page
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4">
          <p>
            Need help?{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default FallbackUI;