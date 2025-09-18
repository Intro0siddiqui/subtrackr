
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <h2 id="modal-title" className="text-xl font-bold text-brand-text mb-4">{formTitle}</h2>
      
      <div>
        <label htmlFor="sub-name" className="block text-sm font-medium text-brand-subtle mb-1">Service Name</label>
        <input type="text" id="sub-name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div>
        <label htmlFor="sub-amount" className="block text-sm font-medium text-brand-subtle mb-1">Monthly Amount (INR)</label>
        <input type="number" id="sub-amount" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div>
        <label htmlFor="sub-billingDate" className="block text-sm font-medium text-brand-subtle mb-1">Next Billing Date</label>
        <input type="date" id="sub-billingDate" value={nextBillingDate} onChange={e => setNextBillingDate(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>
      
       <div>
        <label htmlFor="sub-logo" className="block text-sm font-medium text-brand-subtle mb-1">Logo URL (Optional)</label>
        <input type="text" id="sub-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="e.g., https://img.icons8.com/color/48/netflix.png" className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div className="pt-4 flex justify-end">
        <button type="submit" className="px-6 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent">
          Save Subscription
        </button>
      </div>
    </form>
  );
};

export default SubscriptionForm;
