import React, { useState, useEffect, useCallback } from 'react';
import type { Bill, Subscription } from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import { supabase } from './services/supabase';
import * as db from './services/db';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Handle Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false); // Initial load is just auth check
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener?.unsubscribe();
    };
  }, []);
  
  // Load data from local DB and sync with remote
  const loadAndSyncData = useCallback(async (user_id: string) => {
    setIsSyncing(true);
    
    // 1. Fetch remote data from Supabase
    const [billsResponse, subsResponse] = await Promise.all([
      supabase.from('bills').select('*').eq('user_id', user_id),
      supabase.from('subscriptions').select('*').eq('user_id', user_id),
    ]);
    
    // 2. Sync remote data to IndexedDB
    if (billsResponse.data) await db.syncBills(billsResponse.data as Bill[]);
    if (subsResponse.data) await db.syncSubscriptions(subsResponse.data as Subscription[]);

    // 3. Load data from IndexedDB to state
    const localBills = await db.getAllBills();
    const localSubs = await db.getAllSubscriptions();
    setBills(localBills);
    setSubscriptions(localSubs);

    setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (session?.user) {
        loadAndSyncData(session.user.id);
    } else {
        // Clear local data on logout
        db.clearAllData().then(() => {
            setBills([]);
            setSubscriptions([]);
        });
    }
  }, [session, loadAndSyncData]);


  const handleSaveBill = useCallback(async (billData: Omit<Bill, 'id'> | Bill) => {
    if (!session?.user) return;
    
    const isEditing = 'id' in billData;
    const billToSave: Bill = isEditing 
      ? billData 
      : { ...billData, id: crypto.randomUUID(), user_id: session.user.id, status: 'unpaid' };

    // 1. Save to local DB first for immediate UI update
    await db.saveBill(billToSave);
    const localBills = await db.getAllBills();
    setBills(localBills);

    // 2. Sync to Supabase in the background
    await supabase.from('bills').upsert({ ...billToSave, user_id: session.user.id });

  }, [session]);

  const handleDeleteBill = useCallback(async (id: string) => {
    // 1. Delete from local DB
    await db.deleteBill(id);
    const localBills = await db.getAllBills();
    setBills(localBills);

    // 2. Sync deletion to Supabase
    await supabase.from('bills').delete().eq('id', id);
  }, []);

  const handleSaveSubscription = useCallback(async (subData: Omit<Subscription, 'id'> | Subscription) => {
     if (!session?.user) return;
    
    const isEditing = 'id' in subData;
    const subToSave: Subscription = isEditing
      ? subData
      : { ...subData, id: crypto.randomUUID(), user_id: session.user.id };
      
    // 1. Save locally
    await db.saveSubscription(subToSave);
    const localSubs = await db.getAllSubscriptions();
    setSubscriptions(localSubs);
    
    // 2. Sync to Supabase
    await supabase.from('subscriptions').upsert({ ...subToSave, user_id: session.user.id });

  }, [session]);

  const handleDeleteSubscription = useCallback(async (id: string) => {
    // 1. Delete locally
    await db.deleteSubscription(id);
    const localSubs = await db.getAllSubscriptions();
    setSubscriptions(localSubs);
    
    // 2. Sync deletion to Supabase
    await supabase.from('subscriptions').delete().eq('id', id);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-slate-800 dark:text-slate-200 text-xl">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header session={session} />
        {!session ? (
            <Auth />
        ) : (
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
                {isSyncing ? (
                    <div className="text-center pt-16 text-muted-light dark:text-muted-dark">Syncing your data...</div>
                ) : (
                    <Dashboard
                        key={session.user.id}
                        user={session.user}
                        bills={bills}
                        subscriptions={subscriptions}
                        onSaveBill={handleSaveBill}
                        onDeleteBill={handleDeleteBill}
                        onSaveSubscription={handleSaveSubscription}
                        onDeleteSubscription={handleDeleteSubscription}
                    />
                )}
            </main>
        )}
    </div>
  );
};

export default App;
