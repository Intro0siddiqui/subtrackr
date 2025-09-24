import type { Subscription, SubscriptionCategory } from '../types';
import { SubscriptionStatus, BillingCycle, PaymentMethod } from '../types';

export interface FilterOptions {
  category?: SubscriptionCategory | 'all';
  status?: SubscriptionStatus | 'all';
  billingCycle?: BillingCycle | 'all';
  paymentMethod?: PaymentMethod | 'all';
  searchQuery?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'name' | 'amount' | 'nextBillingDate' | 'category' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterResult {
  filtered: Subscription[];
  total: number;
  categories: { category: SubscriptionCategory; count: number; totalAmount: number }[];
  totalAmount: number;
}

export class SubscriptionFilterService {
  private static instance: SubscriptionFilterService;

  static getInstance(): SubscriptionFilterService {
    if (!SubscriptionFilterService.instance) {
      SubscriptionFilterService.instance = new SubscriptionFilterService();
    }
    return SubscriptionFilterService.instance;
  }

  /**
   * Filter subscriptions based on provided options
   */
  filterSubscriptions(subscriptions: Subscription[], options: FilterOptions): FilterResult {
    let filtered = [...subscriptions];

    // Apply category filter
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(sub => sub.category === options.category);
    }

    // Apply status filter
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter(sub => sub.status === options.status);
    }

    // Apply billing cycle filter
    if (options.billingCycle && options.billingCycle !== 'all') {
      filtered = filtered.filter(sub => sub.billingCycle === options.billingCycle);
    }

    // Apply payment method filter
    if (options.paymentMethod && options.paymentMethod !== 'all') {
      filtered = filtered.filter(sub => sub.paymentMethod === options.paymentMethod);
    }

    // Apply amount range filter
    if (options.minAmount !== undefined) {
      filtered = filtered.filter(sub => sub.amount >= options.minAmount!);
    }
    if (options.maxAmount !== undefined) {
      filtered = filtered.filter(sub => sub.amount <= options.maxAmount!);
    }

    // Apply search query filter
    if (options.searchQuery && options.searchQuery.trim()) {
      const query = options.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(sub =>
        sub.name.toLowerCase().includes(query) ||
        sub.description?.toLowerCase().includes(query) ||
        sub.category.toLowerCase().includes(query) ||
        sub.paymentMethod.toLowerCase().includes(query)
      );
    }

    // Sort results
    filtered = this.sortSubscriptions(filtered, options.sortBy || 'nextBillingDate', options.sortOrder || 'asc');

    // Calculate category statistics
    const categories = this.calculateCategoryStats(filtered);

    // Calculate total amount
    const totalAmount = filtered.reduce((sum, sub) => sum + sub.amount, 0);

