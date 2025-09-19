import React, { useState } from 'react';
import type { Bill, Subscription } from '../types';
import UpcomingBills from './UpcomingBills';
import SubscriptionsList from './SubscriptionsList';
import Modal from './Modal';
import BillForm from './BillForm';
import SubscriptionForm from './SubscriptionForm';
import type { User } from '@supabase/supabase-js';
import BillPrediction from './BillPrediction';

interface DashboardProps {
  user: User;
  bills: Bill[];
  subscriptions: Subscription[];
  onSaveBill: (bill: Omit<Bill, 'id'> | Bill) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onSaveSubscription: (sub: Omit<Subscription, 'id'> | Subscription) => Promise<void>;
  onDeleteSubscription: (id: string) => Promise<void>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getNextDueBill = (bills: Bill[]) => {
    return [...bills]
        .filter(b => b.status === 'unpaid')
        .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
}

const getDaysUntilDue = (dueDate?: Date) => {
    if(!dueDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};


const Dashboard: React.FC<DashboardProps> = ({ bills, subscriptions, onSaveBill, onDeleteBill, onSaveSubscription, onDeleteSubscription }) => {
  const [isBillModalOpen, setBillModalOpen] = useState(false);
  const [isSubModalOpen, setSubModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | undefined>(undefined);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill);
    setBillModalOpen(true);
  };
  
  const handleEditSub = (sub: Subscription) => {
    setEditingSub(sub);
    setSubModalOpen(true);
  };
  
  const closeModal = () => {
    setBillModalOpen(false);
    setSubModalOpen(false);
    setEditingBill(undefined);
    setEditingSub(undefined);
  }
  
  const nextDueBill = getNextDueBill(bills);
  const daysUntilNextDue = getDaysUntilDue(nextDueBill?.dueDate);


  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Dashboard</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-1 bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Upcoming Payment</h3>
            {nextDueBill ? (
                <>
                    <p className="text-2xl font-extrabold text-primary mb-2">{formatCurrency(nextDueBill.amount)}</p>
                    <p className="text-sm text-muted-light dark:text-muted-dark">
                        {daysUntilNextDue !== null && daysUntilNextDue > 0 ? `Due in ${daysUntilNextDue} days` : (daysUntilNextDue === 0 ? 'Due today' : `Overdue`)}
                    </p>
                </>
            ) : (
                <>
                    <p className="text-2xl font-extrabold text-primary mb-2">-</p>
                    <p className="text-sm text-muted-light dark:text-muted-dark">No upcoming bills</p>
                </>
            )}
            
          </div>
          <div className="md:col-span-2 bg-center bg-no-repeat bg-cover rounded-xl min-h-[120px]" style={{backgroundImage: 'url("https://images.unsplash.com/photo-1620714223084-86c9df2a88fb?q=80&w=2940&auto=format&fit=crop")'}}></div>
        </div>

        <div className="mb-8">
            <UpcomingBills bills={bills} formatCurrency={formatCurrency} onEdit={handleEditBill} onDelete={onDeleteBill} onPay={onSaveBill}/>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Active Subscriptions</h3>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSubModalOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">Add Subscription</button>
                        <button onClick={() => setBillModalOpen(true)} className="px-4 py-2 text-sm font-bold text-gray-900 dark:text-white bg-subtle-light dark:bg-subtle-dark rounded-lg hover:bg-subtle-light/80 dark:hover:bg-subtle-dark/80 transition-colors">Add Bill</button>
                    </div>
                </div>
                <SubscriptionsList subscriptions={subscriptions} formatCurrency={formatCurrency} onEdit={handleEditSub} onDelete={onDeleteSubscription} />
            </div>
            <div className="lg:col-span-1">
                <BillPrediction bills={bills} formatCurrency={formatCurrency} />
            </div>
        </div>
      </div>
      
      <Modal isOpen={isBillModalOpen} onClose={closeModal}>
        <BillForm
            onSave={(billData) => {
                onSaveBill(billData).then(closeModal);
            }}
            billToEdit={editingBill}
        />
      </Modal>

      <Modal isOpen={isSubModalOpen} onClose={closeModal}>
        <SubscriptionForm
            onSave={(subData) => {
                onSaveSubscription(subData).then(closeModal);
            }}
            subToEdit={editingSub}
        />
      </Modal>
    </>
  );
};

export default Dashboard;
