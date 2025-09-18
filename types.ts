
export enum BillCategory {
  UTILITY = 'Utility',
  ENTERTAINMENT = 'Entertainment',
  PHONE = 'Phone',
  INTERNET = 'Internet',
  INSURANCE = 'Insurance',
  CREDIT_CARD = 'Credit Card',
}

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

export interface Subscription {
  id: string;
  user_id?: string;
  name: string;
  amount: number;
  nextBillingDate: Date;
  logoUrl: string;
}