    return {
      filtered,
      total: filtered.length,
      categories,
      totalAmount
    };
  }

  /**
   * Get filter suggestions based on subscriptions
   */
  getFilterSuggestions(subscriptions: Subscription[]): {
    categories: SubscriptionCategory[];
    statuses: SubscriptionStatus[];
    billingCycles: BillingCycle[];
    paymentMethods: PaymentMethod[];
    amountRange: { min: number; max: number };
  } {
    const categories = [...new Set(subscriptions.map(sub => sub.category))];
    const statuses = [...new Set(subscriptions.map(sub => sub.status))];
    const billingCycles = [...new Set(subscriptions.map(sub => sub.billingCycle))];
    const paymentMethods = [...new Set(subscriptions.map(sub => sub.paymentMethod))];

    const amounts = subscriptions.map(sub => sub.amount);
    const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

    return {
      categories,
      statuses,
      billingCycles,
      paymentMethods,
      amountRange: { min: minAmount, max: maxAmount }
    };
  }

  /**
   * Get popular categories based on subscription count
   */
  getPopularCategories(subscriptions: Subscription[], limit: number = 5): { category: SubscriptionCategory; count: number; percentage: number }[] {
    const categoryCounts = subscriptions.reduce((acc, sub) => {
      acc[sub.category] = (acc[sub.category] || 0) + 1;
      return acc;
    }, {} as Record<SubscriptionCategory, number>);

    const total = subscriptions.length;
    const popular = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category: category as SubscriptionCategory,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return popular;
  }

  /**
   * Get spending analysis by category
   */
  getSpendingByCategory(subscriptions: Subscription[]): { category: SubscriptionCategory; total: number; count: number; average: number }[] {
    const categorySpending = subscriptions.reduce((acc, sub) => {
      if (!acc[sub.category]) {
        acc[sub.category] = { total: 0, count: 0 };
      }
      acc[sub.category].total += sub.amount;
      acc[sub.category].count += 1;
      return acc;
    }, {} as Record<SubscriptionCategory, { total: number; count: number }>);

    return Object.entries(categorySpending)
      .map(([category, data]) => ({
        category: category as SubscriptionCategory,
        total: data.total,
        count: data.count,
        average: data.count > 0 ? Math.round(data.total / data.count * 100) / 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get upcoming renewals within specified days
   */
  getUpcomingRenewals(subscriptions: Subscription[], days: number = 7): Subscription[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return subscriptions
      .filter(sub => sub.nextBillingDate >= now && sub.nextBillingDate <= futureDate)
      .sort((a, b) => a.nextBillingDate.getTime() - b.nextBillingDate.getTime());
  }

  /**
   * Get subscriptions expiring soon
   */
  getExpiringSoon(subscriptions: Subscription[], days: number = 30): Subscription[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return subscriptions
      .filter(sub => sub.endDate && sub.endDate >= now && sub.endDate <= futureDate)
      .sort((a, b) => (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0));
  }

  /**
   * Get subscription statistics
   */
  getStatistics(subscriptions: Subscription[]): {
    total: number;
    active: number;
    monthlyCost: number;
    yearlyCost: number;
    averageCost: number;
    byStatus: Record<SubscriptionStatus, number>;
    byCategory: Record<SubscriptionCategory, number>;
  } {
    const total = subscriptions.length;
    const active = subscriptions.filter(sub => sub.status === SubscriptionStatus.ACTIVE).length;

    const monthlyCost = subscriptions
      .filter(sub => sub.billingCycle === BillingCycle.MONTHLY)
      .reduce((sum, sub) => sum + sub.amount, 0);

    const yearlyCost = subscriptions
      .filter(sub => sub.billingCycle === BillingCycle.YEARLY)
      .reduce((sum, sub) => sum + sub.amount, 0);

    const totalCost = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
    const averageCost = total > 0 ? Math.round((totalCost / total) * 100) / 100 : 0;

    const byStatus = subscriptions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<SubscriptionStatus, number>);

    const byCategory = subscriptions.reduce((acc, sub) => {
      acc[sub.category] = (acc[sub.category] || 0) + 1;
      return acc;
    }, {} as Record<SubscriptionCategory, number>);

    return {
      total,
      active,
      monthlyCost,
      yearlyCost,
      averageCost,
      byStatus,
      byCategory
    };
  }

  /**
   * Sort subscriptions
   */
  private sortSubscriptions(
    subscriptions: Subscription[],
    sortBy: FilterOptions['sortBy'],
    sortOrder: 'asc' | 'desc'
  ): Subscription[] {
    return [...subscriptions].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'nextBillingDate':
          aValue = a.nextBillingDate.getTime();
          bValue = b.nextBillingDate.getTime();
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.nextBillingDate.getTime();
          bValue = b.nextBillingDate.getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Calculate category statistics
   */
  private calculateCategoryStats(subscriptions: Subscription[]): { category: SubscriptionCategory; count: number; totalAmount: number }[] {
    const categoryStats = subscriptions.reduce((acc, sub) => {
      if (!acc[sub.category]) {
        acc[sub.category] = { count: 0, totalAmount: 0 };
      }
      acc[sub.category].count += 1;
      acc[sub.category].totalAmount += sub.amount;
      return acc;
    }, {} as Record<SubscriptionCategory, { count: number; totalAmount: number }>);

    return Object.entries(categoryStats).map(([category, stats]) => ({
      category: category as SubscriptionCategory,
      count: stats.count,
      totalAmount: Math.round(stats.totalAmount * 100) / 100
    }));
  }
}

export const subscriptionFilterService = SubscriptionFilterService.getInstance();