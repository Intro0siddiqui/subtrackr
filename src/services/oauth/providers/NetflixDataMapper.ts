import {
  SubscriptionData,
  BillingRecord,
  OAuthSubscription
} from '../../../types/oauth';
import {
  NetflixSubscriptionData,
  NetflixBillingData,
  NetflixUserData,
  NetflixValidationResult,
  NetflixBillingValidationResult,
  NetflixUtils
} from './NetflixTypes';

/**
 * Netflix Data Mapper interfaces (using shared types from NetflixTypes.ts)
 */


/**
 * Netflix Data Mapper
 *
 * Transforms Netflix API data to internal subscription format
 * with validation and data integrity checks
 */
export class NetflixDataMapper {
  private static readonly NETFLIX_LOGO_URL = 'https://logo.clearbit.com/netflix.com';

  /**
   * Map Netflix subscription data to internal subscription format
   */
  static mapToInternalSubscription(
    netflixData: NetflixSubscriptionData,
    userData?: NetflixUserData
  ): OAuthSubscription {
    // Validate required fields
    const validation = NetflixUtils.validateSubscriptionData(netflixData);
    if (!validation.isValid) {
      throw new Error(`Netflix subscription data validation failed: ${validation.errors.join(', ')}`);
    }

    const mappedData: OAuthSubscription = {
      id: `netflix_${netflixData.id}`,
      name: 'Netflix',
      category: 'Streaming',
      amount: netflixData.amount,
      currency: netflixData.currency,
      billingCycle: NetflixUtils.normalizeBillingCycle(netflixData.billing_cycle),
      nextBillingDate: new Date(netflixData.next_billing_date),
      paymentMethod: NetflixUtils.mapPaymentMethod(netflixData.plan_id),
      status: NetflixUtils.mapStatus(netflixData.status),
      description: `${netflixData.plan_name} Plan`,
      autoRenew: netflixData.auto_renew,
      startDate: new Date(netflixData.start_date),
      endDate: netflixData.end_date ? new Date(netflixData.end_date) : undefined,
      logoUrl: this.NETFLIX_LOGO_URL,
      externalId: netflixData.id,
      providerId: 'netflix',
      providerData: netflixData,
      // Additional metadata
      user_id: userData?.id,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return mappedData;
  }

  /**
   * Map multiple Netflix subscriptions to internal format
   */
  static mapMultipleSubscriptions(
    subscriptions: NetflixSubscriptionData[],
    userData?: NetflixUserData
  ): OAuthSubscription[] {
    return subscriptions.map(sub => this.mapToInternalSubscription(sub, userData));
  }

  /**
   * Map Netflix billing data to internal billing records
   */
  static mapToInternalBilling(
    billingData: NetflixBillingData[],
    subscriptionMap: Map<string, string> // Netflix subscription ID -> Internal subscription ID
  ): BillingRecord[] {
    return billingData.map(record => ({
      id: `netflix_billing_${record.id}`,
      subscriptionId: subscriptionMap.get(record.subscription_id) || record.subscription_id,
      amount: record.amount,
      currency: record.currency,
      date: new Date(record.date),
      description: record.description,
      metadata: {
        paymentMethod: NetflixUtils.mapPaymentMethod(record.payment_method),
        status: record.status,
        createdAt: record.created_at,
        provider: 'netflix'
      }
    }));
  }



  /**
   * Transform and validate subscription data with error handling
   */
  static transformSubscriptionData(
    rawData: any,
    userData?: NetflixUserData
  ): { success: boolean; data?: OAuthSubscription; errors?: string[] } {
    try {
      // Basic structure validation
      if (!rawData || typeof rawData !== 'object') {
        return { success: false, errors: ['Invalid subscription data structure'] };
      }

      // Transform to NetflixSubscriptionData format
      const netflixData: NetflixSubscriptionData = {
        id: rawData.id || rawData.subscription_id,
        plan_id: rawData.plan_id || rawData.planId,
        plan_name: rawData.plan_name || rawData.planName || rawData.name,
        status: rawData.status,
        amount: Number(rawData.amount || rawData.price || 0),
        currency: rawData.currency || 'USD',
        billing_cycle: rawData.billing_cycle || rawData.billingCycle || 'monthly',
        next_billing_date: rawData.next_billing_date || rawData.nextBillingDate,
        start_date: rawData.start_date || rawData.startDate,
        end_date: rawData.end_date || rawData.endDate,
        auto_renew: Boolean(rawData.auto_renew !== false), // Default to true
        created_at: rawData.created_at || rawData.createdAt,
        updated_at: rawData.updated_at || rawData.updatedAt
      };

      // Validate and map
      const validation = NetflixUtils.validateSubscriptionData(netflixData);
      if (!validation.isValid) {
        throw new Error(`Netflix subscription data validation failed: ${validation.errors.join(', ')}`);
      }
      const mappedData = this.mapToInternalSubscription(netflixData, userData);

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

      const transformedData: NetflixBillingData[] = rawData.map(record => ({
        id: record.id || record.billing_id,
        subscription_id: record.subscription_id || record.subscriptionId,
        amount: Number(record.amount || 0),
        currency: record.currency || 'USD',
        date: record.date || record.billing_date,
        description: record.description || record.memo || 'Netflix subscription payment',
        payment_method: record.payment_method || record.paymentMethod || 'credit_card',
        status: record.status || 'completed',
        created_at: record.created_at || record.createdAt
      }));

      // Validate all records
      transformedData.forEach((record, index) => {
        const validation = NetflixUtils.validateBillingData(record);
        if (!validation.isValid) {
          throw new Error(`Billing record ${index + 1} validation failed: ${validation.errors.join(', ')}`);
        }
      });

      // Create subscription ID mapping (Netflix ID -> Internal ID)
      const subscriptionMap = new Map<string, string>();
      transformedData.forEach(record => {
        subscriptionMap.set(record.subscription_id, `netflix_${record.subscription_id}`);
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
   * Get Netflix-specific field mappings for debugging
   */
  static getFieldMappings(): Record<string, string> {
    return {
      'id': 'external_id',
      'plan_name': 'description',
      'amount': 'amount',
      'currency': 'currency',
      'billing_cycle': 'billing_cycle',
      'next_billing_date': 'next_billing_date',
      'start_date': 'start_date',
      'end_date': 'end_date',
      'auto_renew': 'auto_renew',
      'status': 'status'
    };
  }
}