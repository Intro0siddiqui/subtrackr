import React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

interface HeaderProps {
    session: Session | null;
}

const Header: React.FC<HeaderProps> = ({ session }) => {

  const handleLogout = async () => {
    await supabase.auth.signOut();
  }

  return (
    <header className="bg-brand-secondary/50 backdrop-blur-lg sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-brand-border">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 text-brand-accent">
                <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
                    <path d="M2 17L12 22L22 17"></path>
                    <path d="M2 12L12 17L22 12"></path>
                </svg>
            </div>
            <span className="text-xl font-bold text-brand-text">SubTrackr</span>
          </div>
          <div className="flex items-center">
            {session && (
                 <button 
                    onClick={handleLogout}
                    className="px-4 py-2 bg-brand-secondary text-brand-text font-semibold rounded-lg text-sm hover:bg-brand-border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-primary focus:ring-brand-accent"
                 >
                    Logout
                 </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;