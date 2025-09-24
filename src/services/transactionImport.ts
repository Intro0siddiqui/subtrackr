import type { Transaction } from '../types';
import { PaymentMethod } from '../types';
import { saveTransaction } from './db';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  transactions: Transaction[];
}

export interface CSVRow {
  [key: string]: string;
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: string;
  type: 'debit' | 'credit';
  balance?: string;
  reference?: string;
}

export class TransactionImportService {
  private static instance: TransactionImportService;

  static getInstance(): TransactionImportService {
    if (!TransactionImportService.instance) {
      TransactionImportService.instance = new TransactionImportService();
    }
    return TransactionImportService.instance;
  }

  /**
   * Import transactions from CSV file
   */
  async importFromCSV(
    csvContent: string,
    mapping: CSVMapping,
    userId?: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: [],
      transactions: []
    };

    try {
      const rows = this.parseCSV(csvContent);
      const headers = rows[0];

      for (let i = 1; i < rows.length; i++) {
        try {
          const row = rows[i];
          const transaction = this.mapCSVRowToTransaction(row, headers, mapping, userId);

          if (transaction) {
            await saveTransaction(transaction);
            result.transactions.push(transaction);
            result.imported++;
          } else {
            result.failed++;
            result.errors.push(`Row ${i + 1}: Failed to map transaction data`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.success = result.imported > 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Failed to import CSV');
    }

    return result;
  }

  /**
   * Import transactions from bank statement format
   */
  async importFromBankStatement(
    statementData: BankTransaction[],
    userId?: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: [],
      transactions: []
    };

    for (let i = 0; i < statementData.length; i++) {
      try {
        const bankTransaction = statementData[i];
        const transaction = this.mapBankTransactionToTransaction(bankTransaction, userId);

        if (transaction) {
          await saveTransaction(transaction);
          result.transactions.push(transaction);
          result.imported++;
        } else {
          result.failed++;
          result.errors.push(`Transaction ${i + 1}: Failed to map bank transaction data`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Transaction ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.imported > 0;
    return result;
  }

  /**
   * Import transactions from JSON data
   */
  async importFromJSON(
    jsonData: any[],
    userId?: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      failed: 0,
      errors: [],
      transactions: []
    };

    for (let i = 0; i < jsonData.length; i++) {
      try {
        const data = jsonData[i];
        const transaction = this.mapJSONToTransaction(data, userId);

        if (transaction) {
          await saveTransaction(transaction);
          result.transactions.push(transaction);
          result.imported++;
        } else {
          result.failed++;
          result.errors.push(`Item ${i + 1}: Failed to map JSON data`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Item ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    result.success = result.imported > 0;
    return result;
  }

  /**
   * Parse CSV content into rows
   */
  private parseCSV(csvContent: string): string[][] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    });
  }

  /**
   * Map CSV row to transaction
   */
  private mapCSVRowToTransaction(
    row: string[],
    headers: string[],
    mapping: CSVMapping,
    userId?: string
  ): Transaction | null {
    try {
      const getValue = (fieldName: keyof CSVMapping): string => {
        const fieldValue = mapping[fieldName];
        if (!fieldValue) return '';
        const index = headers.indexOf(fieldValue);
        return index >= 0 ? row[index] || '' : '';
      };

      const dateStr = getValue('date');
      const amountStr = getValue('amount');
      const description = getValue('description');

      if (!dateStr || !amountStr || !description) {
        return null;
      }

      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
      if (isNaN(amount)) {
        return null;
      }

      const transaction: Transaction = {
        id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        subscriptionId: this.extractSubscriptionId(description),
        user_id: userId,
        amount: Math.abs(amount),
        currency: getValue('currency') || 'INR',
        transactionDate: new Date(dateStr),
        paymentMethod: this.detectPaymentMethod(description),
        transactionId: getValue('reference') || `csv_${Date.now()}`,
        status: amount > 0 ? 'success' : 'failed',
        provider: 'manual',
        metadata: { source: 'csv', originalRow: row },
        createdAt: new Date()
      };

      return transaction;
    } catch (error) {
      console.error('Error mapping CSV row:', error);
      return null;
    }
  }

  /**
   * Map bank transaction to transaction
   */
  private mapBankTransactionToTransaction(
    bankTransaction: BankTransaction,
    userId?: string
  ): Transaction | null {
    try {
      const amount = parseFloat(bankTransaction.amount.replace(/[^0-9.-]/g, ''));
      if (isNaN(amount)) {
        return null;
      }

      const transaction: Transaction = {
        id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        subscriptionId: this.extractSubscriptionId(bankTransaction.description),
        user_id: userId,
        amount: Math.abs(amount),
        currency: 'INR',
        transactionDate: new Date(bankTransaction.date),
        paymentMethod: this.detectPaymentMethod(bankTransaction.description),
        transactionId: bankTransaction.reference || `bank_${Date.now()}`,
        status: bankTransaction.type === 'credit' ? 'success' : 'failed',
        provider: 'bank',
        metadata: { source: 'bank', originalTransaction: bankTransaction },
        createdAt: new Date()
      };

      return transaction;
    } catch (error) {
      console.error('Error mapping bank transaction:', error);
      return null;
    }
  }

  /**
   * Map JSON data to transaction
   */
  private mapJSONToTransaction(data: any, userId?: string): Transaction | null {
    try {
      const transaction: Transaction = {
        id: data.id || `json_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        subscriptionId: data.subscriptionId || this.extractSubscriptionId(data.description || ''),
        user_id: userId,
        amount: parseFloat(data.amount || '0'),
        currency: data.currency || 'INR',
        transactionDate: new Date(data.date || data.transactionDate),
        paymentMethod: data.paymentMethod || this.detectPaymentMethod(data.description || ''),
        transactionId: data.transactionId || data.reference || `json_${Date.now()}`,
        status: data.status || 'success',
        provider: data.provider || 'manual',
        metadata: { source: 'json', originalData: data },
        createdAt: new Date()
      };

      return transaction;
    } catch (error) {
      console.error('Error mapping JSON data:', error);
      return null;
    }
  }

  /**
   * Extract subscription ID from description
   */
  private extractSubscriptionId(description: string): string {
    // Look for common subscription patterns
    const patterns = [
      /netflix/i,
      /spotify/i,
      /amazon prime/i,
      /youtube/i,
      /disney/i,
      /subscription/i,
      /monthly/i,
      /yearly/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(description)) {
        return description.toLowerCase().replace(/\s+/g, '_');
      }
    }

    return '';
  }

  /**
   * Detect payment method from description
   */
  private detectPaymentMethod(description: string): PaymentMethod {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('upi') || lowerDesc.includes('unified payments')) {
      return PaymentMethod.UPI;
    } else if (lowerDesc.includes('credit card') || lowerDesc.includes('visa') || lowerDesc.includes('mastercard')) {
      return PaymentMethod.CREDIT_CARD;
    } else if (lowerDesc.includes('debit card')) {
      return PaymentMethod.DEBIT_CARD;
    } else if (lowerDesc.includes('net banking') || lowerDesc.includes('online banking')) {
      return PaymentMethod.NET_BANKING;
    } else if (lowerDesc.includes('wallet') || lowerDesc.includes('paytm') || lowerDesc.includes('phonepe')) {
      return PaymentMethod.WALLET;
    } else if (lowerDesc.includes('bank transfer') || lowerDesc.includes('neft') || lowerDesc.includes('rtgs')) {
      return PaymentMethod.BANK_TRANSFER;
    }

    return PaymentMethod.UPI; // Default
  }

  /**
   * Validate CSV mapping
   */
  validateCSVMapping(mapping: CSVMapping, headers: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const requiredFields = ['date', 'amount', 'description'];

    for (const field of requiredFields) {
      const fieldValue = mapping[field as keyof CSVMapping];
      if (!fieldValue || !headers.includes(fieldValue)) {
        errors.push(`Required field '${field}' is not properly mapped`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get sample CSV template
   */
  getCSVTemplate(): string {
    return 'Date,Description,Amount,Currency,Reference\n' +
           '2024-01-15,Netflix Subscription,-999,INR,NF123456\n' +
           '2024-01-16,Spotify Premium,-199,INR,SP789012\n' +
           '2024-01-17,Amazon Prime,-1499,INR,AP345678';
  }
}

export interface CSVMapping {
  date: string;
  description: string;
  amount: string;
  currency?: string;
  reference?: string;
}

export const transactionImportService = TransactionImportService.getInstance();