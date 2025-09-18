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
      onSave({ ...billData, status: 'unpaid' });
    }
  };

  const formTitle = billToEdit ? 'Edit Bill' : 'Add New Bill';
  const inputClasses = "form-input block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-4">{formTitle}</h2>
      
      <div>
        <label htmlFor="bill-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bill Name</label>
        <input type="text" id="bill-name" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
      </div>

      <div>
        <label htmlFor="bill-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (INR)</label>
        <input type="number" id="bill-amount" value={amount} onChange={e => setAmount(e.target.value)} required className={inputClasses} />
      </div>

      <div>
        <label htmlFor="bill-dueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
        <input type="date" id="bill-dueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} required className={inputClasses} />
      </div>

      <div>
        <label htmlFor="bill-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
        <select id="bill-category" value={category} onChange={e => setCategory(e.target.value as BillCategory)} className={inputClasses.replace('form-input', 'form-select')}>
          {Object.values(BillCategory).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="pt-4 flex justify-end">
        <button type="submit" className="flex justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark">
          Save Bill
        </button>
      </div>
    </form>
  );
};

export default BillForm;
