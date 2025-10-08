import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const InsightsScreen = () => {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Insights & History</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="font-semibold mb-2">Filter by Date</p>
            <div className="flex gap-2 flex-wrap">
              <Button>Today</Button>
              <Button variant="secondary">Yesterday</Button>
              <Button variant="secondary">7 Days</Button>
              <Button variant="secondary">30 Days</Button>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Filter by Category</p>
            <div className="flex gap-2 flex-wrap">
              <Button>All</Button>
              <Button variant="secondary">Subscription</Button>
              <Button variant="secondary">Gold</Button>
              <Button variant="secondary">Other</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No transactions to display.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsScreen;