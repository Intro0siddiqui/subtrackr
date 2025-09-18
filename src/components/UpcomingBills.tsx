import React from 'react';
import type { Bill } from '../types';
import { BillCategory } from '../types';

interface UpcomingBillsProps {
    bills: Bill[];
    formatCurrency: (amount: number) => string;
    onEdit: (bill: Bill) => void;
    onDelete: (id: string) => void;
    onPay: (bill: Bill) => void;
}

const getDaysUntilDue = (dueDate: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

const DueDateIndicator: React.FC<{ dueDate: Date, status: Bill['status'] }> = ({ dueDate, status }) => {
    if (status === 'paid') {
      return <span className="text-xs font-semibold text-green-500">Paid</span>;
    }
    const daysLeft = getDaysUntilDue(dueDate);
    let colorClass = 'text-green-400';
    let text = `Due in ${daysLeft} days`;

    if (daysLeft < 0) {
        colorClass = 'text-red-500';
        text = `Overdue by ${Math.abs(daysLeft)} days`;
    } else if (daysLeft === 0) {
        colorClass = 'text-red-500';
        text = 'Due today';
    } else if (daysLeft <= 5) {
        colorClass = 'text-yellow-500';
    }

    return <span className={`text-sm ${colorClass}`}>{text}</span>;
};


const CategoryIcon: React.FC<{ category: BillCategory }> = ({ category }) => {
    const iconMap: Record<BillCategory, React.ReactNode> = {
        [BillCategory.UTILITY]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        [BillCategory.INTERNET]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h10a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.938 6.128a9 9 0 018.124 0M12 20.25a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z" /></svg>,
        [BillCategory.PHONE]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
        [BillCategory.CREDIT_CARD]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        [BillCategory.ENTERTAINMENT]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        [BillCategory.INSURANCE]: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    };
    return <div className="flex items-center justify-center rounded-lg bg-subtle-light dark:bg-subtle-dark size-12 shrink-0 text-muted-light dark:text-muted-dark">{iconMap[category]}</div>;
};

const UpcomingBills: React.FC<UpcomingBillsProps> = ({ bills, formatCurrency, onEdit, onDelete, onPay }) => {
    const sortedBills = [...bills].sort((a, b) => {
        if (a.status === b.status) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return a.status === 'paid' ? 1 : -1;
    });

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm overflow-hidden">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white p-4 border-b border-subtle-light dark:border-subtle-dark">Upcoming Bills</h3>
            <ul className="divide-y divide-subtle-light dark:divide-subtle-dark">
                {sortedBills.map(bill => (
                    <li key={bill.id} className={`flex items-center justify-between p-4 transition-colors ${bill.status === 'paid' ? 'opacity-60' : 'hover:bg-background-light dark:hover:bg-background-dark'}`}>
                        <div className="flex items-center gap-4">
                           <CategoryIcon category={bill.category} />
                            <div>
                                <p className={`font-semibold text-gray-900 dark:text-white ${bill.status === 'paid' ? 'line-through' : ''}`}>{bill.name}</p>
                                <p className="text-sm text-muted-light dark:text-muted-dark">{bill.category}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <DueDateIndicator dueDate={bill.dueDate} status={bill.status} />
                            <p className={`font-semibold text-gray-900 dark:text-white w-24 text-right ${bill.status === 'paid' ? 'line-through' : ''}`}>{formatCurrency(bill.amount)}</p>
                            <div className="flex items-center space-x-1">
                               {bill.status !== 'paid' && <button onClick={() => onPay({ ...bill, status: 'paid' })} className="px-3 py-1 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">Pay</button>}
                                <button onClick={() => onEdit(bill)} className="p-2 text-muted-light dark:text-muted-dark hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg></button>
                                <button onClick={() => onDelete(bill.id)} className="p-2 text-muted-light dark:text-muted-dark hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                            </div>
                        </div>
                    </li>
                ))}
                 {sortedBills.length === 0 && (
                    <li className="p-4 text-center text-muted-light dark:text-muted-dark">No bills added yet.</li>
                )}
            </ul>
        </div>
    );
};

export default UpcomingBills;
