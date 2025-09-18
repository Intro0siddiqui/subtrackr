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
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-subtle-light dark:divide-subtle-dark">
            {subscriptions.map(sub => (
            <li key={sub.id} className="flex items-center justify-between p-4 hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                <div className="flex items-center gap-4">
                    <img src={sub.logoUrl} alt={`${sub.name} logo`} className="flex items-center justify-center rounded-lg bg-subtle-light dark:bg-subtle-dark size-12 shrink-0 object-contain p-1" />
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{sub.name}</p>
                        <p className="text-sm text-muted-light dark:text-muted-dark">
                            Next bill: {new Date(sub.nextBillingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sub.amount)}</p>
                     <div className="flex items-center space-x-1 ml-2">
                        <button onClick={() => onEdit(sub)} className="p-2 text-muted-light dark:text-muted-dark hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => onDelete(sub.id)} className="p-2 text-muted-light dark:text-muted-dark hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                    </div>
                </div>
            </li>
            ))}
             {subscriptions.length === 0 && (
                <li className="p-4 text-center text-muted-light dark:text-muted-dark">No subscriptions added yet.</li>
            )}
        </ul>
    </div>
  );
};

export default SubscriptionsList;
