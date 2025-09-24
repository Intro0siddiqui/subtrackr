import React from 'react';
import type { Subscription } from '../types';
import { SubscriptionStatus } from '../types';
import { getCategoryConfig } from '../services/categories';

interface SubscriptionsListProps {
  subscriptions: Subscription[];
  formatCurrency: (amount: number) => string;
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
}

const SubscriptionsList: React.FC<SubscriptionsListProps> = ({ subscriptions, formatCurrency, onEdit, onDelete }) => {
  const getStatusColor = (status: SubscriptionStatus): string => {
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case SubscriptionStatus.TRIAL:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case SubscriptionStatus.PAUSED:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case SubscriptionStatus.CANCELLED:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case SubscriptionStatus.EXPIRED:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusText = (status: SubscriptionStatus): string => {
    switch (status) {
      case SubscriptionStatus.ACTIVE:
        return 'Active';
      case SubscriptionStatus.TRIAL:
        return 'Trial';
      case SubscriptionStatus.PAUSED:
        return 'Paused';
      case SubscriptionStatus.CANCELLED:
        return 'Cancelled';
      case SubscriptionStatus.EXPIRED:
        return 'Expired';
      default:
        return status;
    }
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-subtle-light dark:divide-subtle-dark">
            {subscriptions.map(sub => {
              const categoryConfig = getCategoryConfig(sub.category);
              return (
                <li key={sub.id} className="p-4 hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex items-center justify-center rounded-lg bg-subtle-light dark:bg-subtle-dark size-12 shrink-0">
                        {categoryConfig ? (
                          <span className="text-2xl">{categoryConfig.icon}</span>
                        ) : (
                          <img src={sub.logoUrl} alt={`${sub.name} logo`} className="object-contain p-1 size-10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{sub.name}</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                            {getStatusText(sub.status)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-light dark:text-muted-dark mb-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryConfig?.color || '#95A5A6' }}></span>
                            {categoryConfig?.displayName || sub.category}
                          </span>
                          <span>•</span>
                          <span>{sub.billingCycle}</span>
                          <span>•</span>
                          <span>{sub.paymentMethod}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-light dark:text-muted-dark">
                            Next bill: {new Date(sub.nextBillingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          {sub.endDate && (
                            <>
                              <span>•</span>
                              <span className="text-muted-light dark:text-muted-dark">
                                Ends: {new Date(sub.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </>
                          )}
                        </div>

                        {sub.description && (
                          <p className="text-sm text-muted-light dark:text-muted-dark mt-1 truncate">
                            {sub.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(sub.amount)}</p>
                        <p className="text-xs text-muted-light dark:text-muted-dark">{sub.currency}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button onClick={() => onEdit(sub)} className="p-2 text-muted-light dark:text-muted-dark hover:text-primary" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button onClick={() => onDelete(sub.id)} className="p-2 text-muted-light dark:text-muted-dark hover:text-red-500" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
             {subscriptions.length === 0 && (
                 <li className="p-8 text-center text-muted-light dark:text-muted-dark">
                   <div className="mb-2">
                     <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                     </svg>
                   </div>
                   <p className="text-lg font-medium">No subscriptions added yet</p>
                   <p className="text-sm">Add your first subscription to start tracking your expenses.</p>
                 </li>
             )}
        </ul>
    </div>
  );
};

export default SubscriptionsList;
