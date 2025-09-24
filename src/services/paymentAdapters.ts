import type { PaymentProvider, Transaction, Subscription } from '../types';
import { PaymentMethod } from '../types';
import { paymentAuthService } from './auth';
import { encryptionService } from './encryption';

export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface SubscriptionFilter {
  status?: string;
  category?: string;
  provider?: string;
}

export interface PaymentAdapter {
  provider: PaymentProvider;
  authenticate(credentials: any): Promise<boolean>;
  getTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getSubscriptions(filter?: SubscriptionFilter): Promise<Subscription[]>;
  syncTransactions(): Promise<Transaction[]>;
  syncSubscriptions(): Promise<Subscription[]>;
  validateCredentials(): Promise<boolean>;
}

export class RazorpayAdapter implements PaymentAdapter {
  provider: PaymentProvider = {
    id: 'razorpay',
    name: 'razorpay',
    displayName: 'Razorpay',
    logoUrl: 'https://razorpay.com/favicon.ico',
    supportedMethods: [PaymentMethod.UPI, PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.NET_BANKING, PaymentMethod.WALLET],
    authUrl: 'https://dashboard.razorpay.com',
    apiBaseUrl: 'https://api.razorpay.com/v1',
    features: {
      transactionHistory: true,
      subscriptionManagement: true,
      autoSync: true
    }
  };

  private apiKey: string = '';
  private apiSecret: string = '';

  async authenticate(credentials: { apiKey: string; apiSecret: string }): Promise<boolean> {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;

    try {
      // Test authentication with Razorpay API
      const response = await fetch(`${this.provider.apiBaseUrl}/payments`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.apiKey}:${this.apiSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Razorpay authentication failed:', error);
      return false;
    }
  }

  async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.startDate) params.append('from', filter.startDate.toISOString().split('T')[0]);
      if (filter?.endDate) params.append('to', filter.endDate.toISOString().split('T')[0]);
      if (filter?.status) params.append('status', filter.status);

      const response = await fetch(`${this.provider.apiBaseUrl}/payments?${params}`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.apiKey}:${this.apiSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();

      return data.items.map((item: any) => ({
        id: item.id,
        subscriptionId: item.notes?.subscription_id || '',
        user_id: '', // Would be set by the calling service
        amount: item.amount / 100, // Razorpay amounts are in paise
        currency: item.currency,
        transactionDate: new Date(item.created_at * 1000),
        paymentMethod: this.mapPaymentMethod(item.method),
        transactionId: item.id,
        status: this.mapTransactionStatus(item.status),
        provider: this.provider.name,
        metadata: item,
        createdAt: new Date()
      }));
    } catch (error) {
      console.error('Failed to get Razorpay transactions:', error);
      return [];
    }
  }

  async getSubscriptions(filter?: SubscriptionFilter): Promise<Subscription[]> {
    try {
      const response = await fetch(`${this.provider.apiBaseUrl}/subscriptions`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.apiKey}:${this.apiSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subscriptions');

      const data = await response.json();

      return data.items.map((item: any) => ({
        id: item.id,
        user_id: '', // Would be set by the calling service
        name: item.plan?.name || 'Unknown Plan',
        amount: item.plan?.item?.amount / 100 || 0,
        currency: item.plan?.item?.currency || 'INR',
        category: 'OTHER' as any, // Would need to be mapped based on plan details
        status: this.mapSubscriptionStatus(item.status),
        billingCycle: this.mapBillingCycle(item.interval),
        paymentMethod: PaymentMethod.UPI, // Default, would be determined from payment method
        startDate: new Date(item.created_at * 1000),
        nextBillingDate: new Date(item.current_start * 1000 + (item.interval === 1 ? 30 : 365) * 24 * 60 * 60 * 1000),
        logoUrl: this.provider.logoUrl,
        autoRenew: item.status === 'active',
        createdAt: new Date(item.created_at * 1000),
        updatedAt: new Date()
      }));
    } catch (error) {
      console.error('Failed to get Razorpay subscriptions:', error);
      return [];
    }
  }

  async syncTransactions(): Promise<Transaction[]> {
    return this.getTransactions();
  }

  async syncSubscriptions(): Promise<Subscription[]> {
    return this.getSubscriptions();
  }

  async validateCredentials(): Promise<boolean> {
    return this.authenticate({ apiKey: this.apiKey, apiSecret: this.apiSecret });
  }

  private mapPaymentMethod(method: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'card': PaymentMethod.CREDIT_CARD,
      'netbanking': PaymentMethod.NET_BANKING,
      'wallet': PaymentMethod.WALLET,
      'upi': PaymentMethod.UPI
    };
    return methodMap[method] || PaymentMethod.UPI;
  }

  private mapTransactionStatus(status: string): 'success' | 'failed' | 'pending' | 'refunded' {
    const statusMap: Record<string, 'success' | 'failed' | 'pending' | 'refunded'> = {
      'captured': 'success',
      'failed': 'failed',
      'pending': 'pending',
      'refunded': 'refunded'
    };
    return statusMap[status] || 'pending';
  }

  private mapSubscriptionStatus(status: string): any {
    const statusMap: Record<string, any> = {
      'active': 'ACTIVE',
      'cancelled': 'CANCELLED',
      'expired': 'EXPIRED',
      'paused': 'PAUSED'
    };
    return statusMap[status] || 'ACTIVE';
  }

  private mapBillingCycle(interval: number): any {
    return interval === 1 ? 'MONTHLY' : 'YEARLY';
  }
}

