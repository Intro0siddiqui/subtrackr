import React, { useState, useCallback } from 'react';
import { forecastBillAmount, predictBillAmountWithAI } from '../services/geminiService';
import type { Bill } from '../types';

interface BillPredictionProps {
  bills: Bill[];
  formatCurrency: (amount: number) => string;
}

const BillPrediction: React.FC<BillPredictionProps> = ({ bills, formatCurrency }) => {
  const [selectedBillId, setSelectedBillId] = useState<string>(bills.find(b => b.history.length > 1)?.id || bills[0]?.id || '');
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
  const variableBills = bills.filter(b => b.history.length > 1 && new Set(b.history).size > 1);

  return (
    <div className="bg-brand-secondary p-6 rounded-lg shadow-lg sticky top-24">
      <h2 className="text-xl font-bold text-brand-text mb-4">Bill Forecaster</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="bill-select" className="block text-sm font-medium text-brand-subtle mb-1">
            Select a variable bill to forecast
          </label>
          <select
            id="bill-select"
            value={selectedBillId}
            onChange={(e) => {
              setSelectedBillId(e.target.value);
              resetState();
            }}
            className="w-full bg-brand-primary border border-brand-border rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
          >
            {variableBills.map(bill => (
              <option key={bill.id} value={bill.id}>{bill.name}</option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
            <button
                onClick={handleAdvancedPrediction}
                disabled={isLoading || !selectedBillId || aiCredits === 0}
                className="w-full flex justify-center items-center px-4 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:bg-brand-subtle disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent"
            >
                {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Predicting...
                </>
                ) : (
                `✨ Get Advanced AI Prediction (${aiCredits} left)`
                )}
            </button>
            <button
                onClick={handleForecast}
                disabled={isLoading || !selectedBillId}
                className="w-full px-4 py-1.5 bg-brand-primary/60 text-brand-subtle text-sm font-medium rounded-lg hover:bg-brand-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent"
                >
                Use Basic Forecast
            </button>
        </div>
        
        {error && <p className="text-sm text-brand-danger text-center pt-2">{error}</p>}

        {prediction && (
          <div className="mt-4 p-4 bg-brand-primary/50 rounded-lg border border-brand-border animate-fade-in">
            <div className="flex justify-between items-center">
                <p className="text-sm text-brand-subtle">Predicted amount for {selectedBill?.name}</p>
                {prediction.isAI && <span className="text-xs font-bold text-brand-accent bg-brand-accent/20 px-2 py-1 rounded-full">AI-Powered</span>}
            </div>
            <p className="text-3xl font-bold text-brand-accent my-2">{formatCurrency(prediction.amount)}</p>
            <p className="text-xs text-brand-subtle italic">{prediction.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillPrediction;