import React, { useState } from 'react';
import type { Bill, Subscription } from '../types';
import SummaryCard from './SummaryCard';
import UpcomingBills from './UpcomingBills';
import SubscriptionsList from './SubscriptionsList';
import BillPrediction from './BillPrediction';
import Modal from './Modal';
import BillForm from './BillForm';
import SubscriptionForm from './SubscriptionForm';
import type { User } from '@supabase/supabase-js';


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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ... (Icons remain the same)
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const WalletIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
);

const RepeatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" />
    </svg>
);


const Dashboard: React.FC<DashboardProps> = ({ user, bills, subscriptions, onSaveBill, onDeleteBill, onSaveSubscription, onDeleteSubscription }) => {
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

  const totalDue = bills.filter(b => b.status === 'unpaid').reduce((sum, bill) => sum + bill.amount, 0);
  const totalSubscriptions = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Welcome Back, {user.email}!</h1>
          <p className="text-brand-subtle">Here's your financial overview for the month.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SummaryCard title="Total Due This Month" value={formatCurrency(totalDue)} icon={<CalendarIcon />} colorClass="bg-blue-500" />
          <SummaryCard title="Monthly Subscriptions" value={formatCurrency(totalSubscriptions)} icon={<RepeatIcon />} colorClass="bg-purple-500" />
          <SummaryCard title="Total Spending" value={formatCurrency(totalDue + totalSubscriptions)} icon={<WalletIcon />} colorClass="bg-green-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <UpcomingBills bills={bills} formatCurrency={formatCurrency} onEdit={handleEditBill} onDelete={onDeleteBill} onPay={onSaveBill}/>
            <SubscriptionsList subscriptions={subscriptions} formatCurrency={formatCurrency} onEdit={handleEditSub} onDelete={onDeleteSubscription} />
          </div>
          <div className="lg:col-span-1">
            <BillPrediction bills={bills} formatCurrency={formatCurrency} />
             <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button onClick={() => setBillModalOpen(true)} className="flex-1 w-full text-center px-4 py-3 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent">
                    Add New Bill
                </button>
                <button onClick={() => setSubModalOpen(true)} className="flex-1 w-full text-center px-4 py-3 bg-brand-secondary text-brand-text font-semibold rounded-lg hover:bg-brand-border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent">
                    Add Subscription
                </button>
            </div>
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