export class PayPalAdapter implements PaymentAdapter {
  provider: PaymentProvider = {
    id: 'paypal',
    name: 'paypal',
    displayName: 'PayPal',
    logoUrl: 'https://paypalobjects.com/webstatic/icon/pp258.png',
    supportedMethods: [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.BANK_TRANSFER],
    authUrl: 'https://www.paypal.com/signin',
    apiBaseUrl: 'https://api-m.paypal.com/v1',
    features: {
      transactionHistory: true,
      subscriptionManagement: true,
      autoSync: true
    }
  };

  private clientId: string = '';
  private clientSecret: string = '';
  private accessToken: string = '';

  async authenticate(credentials: { clientId: string; clientSecret: string }): Promise<boolean> {
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;

    try {
      const response = await fetch(`${this.provider.apiBaseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) throw new Error('PayPal authentication failed');

      const data = await response.json();
      this.accessToken = data.access_token;
      return true;
    } catch (error) {
      console.error('PayPal authentication failed:', error);
      return false;
    }
  }

  async getTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.startDate) params.append('start_date', filter.startDate.toISOString().split('T')[0]);
      if (filter?.endDate) params.append('end_date', filter.endDate.toISOString().split('T')[0]);

      const response = await fetch(`${this.provider.apiBaseUrl}/reporting/transactions?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PayPal transactions');

      const data = await response.json();

      return data.transaction_details?.map((item: any) => ({
        id: item.transaction_id,
        subscriptionId: item.subscription_id || '',
        user_id: '',
        amount: parseFloat(item.transaction_amount?.value || '0'),
        currency: item.transaction_amount?.currency_code || 'USD',
        transactionDate: new Date(item.transaction_initiation_date || item.date),
        paymentMethod: this.mapPaymentMethod(item.payment_instrument_type),
        transactionId: item.transaction_id,
        status: this.mapTransactionStatus(item.status),
        provider: this.provider.name,
        metadata: item,
        createdAt: new Date()
      })) || [];
    } catch (error) {
      console.error('Failed to get PayPal transactions:', error);
      return [];
    }
  }

  async getSubscriptions(filter?: SubscriptionFilter): Promise<Subscription[]> {
    try {
      const response = await fetch(`${this.provider.apiBaseUrl}/billing/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch PayPal subscriptions');

      const data = await response.json();

      return data.subscriptions?.map((item: any) => ({
        id: item.id,
        user_id: '',
        name: item.plan?.name || 'PayPal Subscription',
        amount: parseFloat(item.billing_info?.last_payment?.amount?.value || '0'),
        currency: item.billing_info?.last_payment?.amount?.currency_code || 'USD',
        category: 'OTHER' as any,
        status: this.mapSubscriptionStatus(item.status),
        billingCycle: this.mapBillingCycle(item.billing_info?.cycle_executions?.[0]?.tenure_type),
        paymentMethod: PaymentMethod.CREDIT_CARD,
        startDate: new Date(item.create_time),
        nextBillingDate: new Date(item.billing_info?.next_billing_time || item.create_time),
        logoUrl: this.provider.logoUrl,
        autoRenew: item.status === 'ACTIVE',
        createdAt: new Date(item.create_time),
        updatedAt: new Date()
      })) || [];
    } catch (error) {
      console.error('Failed to get PayPal subscriptions:', error);
      return [];
    }
  }

  async syncTransactions(): Promise<Transaction[]> {
    return this.getTransactions();
  }

  async syncSubscriptions(): Promise<Subscription[]> {
    return this.getSubscriptions();
  }

  async validateCredentials(): Promise<boolean> {
    return this.authenticate({ clientId: this.clientId, clientSecret: this.clientSecret });
  }

  private mapPaymentMethod(method: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'PAYPAL': PaymentMethod.WALLET,
      'CREDIT_CARD': PaymentMethod.CREDIT_CARD,
      'DEBIT_CARD': PaymentMethod.DEBIT_CARD
    };
    return methodMap[method] || PaymentMethod.WALLET;
  }

  private mapTransactionStatus(status: string): 'success' | 'failed' | 'pending' | 'refunded' {
    const statusMap: Record<string, 'success' | 'failed' | 'pending' | 'refunded'> = {
      'COMPLETED': 'success',
      'PENDING': 'pending',
      'FAILED': 'failed',
      'REFUNDED': 'refunded'
    };
    return statusMap[status] || 'pending';
  }

  private mapSubscriptionStatus(status: string): any {
    const statusMap: Record<string, any> = {
      'ACTIVE': 'ACTIVE',
      'CANCELLED': 'CANCELLED',
      'EXPIRED': 'EXPIRED',
      'SUSPENDED': 'PAUSED'
    };
    return statusMap[status] || 'ACTIVE';
  }

  private mapBillingCycle(cycle: string): any {
    const cycleMap: Record<string, any> = {
      'REGULAR': 'MONTHLY',
      'TRIAL': 'MONTHLY'
    };
    return cycleMap[cycle] || 'MONTHLY';
  }
}

export class PaymentAdapterFactory {
  static createAdapter(providerName: string): PaymentAdapter | null {
    switch (providerName.toLowerCase()) {
      case 'razorpay':
        return new RazorpayAdapter();
      case 'paypal':
        return new PayPalAdapter();
      default:
        return null;
    }
  }

  static getSupportedProviders(): PaymentProvider[] {
    return [
      new RazorpayAdapter().provider,
      new PayPalAdapter().provider
    ];
  }
}