import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const ProfileScreen = () => {
  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p>User details will be here.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wallet Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">₹0.00</p>
        </CardContent>
      </Card>

      <Button variant="destructive">Log Out</Button>
    </div>
  );
};

export default ProfileScreen;