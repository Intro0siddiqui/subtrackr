import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen';
import PayScreen from './screens/PayScreen';
import BillsScreen from './screens/BillsScreen';
import ProfileScreen from './screens/ProfileScreen';
import InsightsScreen from './screens/InsightsScreen';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './components/Auth';
import { supabase } from './services/supabase';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const location = useLocation();

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/pay', label: 'Pay' },
    { path: '/bills', label: 'Bills' },
    { path: '/insights', label: 'Insights' },
    { path: '/profile', label: 'Profile' },
  ];

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-gray-100">
        <main className="flex-1 pb-20">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/pay" element={<PayScreen />} />
            <Route path="/bills" element={<BillsScreen />} />
            <Route path="/insights" element={<InsightsScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <nav className="flex justify-around items-center h-16">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default App;