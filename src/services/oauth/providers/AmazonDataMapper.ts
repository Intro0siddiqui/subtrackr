import {
  SubscriptionData,
  BillingRecord,
  OAuthSubscription
} from '../../../types/oauth';
import {
  AmazonSubscriptionData,
  AmazonBillingData,
  AmazonUserData,
  AmazonValidationResult,
  AmazonBillingValidationResult,
 AmazonUtils
} from './AmazonTypes';

/**
 * Amazon Data Mapper
 *
 * Transforms Amazon API data to internal subscription format
 * with validation and data integrity checks
 */
export class AmazonDataMapper {
  private static readonly AMAZON_LOGO_URL = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices-original.svg';

  /**
   * Map Amazon subscription data to internal subscription format
   */
  static mapToInternalSubscription(
    amazonData: AmazonSubscriptionData,
    userData?: AmazonUserData
  ): OAuthSubscription {
    // Validate required fields
    const validation = AmazonUtils.validateSubscriptionData(amazonData);
    if (!validation.isValid) {
      throw new Error(`Amazon subscription data validation failed: ${validation.errors.join(', ')}`);
    }

    const mappedData: OAuthSubscription = {
      id: `amazon_${amazonData.subscription_id}`,
      name: 'Amazon Prime',
      category: 'Streaming & Shopping',
      amount: amazonData.amount,
      currency: amazonData.currency,
      billingCycle: AmazonUtils.normalizeBillingCycle(amazonData.billing_cycle).toLowerCase(),
      nextBillingDate: amazonData.next_billing_date ? new Date(amazonData.next_billing_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now for free tier
      paymentMethod: 'Credit Card', // Default for Amazon
      status: AmazonUtils.mapStatus(amazonData.status),
      description: `${AmazonUtils.mapTier(amazonData.product_name)} Plan`,
      autoRenew: amazonData.auto_renew,
      startDate: new Date(amazonData.start_date),
      endDate: amazonData.end_date ? new Date(amazonData.end_date) : undefined,
      logoUrl: this.AMAZON_LOGO_URL,
      externalId: amazonData.subscription_id,
      providerId: 'amazon',
      providerData: amazonData,
      // Additional metadata
      user_id: userData?.user_id,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return mappedData;
  }

  /**
   * Map multiple Amazon subscriptions to internal format
   */
  static mapMultipleSubscriptions(
    subscriptions: AmazonSubscriptionData[],
    userData?: AmazonUserData
  ): OAuthSubscription[] {
    return subscriptions.map(sub => this.mapToInternalSubscription(sub, userData));
  }

  /**
   * Map Amazon billing data to internal billing records
   */
  static mapToInternalBilling(
    billingData: AmazonBillingData[],
    subscriptionMap: Map<string, string> // Amazon subscription ID -> Internal subscription ID
  ): BillingRecord[] {
    return billingData.map(record => ({
      id: `amazon_billing_${record.transaction_id}`,
      subscriptionId: subscriptionMap.get(record.subscription_id) || record.subscription_id,
      amount: record.amount,
      currency: record.currency,
      date: new Date(record.date),
      description: record.description,
      metadata: {
        paymentMethod: AmazonUtils.mapPaymentMethod(record.payment_method),
        status: record.status.toLowerCase(),
        createdAt: record.created_at,
        provider: 'amazon'
      }
    }));
  }

  /**
   * Transform and validate subscription data with error handling
   */
  static transformSubscriptionData(
    rawData: any,
    userData?: AmazonUserData
  ): { success: boolean; data?: OAuthSubscription; errors?: string[] } {
    try {
      // Basic structure validation
      if (!rawData || typeof rawData !== 'object') {
        return { success: false, errors: ['Invalid subscription data structure'] };
      }

      // Transform to AmazonSubscriptionData format
      const amazonData: AmazonSubscriptionData = {
        subscription_id: rawData.subscription_id || rawData.id || `amazon_${Date.now()}`,
        product_id: rawData.product_id || rawData.planId || rawData.product || 'PRIME_BASIC',
        product_name: rawData.product_name || rawData.planName || rawData.product || 'Prime Basic',
        status: rawData.status || 'ACTIVE',
        amount: Number(rawData.amount || rawData.price || 0),
        currency: rawData.currency || 'USD',
        billing_cycle: rawData.billing_cycle || rawData.billingCycle || 'MONTHLY',
        next_billing_date: rawData.next_billing_date || rawData.nextBillingDate,
        start_date: rawData.start_date || rawData.startDate || new Date().toISOString(),
        end_date: rawData.end_date || rawData.endDate,
        auto_renew: Boolean(rawData.auto_renew !== false), // Default to true
        created_at: rawData.created_at || rawData.createdAt || new Date().toISOString(),
        updated_at: rawData.updated_at || rawData.updatedAt || new Date().toISOString()
      };

      // Validate and map
      const validation = AmazonUtils.validateSubscriptionData(amazonData);
      if (!validation.isValid) {
        throw new Error(`Amazon subscription data validation failed: ${validation.errors.join(', ')}`);
      }
      const mappedData = this.mapToInternalSubscription(amazonData, userData);

      return { success: true, data: mappedData };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown transformation error']
      };
    }
  }

  /**
   * Transform and validate billing data with error handling
   */
  static transformBillingData(
    rawData: any[]
  ): { success: boolean; data?: BillingRecord[]; errors?: string[] } {
    try {
      if (!Array.isArray(rawData)) {
        return { success: false, errors: ['Billing data must be an array'] };
      }

      const transformedData: AmazonBillingData[] = rawData.map(record => ({
        transaction_id: record.transaction_id || record.id || record.billing_id || `amazon_billing_${Date.now()}_${Math.random()}`,
        subscription_id: record.subscription_id || record.subscriptionId,
        amount: Number(record.amount || 0),
        currency: record.currency || 'USD',
        date: record.date || record.billing_date || new Date().toISOString(),
        description: record.description || record.memo || 'Amazon Prime subscription payment',
        payment_method: record.payment_method || record.paymentMethod || 'CREDIT_CARD',
        status: record.status || 'SUCCESS',
        created_at: record.created_at || record.createdAt || new Date().toISOString()
      }));

      // Validate all records
      transformedData.forEach((record, index) => {
        const validation = AmazonUtils.validateBillingData(record);
        if (!validation.isValid) {
          throw new Error(`Billing record ${index + 1} validation failed: ${validation.errors.join(', ')}`);
        }
      });

      // Create subscription ID mapping (Amazon ID -> Internal ID)
      const subscriptionMap = new Map<string, string>();
      transformedData.forEach(record => {
        subscriptionMap.set(record.subscription_id, `amazon_${record.subscription_id}`);
      });

      const mappedData = this.mapToInternalBilling(transformedData, subscriptionMap);

      return { success: true, data: mappedData };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown transformation error']
      };
    }
  }

  /**
   * Map Amazon user profile to internal format
   */
  static mapUserProfile(rawProfile: any): AmazonUserData {
    return {
      user_id: rawProfile.user_id,
      name: rawProfile.name,
      email: rawProfile.email,
      postal_code: rawProfile.postal_code,
      country: rawProfile.country
    };
  }

  /**
   * Create subscription from Amazon user profile
   */
  static createSubscriptionFromProfile(
    profile: AmazonUserData
  ): OAuthSubscription {
    // For Amazon, we don't have direct subscription info from profile
    // We'll create a basic subscription that will be updated when we fetch actual subscription data
    return {
      id: `amazon_${profile.user_id}`,
      name: 'Amazon Prime',
      category: 'Streaming & Shopping',
      amount: 0, // Will be updated when we fetch subscription data
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 1000), // Default to 30 days
      paymentMethod: 'Credit Card',
      status: 'active',
      description: 'Amazon Prime Subscription',
      autoRenew: true, // Default assumption
      startDate: new Date(),
      endDate: undefined,
      logoUrl: this.AMAZON_LOGO_URL,
      externalId: profile.user_id,
      providerId: 'amazon',
      providerData: {
        user_id: profile.user_id
      },
      user_id: profile.user_id,
      syncStatus: 'pending',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get Amazon-specific field mappings for debugging
   */
  static getFieldMappings(): Record<string, string> {
    return {
      'subscription_id': 'external_id',
      'product_name': 'description',
      'amount': 'amount',
      'currency': 'currency',
      'billing_cycle': 'billing_cycle',
      'next_billing_date': 'next_billing_date',
      'start_date': 'start_date',
      'end_date': 'end_date',
      'auto_renew': 'auto_renew',
      'status': 'status',
      'product_id': 'plan_id'
    };
  }

  /**
   * Validate and normalize Amazon product type
   */
  static normalizeProductType(product: string): string {
    const normalized = product.toUpperCase();
    if (['PRIME_PREMIUM', 'PRIME_STUDENT', 'PRIME_FAMILY'].includes(normalized)) {
      return normalized;
    }
    return 'PRIME_BASIC';
  }

  /**
   * Get subscription tier information
   */
  static getTierInfo(product: string): {
    name: string;
    amount: number;
    currency: string;
    features: string[];
  } {
    const tier = this.normalizeProductType(product);

    const tierInfo = {
      PRIME_BASIC: {
        name: 'Prime Basic',
        amount: 0,
        currency: 'USD',
        features: ['Free shipping', 'Prime Video', 'Prime Music']
      },
      PRIME_PREMIUM: {
        name: 'Prime Premium',
        amount: 14.99,
        currency: 'USD',
        features: ['All Basic features', 'Prime Video 4K', 'Prime Music HD', 'Prime Gaming', 'Prime Reading']
      },
      PRIME_STUDENT: {
        name: 'Prime Student',
        amount: 7.49,
        currency: 'USD',
        features: ['All Basic features', 'Student discount', 'Exclusive deals']
      },
      PRIME_FAMILY: {
        name: 'Prime Family',
        amount: 20.99,
        currency: 'USD',
        features: ['All Premium features', 'Up to 6 accounts', 'Family sharing']
      }
    };

    return tierInfo[tier as keyof typeof tierInfo] || tierInfo.PRIME_BASIC;
  }
}