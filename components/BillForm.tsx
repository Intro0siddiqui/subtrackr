
import React, { useState, useEffect } from 'react';
import type { Bill } from '../types';
import { BillCategory } from '../types';

interface BillFormProps {
  onSave: (bill: Omit<Bill, 'id'> | Bill) => void;
  billToEdit?: Bill;
}

const BillForm: React.FC<BillFormProps> = ({ onSave, billToEdit }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<BillCategory>(BillCategory.UTILITY);

  useEffect(() => {
    if (billToEdit) {
      setName(billToEdit.name);
      setAmount(String(billToEdit.amount));
      setDueDate(new Date(billToEdit.dueDate).toISOString().split('T')[0]);
      setCategory(billToEdit.category);
    }
  }, [billToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const billData = {
      name,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      category,
      history: billToEdit?.history || [parseFloat(amount)] // Simple history for new bills
    };

    if (billToEdit) {
      onSave({ ...billToEdit, ...billData });
    } else {
      // FIX: Added 'status' property for new bills to satisfy the `onSave` prop type.
      onSave({ ...billData, status: 'unpaid' });
    }
  };

  const formTitle = billToEdit ? 'Edit Bill' : 'Add New Bill';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 id="modal-title" className="text-xl font-bold text-brand-text mb-4">{formTitle}</h2>
      
      <div>
        <label htmlFor="bill-name" className="block text-sm font-medium text-brand-subtle mb-1">Bill Name</label>
        <input type="text" id="bill-name" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div>
        <label htmlFor="bill-amount" className="block text-sm font-medium text-brand-subtle mb-1">Amount (INR)</label>
        <input type="number" id="bill-amount" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div>
        <label htmlFor="bill-dueDate" className="block text-sm font-medium text-brand-subtle mb-1">Due Date</label>
        <input type="date" id="bill-dueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent" />
      </div>

      <div>
        <label htmlFor="bill-category" className="block text-sm font-medium text-brand-subtle mb-1">Category</label>
        <select id="bill-category" value={category} onChange={e => setCategory(e.target.value as BillCategory)} className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent">
          {Object.values(BillCategory).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="pt-4 flex justify-end">
        <button type="submit" className="px-6 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent">
          Save Bill
        </button>
      </div>
    </form>
  );
};

export default BillForm;