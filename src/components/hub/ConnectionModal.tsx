import React, { useState, useEffect } from 'react';
import Modal from '../Modal';

interface ConnectionModalProps {
  isOpen: boolean;
  provider: {
    id: string;
    name: string;
    description: string;
    logoUrl?: string;
    color: string;
  };
  onClose: () => void;
  onConnect: (providerId: string) => Promise<void>;
  onError: (providerId: string, error: string) => void;
}

const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  provider,
  onClose,
  onConnect,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'initial' | 'connecting' | 'success' | 'error'>('initial');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('initial');
      setErrorMessage('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleConnect = async () => {
    setIsLoading(true);
    setCurrentStep('connecting');

    try {
      await onConnect(provider.id);
      setCurrentStep('success');
      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setErrorMessage(message);
      setCurrentStep('error');
      onError(provider.id, message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setCurrentStep('initial');
    setErrorMessage('');
    handleConnect();
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'initial':
        return (
          <div className="text-center">
            {/* Provider Logo and Info */}
            <div className="mb-6">
              {provider.logoUrl ? (
                <img 
                  src={provider.logoUrl} 
                  alt={provider.name} 
                  className="w-16 h-16 rounded-xl object-contain mx-auto mb-4"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4"
                  style={{ backgroundColor: provider.color }}
                >
                  {provider.name.charAt(0)}
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Connect to {provider.name}
              </h3>
              <p className="text-muted-light dark:text-muted-dark">
                {provider.description}
              </p>
            </div>

            {/* Permissions */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                This will allow SubDash to:
              </h4>
              <ul className="text-sm text-muted-light dark:text-muted-dark space-y-1">
                <li className="flex items-start space-x-2">
                  <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>View your subscription details and billing history</span>
                </li>
                <li className="flex items-start space-x-2">
                  <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Track payment dates and amounts</span>
                </li>
                <li className="flex items-start space-x-2">
                  <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Monitor subscription status changes</span>
                </li>
                <li className="flex items-start space-x-2">
                  <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Send you notifications about upcoming payments</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: provider.color }}
              >
                <span>Connect {provider.name}</span>
              </button>
            </div>
          </div>
        );

      case 'connecting':
        return (
          <div className="text-center py-8">
            {provider.logoUrl ? (
              <img 
                src={provider.logoUrl} 
                alt={provider.name} 
                className="w-16 h-16 rounded-xl object-contain mx-auto mb-4 animate-pulse"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 animate-pulse"
                style={{ backgroundColor: provider.color }}
              >
                {provider.name.charAt(0)}
              </div>
            )}
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Connecting to {provider.name}...
            </h3>
            <p className="text-sm text-muted-light dark:text-muted-dark">
              Please wait while we securely connect your account.
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Successfully Connected!
            </h3>
            <p className="text-sm text-muted-light dark:text-muted-dark">
              Your {provider.name} account has been connected. We'll start syncing your subscription data shortly.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.7-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Connection Failed
            </h3>
            <p className="text-sm text-muted-light dark:text-muted-dark mb-4">
              {errorMessage || `We couldn't connect to ${provider.name}. Please try again.`}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: provider.color }}
              >
                Try Again
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="min-h-[400px]">
        {renderStepContent()}
      </div>
    </Modal>
  );
};

export default ConnectionModal;