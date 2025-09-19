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

  const userInitial = session?.user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-subtle-light dark:border-subtle-dark px-6 sm:px-10 py-4">
      <div className="flex items-center gap-3">
        <div className="size-8 text-primary">
            <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
                <path d="M2 17L12 22L22 17"></path>
                <path d="M2 12L12 17L22 12"></path>
            </svg>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">SubDash</h1>
      </div>
      {session && (
        <div className="flex items-center gap-4">
          <div className="group relative">
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold cursor-pointer">
              {userInitial}
            </div>
            <div className="absolute top-full right-0 mt-2 w-48 bg-surface-light dark:bg-surface-dark rounded-lg shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
              <button 
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-subtle-light dark:hover:bg-subtle-dark rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
