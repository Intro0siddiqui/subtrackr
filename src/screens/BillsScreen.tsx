import React from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const BillsScreen = () => {
  // Mock data for now
  const bills = [
    { id: 1, name: 'Netflix', due: '2 days', amount: 199 },
    { id: 2, name: 'Electricity', due: '5 days', amount: 850 },
    { id: 3, name: 'Milk', due: 'Tomorrow', amount: 600 },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Your Bills</h1>
      {bills.map((bill) => (
        <Card key={bill.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{bill.name}</p>
              <p className="text-sm text-gray-500">Due in {bill.due}</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="font-semibold">₹{bill.amount}</span>
               <Button size="sm">Renew</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BillsScreen;