import { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandler } from '../services/error/ErrorHandler';
import { errorReporter } from '../services/error/ErrorReporter';
import FallbackUI from './FallbackUI.tsx';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * React error boundary for UI errors
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  /**
   * Static method to catch errors in child components
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Method called when an error is caught
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Handle the error
    const errorResult = errorHandler.handleError(error, {
      component: 'ReactComponent',
      operation: 'render'
    });
    
    // Report the error
    errorReporter.reportError(
      {
        code: error.name,
        message: error.message,
        details: { stack: error.stack, componentStack: errorInfo.componentStack },
        timestamp: new Date()
      },
      {
        component: 'ReactComponent',
        operation: 'render'
      },
      errorResult.severity,
      errorResult.category
    );
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset error state
   */
  public resetError() {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  }

  /**
   * Render method
   */
  public render() {
    if (this.state.hasError) {
      // Render fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Render default fallback UI
      return (
        <FallbackUI 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() => this.resetError()}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;