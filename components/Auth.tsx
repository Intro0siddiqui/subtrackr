import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the login link!');
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center pt-16">
      <div className="w-full max-w-md p-8 space-y-6 bg-brand-secondary rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-text">Welcome to SubTrackr</h1>
          <p className="text-brand-subtle">Sign in to continue to SubTrackr</p>
        </div>
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-subtle mb-1">
              Email address
            </label>
            <input
              id="email"
              className="w-full bg-brand-primary border border-brand-border rounded-md p-3 text-brand-text focus:ring-2 focus:ring-brand-accent"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full px-4 py-3 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:bg-brand-subtle disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-secondary focus:ring-brand-accent"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </div>
        </form>
        {message && (
          <p className="text-center text-sm text-brand-accent p-3 bg-brand-accent/20 rounded-md">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;