import {
  SubscriptionData,
  BillingRecord,
  OAuthSubscription
} from '../../../types/oauth';
import {
  SpotifySubscriptionData,
  SpotifyBillingData,
  SpotifyUserData,
  SpotifyValidationResult,
  SpotifyBillingValidationResult,
  SpotifyUtils
} from './SpotifyTypes';

/**
 * Spotify Data Mapper
 *
 * Transforms Spotify API data to internal subscription format
 * with validation and data integrity checks
 */
export class SpotifyDataMapper {
  private static readonly SPOTIFY_LOGO_URL = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spotify/spotify-original.svg';

  /**
   * Map Spotify subscription data to internal subscription format
   */
  static mapToInternalSubscription(
    spotifyData: SpotifySubscriptionData,
    userData?: SpotifyUserData
  ): OAuthSubscription {
    // Validate required fields
    const validation = SpotifyUtils.validateSubscriptionData(spotifyData);
    if (!validation.isValid) {
      throw new Error(`Spotify subscription data validation failed: ${validation.errors.join(', ')}`);
    }

    const mappedData: OAuthSubscription = {
      id: `spotify_${spotifyData.id}`,
      name: 'Spotify',
      category: 'Music Streaming',
      amount: spotifyData.amount,
      currency: spotifyData.currency,
      billingCycle: SpotifyUtils.normalizeBillingCycle(spotifyData.billing_cycle),
      nextBillingDate: spotifyData.next_billing_date ? new Date(spotifyData.next_billing_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now for free tier
      paymentMethod: SpotifyUtils.mapPaymentMethod(spotifyData.plan_id),
      status: SpotifyUtils.mapStatus(spotifyData.status),
      description: `${SpotifyUtils.mapTier(spotifyData.plan_name)} Plan`,
      autoRenew: spotifyData.auto_renew,
      startDate: new Date(spotifyData.start_date),
      endDate: spotifyData.end_date ? new Date(spotifyData.end_date) : undefined,
      logoUrl: this.SPOTIFY_LOGO_URL,
      externalId: spotifyData.id,
      providerId: 'spotify',
      providerData: spotifyData,
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
   * Map multiple Spotify subscriptions to internal format
   */
  static mapMultipleSubscriptions(
    subscriptions: SpotifySubscriptionData[],
    userData?: SpotifyUserData
  ): OAuthSubscription[] {
    return subscriptions.map(sub => this.mapToInternalSubscription(sub, userData));
  }

  /**
   * Map Spotify billing data to internal billing records
   */
  static mapToInternalBilling(
    billingData: SpotifyBillingData[],
    subscriptionMap: Map<string, string> // Spotify subscription ID -> Internal subscription ID
  ): BillingRecord[] {
    return billingData.map(record => ({
      id: `spotify_billing_${record.id}`,
      subscriptionId: subscriptionMap.get(record.subscription_id) || record.subscription_id,
      amount: record.amount,
      currency: record.currency,
      date: new Date(record.date),
      description: record.description,
      metadata: {
        paymentMethod: SpotifyUtils.mapPaymentMethod(record.payment_method),
        status: record.status,
        createdAt: record.created_at,
        provider: 'spotify'
      }
    }));
  }

  /**
   * Transform and validate subscription data with error handling
   */
  static transformSubscriptionData(
    rawData: any,
    userData?: SpotifyUserData
  ): { success: boolean; data?: OAuthSubscription; errors?: string[] } {
    try {
      // Basic structure validation
      if (!rawData || typeof rawData !== 'object') {
        return { success: false, errors: ['Invalid subscription data structure'] };
      }

      // Transform to SpotifySubscriptionData format
      const spotifyData: SpotifySubscriptionData = {
        id: rawData.id || rawData.subscription_id || `spotify_${Date.now()}`,
        plan_id: rawData.plan_id || rawData.planId || rawData.product || 'free',
        plan_name: rawData.plan_name || rawData.planName || rawData.product || 'Free',
        status: rawData.status || 'active',
        amount: Number(rawData.amount || rawData.price || 0),
        currency: rawData.currency || 'USD',
        billing_cycle: rawData.billing_cycle || rawData.billingCycle || 'monthly',
        next_billing_date: rawData.next_billing_date || rawData.nextBillingDate,
        start_date: rawData.start_date || rawData.startDate || new Date().toISOString(),
        end_date: rawData.end_date || rawData.endDate,
        auto_renew: Boolean(rawData.auto_renew !== false), // Default to true
        created_at: rawData.created_at || rawData.createdAt || new Date().toISOString(),
        updated_at: rawData.updated_at || rawData.updatedAt || new Date().toISOString()
      };

      // Validate and map
      const validation = SpotifyUtils.validateSubscriptionData(spotifyData);
      if (!validation.isValid) {
        throw new Error(`Spotify subscription data validation failed: ${validation.errors.join(', ')}`);
      }
      const mappedData = this.mapToInternalSubscription(spotifyData, userData);

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

      const transformedData: SpotifyBillingData[] = rawData.map(record => ({
        id: record.id || record.billing_id || `spotify_billing_${Date.now()}_${Math.random()}`,
        subscription_id: record.subscription_id || record.subscriptionId,
        amount: Number(record.amount || 0),
        currency: record.currency || 'USD',
        date: record.date || record.billing_date || new Date().toISOString(),
        description: record.description || record.memo || 'Spotify subscription payment',
        payment_method: record.payment_method || record.paymentMethod || 'credit_card',
        status: record.status || 'completed',
        created_at: record.created_at || record.createdAt || new Date().toISOString()
      }));

      // Validate all records
      transformedData.forEach((record, index) => {
        const validation = SpotifyUtils.validateBillingData(record);
        if (!validation.isValid) {
          throw new Error(`Billing record ${index + 1} validation failed: ${validation.errors.join(', ')}`);
        }
      });

      // Create subscription ID mapping (Spotify ID -> Internal ID)
      const subscriptionMap = new Map<string, string>();
      transformedData.forEach(record => {
        subscriptionMap.set(record.subscription_id, `spotify_${record.subscription_id}`);
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
   * Map Spotify user profile to internal format
   */
  static mapUserProfile(rawProfile: any): SpotifyUserData {
    return {
      id: rawProfile.id,
      email: rawProfile.email,
      display_name: rawProfile.display_name,
      country: rawProfile.country,
      product: rawProfile.product,
      images: rawProfile.images,
      followers: rawProfile.followers,
      external_urls: rawProfile.external_urls
    };
  }

  /**
   * Create subscription from Spotify user profile
   */
  static createSubscriptionFromProfile(
    profile: SpotifyUserData
  ): OAuthSubscription {
    const isPremium = SpotifyUtils.isPremium(profile.product);
    const amount = isPremium ? SpotifyUtils.getTierAmount(profile.product) : 0;

    return {
      id: `spotify_${profile.id}`,
      name: 'Spotify',
      category: 'Music Streaming',
      amount: amount,
      currency: 'USD',
      billingCycle: isPremium ? 'monthly' : 'none',
      nextBillingDate: isPremium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now for free tier
      paymentMethod: 'Credit Card', // Default for Spotify
      status: 'active',
      description: `${SpotifyUtils.mapTier(profile.product)} Plan`,
      autoRenew: isPremium,
      startDate: new Date(),
      endDate: undefined,
      logoUrl: this.SPOTIFY_LOGO_URL,
      externalId: profile.id,
      providerId: 'spotify',
      providerData: {
        product: profile.product,
        country: profile.country
      },
      user_id: profile.id,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get Spotify-specific field mappings for debugging
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
      'status': 'status',
      'product': 'plan_id'
    };
  }

  /**
   * Validate and normalize Spotify product type
   */
  static normalizeProductType(product: string): string {
    const normalized = product.toLowerCase();
    if (['premium', 'premium_family', 'premium_student', 'premium_duo'].includes(normalized)) {
      return normalized;
    }
    return 'free';
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
      free: {
        name: 'Free',
        amount: 0,
        currency: 'USD',
        features: ['Ad-supported', 'Limited skips', 'Shuffle play']
      },
      premium: {
        name: 'Premium',
        amount: 9.99,
        currency: 'USD',
        features: ['Ad-free', 'Unlimited skips', 'Offline listening', 'High quality audio']
      },
      premium_family: {
        name: 'Premium Family',
        amount: 14.99,
        currency: 'USD',
        features: ['All Premium features', 'Up to 6 accounts', 'Family sharing', 'Parental controls']
      },
      premium_student: {
        name: 'Premium Student',
        amount: 4.99,
        currency: 'USD',
        features: ['All Premium features', 'Student discount', 'High quality audio']
      },
      premium_duo: {
        name: 'Premium Duo',
        amount: 12.99,
        currency: 'USD',
        features: ['All Premium features', 'Two Premium accounts', 'Duo Mix playlist']
      }
    };

    return tierInfo[tier as keyof typeof tierInfo] || tierInfo.free;
  }
}