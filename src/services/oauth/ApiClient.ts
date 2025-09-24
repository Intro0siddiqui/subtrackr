import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { OAuthProvider } from './OAuthProvider';
import { tokenManager } from './TokenManager';
import { OAuthError } from '../../types/oauth';

/**
 * HTTP client configuration
 */
interface HttpClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * Extended request configuration
 */
interface ExtendedRequestConfig extends AxiosRequestConfig {
  requiresAuth?: boolean;
  userId?: string;
  providerId?: string;
}

/**
 * Response wrapper
 */
interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
}

/**
 * Rate limiting information
 */
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Dynamic HTTP client factory for different OAuth providers
 */
export class ApiClient {
  private static instance: ApiClient;
  private clients: Map<string, AxiosInstance> = new Map();
  private rateLimiters: Map<string, RateLimitInfo> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Create HTTP client for provider
   */
  private createClient(provider: OAuthProvider, config: HttpClientConfig): AxiosInstance {
    const client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SubTrackr-OAuth-Client/1.0',
        ...config.headers
      }
    });

    // Request interceptor for authentication
    client.interceptors.request.use(
      async (requestConfig) => {
        if (requestConfig.requiresAuth && requestConfig.userId && requestConfig.providerId) {
          const tokens = await tokenManager.getValidTokens(
            requestConfig.userId,
            requestConfig.providerId
          );

          if (tokens) {
            requestConfig.headers = requestConfig.headers || {};
            requestConfig.headers.Authorization = `${tokens.tokenType} ${tokens.accessToken}`;
          }
        }
        return requestConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and rate limiting
    client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(provider.getId(), response);
        return response;
      },
      async (error) => {
        const providerId = provider.getId();

        // Update rate limit info from error response
        if (error.response) {
          this.updateRateLimitInfo(providerId, error.response);
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = this.getRetryAfter(error.response);
          if (retryAfter > 0) {
            console.log(`Rate limited for provider ${providerId}, retrying after ${retryAfter}ms`);
            await this.delay(retryAfter);
            return this.retryRequest(error.config, provider, config);
          }
        }

        // Handle token refresh on 401
        if (error.response?.status === 401 && error.config.requiresAuth) {
          console.log(`Token expired for provider ${providerId}, attempting refresh`);
          return this.handleTokenRefresh(error, provider, config);
        }

        return Promise.reject(this.createApiError(error, provider));
      }
    );

    return client;
  }

  /**
   * Get or create HTTP client for provider
   */
  private getClient(provider: OAuthProvider, config: HttpClientConfig): AxiosInstance {
    const cacheKey = `${provider.getId()}-${config.baseURL}`;

    if (!this.clients.has(cacheKey)) {
      this.clients.set(cacheKey, this.createClient(provider, config));
    }

    return this.clients.get(cacheKey)!;
  }

  /**
   * Make HTTP request
   */
  async request<T = any>(
    provider: OAuthProvider,
    config: ExtendedRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const clientConfig: HttpClientConfig = {
        baseURL: provider.getApiBaseUrl(),
        timeout: 30000,
        retries: 3,
        retryDelay: 1000
      };

      const client = this.getClient(provider, clientConfig);
      const response: AxiosResponse<T> = await client.request(config);

      return {
        data: response.data,
        status: response.status,
        headers: this.flattenHeaders(response.headers),
        success: true
      };
    } catch (error) {
      console.error(`API request failed for provider ${provider.getId()}:`, error);
      throw error;
    }
  }

  /**
   * Make GET request
   */
  async get<T = any>(
    provider: OAuthProvider,
    url: string,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(provider, {
      method: 'GET',
      url,
      ...config
    });
  }

  /**
   * Make POST request
   */
  async post<T = any>(
    provider: OAuthProvider,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(provider, {
      method: 'POST',
      url,
      data,
      ...config
    });
  }

  /**
   * Make PUT request
   */
  async put<T = any>(
    provider: OAuthProvider,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(provider, {
      method: 'PUT',
      url,
      data,
      ...config
    });
  }

  /**
   * Make PATCH request
   */
  async patch<T = any>(
    provider: OAuthProvider,
    url: string,
    data?: any,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(provider, {
      method: 'PATCH',
      url,
      data,
      ...config
    });
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(
    provider: OAuthProvider,
    url: string,
    config: ExtendedRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(provider, {
      method: 'DELETE',
      url,
      ...config
    });
  }

  /**
   * Handle token refresh on 401 errors
   */
  private async handleTokenRefresh(
    error: any,
    provider: OAuthProvider,
    config: HttpClientConfig
  ): Promise<AxiosResponse> {
    const originalRequest = error.config;

    if (!originalRequest.userId || !originalRequest.providerId) {
      return Promise.reject(error);
    }

    try {
      // Refresh tokens
      const refreshResult = await tokenManager.refreshTokens(
        originalRequest.userId,
        originalRequest.providerId
      );

      if (!refreshResult.success) {
        throw new Error('Token refresh failed');
      }

      // Retry original request with new token
      const client = this.getClient(provider, config);
      originalRequest.headers.Authorization = `${refreshResult.tokens!.tokenType} ${refreshResult.tokens!.accessToken}`;

      return client.request(originalRequest);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      return Promise.reject(refreshError);
    }
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest(
    config: any,
    provider: OAuthProvider,
    clientConfig: HttpClientConfig
  ): Promise<AxiosResponse> {
    const maxRetries = clientConfig.retries || 3;
    const retryDelay = clientConfig.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = this.getClient(provider, clientConfig);
        return await client.request(config);
      } catch (error: any) {
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        const delay = retryDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying request (attempt ${attempt}/${maxRetries}) after ${delay}ms`);
        await this.delay(delay);
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return error.response &&
           retryableStatusCodes.includes(error.response.status);
  }

  /**
   * Update rate limit information
   */
  private updateRateLimitInfo(providerId: string, response: AxiosResponse): void {
    const headers = response.headers;

    if (headers['x-ratelimit-limit']) {
      const rateLimitInfo: RateLimitInfo = {
        limit: parseInt(headers['x-ratelimit-limit']),
        remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
        reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
        retryAfter: headers['retry-after'] ? parseInt(headers['retry-after']) * 1000 : undefined
      };

      this.rateLimiters.set(providerId, rateLimitInfo);
    }
  }

  /**
   * Get retry after time from response
   */
  private getRetryAfter(response: AxiosResponse): number {
    const retryAfter = response.headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter);
      return isNaN(seconds) ? 60000 : seconds * 1000; // Default to 1 minute
    }
    return 60000; // Default to 1 minute
  }

  /**
   * Create API error from axios error
   */
  private createApiError(error: any, provider: OAuthProvider): OAuthError {
    const status = error.response?.status;
    const data = error.response?.data;

    let message = 'API request failed';
    let code = 'API_ERROR';

    if (status) {
      code = status.toString();
      switch (status) {
        case 400:
          message = 'Bad request';
          break;
        case 401:
          message = 'Unauthorized - token may be expired';
          break;
        case 403:
          message = 'Forbidden - insufficient permissions';
          break;
        case 404:
          message = 'Resource not found';
          break;
        case 429:
          message = 'Rate limit exceeded';
          break;
        case 500:
          message = 'Internal server error';
          break;
        case 502:
          message = 'Bad gateway';
          break;
        case 503:
          message = 'Service unavailable';
          break;
        case 504:
          message = 'Gateway timeout';
          break;
      }
    }

    return {
      code,
      message,
      provider: provider.getId(),
      details: {
        status,
        data,
        url: error.config?.url,
        method: error.config?.method,
        originalError: error.message
      }
    };
  }

  /**
   * Flatten headers object
   */
  private flattenHeaders(headers: any): Record<string, string> {
    const flattened: Record<string, string> = {};

    if (headers) {
      Object.keys(headers).forEach(key => {
        const value = headers[key];
        if (typeof value === 'string') {
          flattened[key] = value;
        } else if (Array.isArray(value)) {
          flattened[key] = value.join(', ');
        }
      });
    }

    return flattened;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limit information for provider
   */
  getRateLimitInfo(providerId: string): RateLimitInfo | null {
    return this.rateLimiters.get(providerId) || null;
  }

  /**
   * Check if provider is rate limited
   */
  isRateLimited(providerId: string): boolean {
    const rateLimit = this.rateLimiters.get(providerId);
    if (!rateLimit) return false;

    return rateLimit.remaining <= 0 && rateLimit.reset > new Date();
  }

  /**
   * Clear client cache
   */
  clearCache(): void {
    this.clients.clear();
    this.rateLimiters.clear();
  }

  /**
   * Remove client for specific provider
   */
  removeClient(providerId: string): void {
    const keysToRemove: string[] = [];

    this.clients.forEach((_, key) => {
      if (key.startsWith(`${providerId}-`)) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => {
      this.clients.delete(key);
    });

    this.rateLimiters.delete(providerId);
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();