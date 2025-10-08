import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const HomeScreen = () => {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Expenses this Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₹0.00</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button>Pay</Button>
        <Button>Bills</Button>
        <Button>Subscriptions</Button>
        <Button>Insights</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Tip of the Day</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Your AI tip will appear here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomeScreen;