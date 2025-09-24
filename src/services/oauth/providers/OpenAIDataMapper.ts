/**
 * OpenAI Data Mapper
 *
 * Maps OpenAI API responses to internal data structures
 */

import {
  OAuthSubscription,
  UserProfile,
  SubscriptionData,
  BillingRecord
} from '../../../types/oauth';

import {
  OpenAIUser,
  OpenAISubscription,
  OpenAIBillingRecord,
  OpenAIUtils
} from './OpenAITypes';

/**
 * OpenAI Data Mapper
 *
 * Maps OpenAI API responses to internal data structures
 */
export class OpenAIDataMapper {
  /**
   * Map OpenAI user and subscription data to internal OAuthSubscription format
   */
  static mapToInternalSubscription(
    subscriptionData: SubscriptionData,
    userData: Partial<UserProfile>
  ): OAuthSubscription {
    return {
      id: `openai_${subscriptionData.id}`,
      name: subscriptionData.name,
      amount: subscriptionData.amount || 0,
      currency: subscriptionData.currency || 'usd',
      category: 'ai',
      status: subscriptionData.status,
      billingCycle: subscriptionData.billingCycle || 'monthly',
      paymentMethod: 'credit_card',
      startDate: subscriptionData.startDate || new Date(),
      endDate: subscriptionData.endDate,
      nextBillingDate: subscriptionData.nextBillingDate || new Date(),
      logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/openai/openai-original.svg',
      description: 'OpenAI API Subscription',
      providerId: 'openai',
      autoRenew: subscriptionData.metadata?.cancelAtPeriodEnd !== true,
      trialEndDate: subscriptionData.metadata?.trialEnd ? new Date(subscriptionData.metadata.trialEnd) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      oauthConnectionId: userData.id,
      externalId: subscriptionData.id,
      providerData: {
        ...subscriptionData.metadata,
        userData
      },
      lastSyncedAt: new Date(),
      syncStatus: 'synced'
    };
  }

  /**
   * Map multiple OpenAI subscriptions to internal OAuthSubscription format
   */
  static mapMultipleSubscriptions(
    subscriptions: SubscriptionData[],
    userData: Partial<UserProfile>
  ): OAuthSubscription[] {
    return subscriptions.map(subscription =>
      this.mapToInternalSubscription(subscription, userData)
    );
  }

  /**
   * Map OpenAI billing records to internal BillingRecord format
   */
  static mapToInternalBilling(
    billingRecords: BillingRecord[],
    subscriptionMap: Map<string, string>
  ): BillingRecord[] {
    return billingRecords.map(record => {
      const subscriptionId = subscriptionMap.get(record.subscriptionId) || record.subscriptionId;
      
      return {
        ...record,
        subscriptionId
      };
    });
  }

  /**
   * Map OpenAI user data to internal UserProfile format
   */
  static mapUserToProfile(userData: OpenAIUser): UserProfile {
    return OpenAIUtils.mapUserToProfile(userData);
  }

  /**
   * Map OpenAI subscription data to internal SubscriptionData format
   */
  static mapSubscriptionToData(subscriptionData: OpenAISubscription): SubscriptionData {
    return OpenAIUtils.mapSubscriptionToData(subscriptionData);
  }

  /**
   * Map OpenAI billing record to internal BillingRecord format
   */
  static mapBillingRecordToData(billingRecord: OpenAIBillingRecord): BillingRecord {
    return OpenAIUtils.mapBillingRecordToData(billingRecord);
  }
}