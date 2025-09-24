import React, { useState, useEffect } from 'react';
import type { Subscription } from '../types';
import { SubscriptionCategory, BillingCycle, PaymentMethod, SubscriptionStatus } from '../types';
import { SUBSCRIPTION_CATEGORIES, getCategoryDisplayName } from '../services/categories';

interface SubscriptionFormProps {
  onSave: (sub: Omit<Subscription, 'id'> | Subscription) => void;
  subToEdit?: Subscription;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ onSave, subToEdit }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [category, setCategory] = useState<SubscriptionCategory>(SubscriptionCategory.OTHER);
  const [status, setStatus] = useState<SubscriptionStatus>(SubscriptionStatus.ACTIVE);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);

  useEffect(() => {
    if (subToEdit) {
      setName(subToEdit.name);
      setAmount(String(subToEdit.amount));
      setCurrency(subToEdit.currency);
      setCategory(subToEdit.category);
      setStatus(subToEdit.status);
      setBillingCycle(subToEdit.billingCycle);
      setPaymentMethod(subToEdit.paymentMethod);
      setStartDate(new Date(subToEdit.startDate).toISOString().split('T')[0]);
      setEndDate(subToEdit.endDate ? new Date(subToEdit.endDate).toISOString().split('T')[0] : '');
      setNextBillingDate(new Date(subToEdit.nextBillingDate).toISOString().split('T')[0]);
      setLogoUrl(subToEdit.logoUrl);
      setDescription(subToEdit.description || '');
      setAutoRenew(subToEdit.autoRenew);
    } else {
      // Set default start date to today
      setStartDate(new Date().toISOString().split('T')[0]);
    }
  }, [subToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const subData = {
      name,
      amount: parseFloat(amount),
      currency,
      category,
      status,
      billingCycle,
      paymentMethod,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      nextBillingDate: new Date(nextBillingDate),
      logoUrl: logoUrl || `https://logo.clearbit.com/${name.toLowerCase().replace(/\s/g, '')}.com`,
      description,
      autoRenew,
      createdAt: subToEdit?.createdAt || now,
      updatedAt: now
    };
    if (subToEdit) {
      onSave({ ...subToEdit, ...subData });
    } else {
      onSave(subData);
    }
  };
  
  const formTitle = subToEdit ? 'Edit Subscription' : 'Add New Subscription';
  const inputClasses = "form-input block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary";
  const selectClasses = "form-select block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
        <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-4">{formTitle}</h2>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Basic Information</h3>

        <div>
          <label htmlFor="sub-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Name *</label>
          <input type="text" id="sub-name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
        </div>

        <div>
          <label htmlFor="sub-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <textarea id="sub-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputClasses} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sub-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount *</label>
            <input type="number" id="sub-amount" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0" required className={inputClasses} />
          </div>
          <div>
            <label htmlFor="sub-currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label>
            <select id="sub-currency" value={currency} onChange={e => setCurrency(e.target.value)} className={selectClasses}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category and Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Category & Status</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sub-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category *</label>
            <select id="sub-category" value={category} onChange={e => setCategory(e.target.value as SubscriptionCategory)} required className={selectClasses}>
              {SUBSCRIPTION_CATEGORIES.map(cat => (
                <option key={cat.category} value={cat.category}>
                  {cat.icon} {cat.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sub-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
            <select id="sub-status" value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)} className={selectClasses}>
              <option value={SubscriptionStatus.ACTIVE}>Active</option>
              <option value={SubscriptionStatus.TRIAL}>Trial</option>
              <option value={SubscriptionStatus.PAUSED}>Paused</option>
              <option value={SubscriptionStatus.CANCELLED}>Cancelled</option>
              <option value={SubscriptionStatus.EXPIRED}>Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Billing Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sub-billingCycle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Billing Cycle *</label>
            <select id="sub-billingCycle" value={billingCycle} onChange={e => setBillingCycle(e.target.value as BillingCycle)} required className={selectClasses}>
              <option value={BillingCycle.MONTHLY}>Monthly</option>
              <option value={BillingCycle.YEARLY}>Yearly</option>
              <option value={BillingCycle.QUARTERLY}>Quarterly</option>
              <option value={BillingCycle.WEEKLY}>Weekly</option>
              <option value={BillingCycle.CUSTOM}>Custom</option>
            </select>
          </div>
          <div>
            <label htmlFor="sub-paymentMethod" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
            <select id="sub-paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className={selectClasses}>
              <option value={PaymentMethod.UPI}>UPI</option>
              <option value={PaymentMethod.CREDIT_CARD}>Credit Card</option>
              <option value={PaymentMethod.DEBIT_CARD}>Debit Card</option>
              <option value={PaymentMethod.NET_BANKING}>Net Banking</option>
              <option value={PaymentMethod.WALLET}>Wallet</option>
              <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
              <option value={PaymentMethod.CRYPTO}>Cryptocurrency</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sub-startDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
            <input type="date" id="sub-startDate" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inputClasses} />
          </div>
          <div>
            <label htmlFor="sub-endDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date (Optional)</label>
            <input type="date" id="sub-endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div>
          <label htmlFor="sub-nextBillingDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Next Billing Date *</label>
          <input type="date" id="sub-nextBillingDate" value={nextBillingDate} onChange={e => setNextBillingDate(e.target.value)} required className={inputClasses} />
        </div>

        <div className="flex items-center">
          <input type="checkbox" id="sub-autoRenew" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} className="rounded border-slate-300 text-primary focus:ring-primary" />
          <label htmlFor="sub-autoRenew" className="ml-2 text-sm text-slate-700 dark:text-slate-300">Auto-renewal enabled</label>
        </div>
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Additional Information</h3>

        <div>
          <label htmlFor="sub-logo" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL (Optional)</label>
          <input type="text" id="sub-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="e.g., https://logo.clearbit.com/netflix.com" className={inputClasses} />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button type="submit" className="flex justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark">
          Save Subscription
        </button>
      </div>
    </form>
  );
};

export default SubscriptionForm;
