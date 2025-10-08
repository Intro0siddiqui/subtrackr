import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const PayScreen = () => {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Send Money</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="upiId" className="block text-sm font-medium text-gray-700">
              UPI ID or Scan QR
            </label>
            <input
              type="text"
              name="upiId"
              id="upiId"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Enter UPI ID"
            />
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              type="number"
              name="amount"
              id="amount"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="₹0.00"
            />
          </div>
          <div className="flex gap-4">
            <Button className="flex-1">Send Money</Button>
            <Button variant="secondary" className="flex-1">Request Money</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayScreen;