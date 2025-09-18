import React, { useState, useEffect } from 'react';
import type { Subscription } from '../types';

interface SubscriptionFormProps {
  onSave: (sub: Omit<Subscription, 'id'> | Subscription) => void;
  subToEdit?: Subscription;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({ onSave, subToEdit }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (subToEdit) {
      setName(subToEdit.name);
      setAmount(String(subToEdit.amount));
      setNextBillingDate(new Date(subToEdit.nextBillingDate).toISOString().split('T')[0]);
      setLogoUrl(subToEdit.logoUrl);
    }
  }, [subToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subData = {
      name,
      amount: parseFloat(amount),
      nextBillingDate: new Date(nextBillingDate),
      logoUrl: logoUrl || `https://logo.clearbit.com/${name.toLowerCase().replace(/\s/g, '')}.com` // Default logo
    };
    if (subToEdit) {
      onSave({ ...subToEdit, ...subData });
    } else {
      onSave(subData);
    }
  };
  
  const formTitle = subToEdit ? 'Edit Subscription' : 'Add New Subscription';
  const inputClasses = "form-input block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-4">{formTitle}</h2>
      
      <div>
        <label htmlFor="sub-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Service Name</label>
        <input type="text" id="sub-name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
      </div>

      <div>
        <label htmlFor="sub-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Amount (INR)</label>
        <input type="number" id="sub-amount" value={amount} onChange={e => setAmount(e.target.value)} required className={inputClasses} />
      </div>

      <div>
        <label htmlFor="sub-billingDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Next Billing Date</label>
        <input type="date" id="sub-billingDate" value={nextBillingDate} onChange={e => setNextBillingDate(e.target.value)} required className={inputClasses} />
      </div>
      
       <div>
        <label htmlFor="sub-logo" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL (Optional)</label>
        <input type="text" id="sub-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="e.g., https://logo.clearbit.com/netflix.com" className={inputClasses} />
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
