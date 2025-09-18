import React, { useState, useCallback } from 'react';
import { forecastBillAmount, predictBillAmountWithAI } from '../services/geminiService';
import type { Bill } from '../types';

interface BillPredictionProps {
  bills: Bill[];
  formatCurrency: (amount: number) => string;
}

const BillPrediction: React.FC<BillPredictionProps> = ({ bills, formatCurrency }) => {
  const variableBills = bills.filter(b => b.history.length > 1 && new Set(b.history).size > 1);
  const [selectedBillId, setSelectedBillId] = useState<string>(variableBills[0]?.id || '');
  const [prediction, setPrediction] = useState<{ amount: number; explanation: string; isAI: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aiCredits, setAiCredits] = useState(3);

  const resetState = () => {
    setError(null);
    setPrediction(null);
  };

  const handleForecast = useCallback(async () => {
    const selectedBill = bills.find(b => b.id === selectedBillId);
    if (!selectedBill) return;

    setIsLoading(true);
    resetState();

    try {
      const result = await forecastBillAmount(selectedBill.name, selectedBill.history);
      setPrediction({ ...result, isAI: false });
    } catch (err) {
      setError('Failed to get forecast. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBillId, bills]);

  const handleAdvancedPrediction = useCallback(async () => {
    if (!selectedBillId || aiCredits <= 0) return;

    const selectedBill = bills.find(b => b.id === selectedBillId);
    if (!selectedBill) return;

    setIsLoading(true);
    resetState();

    try {
      const result = await predictBillAmountWithAI(selectedBill.name, selectedBill.history);
      setPrediction({ ...result, isAI: true });
      setAiCredits(prev => prev - 1);
    } catch (err) {
      setError('Failed to get AI prediction. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBillId, bills, aiCredits]);

  const selectedBill = bills.find(b => b.id === selectedBillId);
  const inputClasses = "form-select block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary";

  return (
    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl shadow-sm h-full">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Bill Forecaster</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="bill-select" className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1">
            Select a variable bill to forecast
          </label>
          <select
            id="bill-select"
            value={selectedBillId}
            onChange={(e) => {
              setSelectedBillId(e.target.value);
              resetState();
            }}
            className={inputClasses}
            disabled={variableBills.length === 0}
          >
            {variableBills.length > 0 ? (
                variableBills.map(bill => (
                    <option key={bill.id} value={bill.id}>{bill.name}</option>
                ))
            ) : (
                <option>No variable bills available</option>
            )}
          </select>
        </div>
        
        <div className="space-y-2">
            <button
                onClick={handleAdvancedPrediction}
                disabled={isLoading || !selectedBillId || aiCredits === 0 || variableBills.length === 0}
                className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-50"
            >
                {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Predicting...
                </>
                ) : (
                `✨ Get AI Prediction (${aiCredits} left)`
                )}
            </button>
            <button
                onClick={handleForecast}
                disabled={isLoading || !selectedBillId || variableBills.length === 0}
                className="w-full px-4 py-2 text-sm font-bold text-gray-900 dark:text-white bg-subtle-light dark:bg-subtle-dark rounded-lg hover:bg-subtle-light/80 dark:hover:bg-subtle-dark/80 transition-colors disabled:opacity-50"
                >
                Use Basic Forecast
            </button>
        </div>
        
        {error && <p className="text-sm text-red-500 text-center pt-2">{error}</p>}

        {prediction && (
          <div className="mt-4 p-4 bg-background-light dark:bg-background-dark rounded-lg border border-subtle-light dark:border-subtle-dark">
            <div className="flex justify-between items-center">
                <p className="text-sm text-muted-light dark:text-muted-dark">Predicted for {selectedBill?.name}</p>
                {prediction.isAI && <span className="text-xs font-bold text-primary bg-primary/20 px-2 py-1 rounded-full">AI</span>}
            </div>
            <p className="text-3xl font-bold text-primary my-2">{formatCurrency(prediction.amount)}</p>
            <p className="text-xs text-muted-light dark:text-muted-dark italic">{prediction.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillPrediction;
