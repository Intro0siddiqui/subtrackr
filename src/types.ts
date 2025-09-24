// Subscription Categories
export enum SubscriptionCategory {
  STREAMING = 'Streaming',
  PRODUCTIVITY = 'Productivity',
  CLOUD_STORAGE = 'Cloud Storage',
  MUSIC = 'Music',
  GAMING = 'Gaming',
  FITNESS = 'Fitness',
  EDUCATION = 'Education',
  SECURITY = 'Security',
  DEVELOPMENT = 'Development',
  DESIGN = 'Design',
  MARKETING = 'Marketing',
  COMMUNICATION = 'Communication',
  ENTERTAINMENT = 'Entertainment',
  LIFESTYLE = 'Lifestyle',
  UTILITIES = 'Utilities',
  OTHER = 'Other'
}

// Subscription Status Types
export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  TRIAL = 'trial'
}

// Billing Cycle Types
export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  QUARTERLY = 'quarterly',
  WEEKLY = 'weekly',
  CUSTOM = 'custom'
}

// Payment Method Types
export enum PaymentMethod {
  UPI = 'UPI',
  CREDIT_CARD = 'Credit Card',
  DEBIT_CARD = 'Debit Card',
  NET_BANKING = 'Net Banking',
  WALLET = 'Wallet',
  BANK_TRANSFER = 'Bank Transfer',
  CRYPTO = 'Cryptocurrency'
}

// Bill Category Types
export enum BillCategory {
  UTILITY = 'Utility',
  INTERNET = 'Internet',
  PHONE = 'Phone',
  CREDIT_CARD = 'Credit Card',
  ENTERTAINMENT = 'Entertainment',
  INSURANCE = 'Insurance'
}

// Enhanced Bill Interface
export interface Bill {
  id: string;
  user_id?: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: BillCategory;
  history: number[];
  status: 'unpaid' | 'paid';
}

// Enhanced Subscription Interface
export interface Subscription {
  id: string;
  user_id?: string;
  name: string;
  amount: number;
  currency: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
  startDate: Date;
  endDate?: Date;
  nextBillingDate: Date;
  logoUrl: string;
  description?: string;
  providerId?: string;
  autoRenew: boolean;
  trialEndDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription Lifecycle Event
export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  user_id?: string;
  eventType: 'created' | 'updated' | 'cancelled' | 'renewed' | 'paused' | 'resumed' | 'expired';
  eventDate: Date;
  previousStatus?: SubscriptionStatus;
  newStatus: SubscriptionStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Transaction Record
export interface Transaction {
  id: string;
  subscriptionId: string;
  user_id?: string;
  amount: number;
  currency: string;
  transactionDate: Date;
  paymentMethod: PaymentMethod;
  transactionId: string;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  provider: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Payment Provider Connection
export interface PaymentConnection {
  id: string;
  user_id?: string;
  provider: string;
  name: string;
  encryptedCredentials: string;
  isActive: boolean;
  lastSyncDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Category Configuration
export interface CategoryConfig {
  category: SubscriptionCategory;
  displayName: string;
  icon: string;
  color: string;
  description: string;
}

// Payment Provider Configuration
export interface PaymentProvider {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  supportedMethods: PaymentMethod[];
  authUrl: string;
  apiBaseUrl: string;
  features: {
    transactionHistory: boolean;
    subscriptionManagement: boolean;
    autoSync: boolean;
  };
}
