
import React from 'react';
import type { Subscription } from '../types';

interface SubscriptionsListProps {
  subscriptions: Subscription[];
  formatCurrency: (amount: number) => string;
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
}

const SubscriptionsList: React.FC<SubscriptionsListProps> = ({ subscriptions, formatCurrency, onEdit, onDelete }) => {
  return (
    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-brand-text mb-4">Active Subscriptions</h2>
      <ul className="space-y-3">
        {subscriptions.map(sub => (
          <li key={sub.id} className="flex items-center p-3 bg-brand-primary/50 rounded-lg">
            <img src={sub.logoUrl} alt={`${sub.name} logo`} className="w-10 h-10 mr-4 rounded-md" />
            <div className="flex-1">
              <p className="font-semibold text-brand-text">{sub.name}</p>
              <p className="text-sm text-brand-subtle">
                Next bill: {sub.nextBillingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className="text-right">
                <p className="font-bold text-brand-text">{formatCurrency(sub.amount)}</p>
                <p className="text-xs text-brand-subtle">/month</p>
            </div>
            <div className="flex items-center space-x-1 ml-2">
                 <button onClick={() => onEdit(sub)} className="p-2 text-brand-subtle hover:text-brand-text"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                 <button onClick={() => onDelete(sub.id)} className="p-2 text-brand-subtle hover:text-brand-danger"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SubscriptionsList;
