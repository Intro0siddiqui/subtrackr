import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Reset loading state on component mount (handles OAuth redirects)
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setMessage('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Email auth error:', error);
        setMessage(`Email authentication failed: ${error.message}`);
      } else {
        setMessage('Check your email for a login link!');
      }
    } catch (err) {
      console.error('Unexpected error during email auth:', err);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Google auth error:', error);
        setMessage(`Google authentication failed: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data.url) {
        setMessage('Failed to get Google authentication URL');
        setLoading(false);
        return;
      }

      // Redirect will happen automatically
    } catch (err) {
      console.error('Unexpected error during Google auth:', err);
      setMessage('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    try {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('Apple auth error:', error);
        setMessage(`Apple authentication failed: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data.url) {
        setMessage('Failed to get Apple authentication URL');
        setLoading(false);
        return;
      }

      // Redirect will happen automatically
    } catch (err) {
      console.error('Unexpected error during Apple auth:', err);
      setMessage('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white/50 dark:bg-background-dark/50 p-8 shadow-lg backdrop-blur-sm">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">Sign in to continue to SubTrackr</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="email">Email address</label>
              <div className="mt-1">
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  autoComplete="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" 
                  className="form-input block w-full rounded-lg border-slate-300 bg-background-light/70 py-3 px-4 shadow-sm placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-background-dark/70 dark:focus:border-primary dark:focus:ring-primary" 
                />
              </div>
            </div>
          </div>
          
          <div>
            <button 
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Continue with Email'}
            </button>
          </div>
        </form>

        {message && (
          <p className="text-center text-sm text-primary p-3 bg-primary/20 rounded-md">
            {message}
          </p>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300 dark:border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white/50 px-2 text-slate-500 dark:bg-background-dark/50 dark:text-slate-400">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-background-light/70 py-2.5 px-4 text-sm font-medium transition hover:bg-primary/10 dark:border-slate-700 dark:bg-background-dark/70 dark:hover:bg-primary/20 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <path d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" fill="#FFC107"></path><path d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" fill="#FF3D00"></path><path d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" fill="#4CAF50"></path><path d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C41.38,36.128,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z" fill="#1976D2"></path>
            </svg>
            {loading ? 'Connecting...' : 'Google'}
          </button>
          <button
            type="button"
            onClick={handleAppleAuth}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-background-light/70 py-2.5 px-4 text-sm font-medium transition hover:bg-primary/10 dark:border-slate-700 dark:bg-background-dark/70 dark:hover:bg-primary/20 text-slate-700 dark:text-slate-200 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path className="fill-slate-800 dark:fill-white" d="M16.142 21.015c-1.123.015-2.222-.44-3.333-1.02a12.11 12.11 0 01-1.348-.916c-.534-.417-1.134-.933-1.8-1.516a8.44 8.44 0 01-1.282-1.484c-.588-.933-1.04-2.049-1.216-3.233a5.53 5.53 0 01.35-3.25c.502-.916 1.258-1.683 2.148-2.216.89-.55 1.864-.817 2.871-.784 1.114.016 2.213.456 3.324 1.02 1.348.683 1.956 1.05 2.568 1.05.612 0 1.02-.217 1.835-1.066a.23.23 0 01.319-.05c3.278 1.8 4.14 5.925 2.133 9.066a9.14 9.14 0 01-2.923 3.65c-.714.467-1.469.834-2.24 1.084a6.6 6.6 0 01-2.97.184z"></path>
              <path className="fill-slate-800 dark:fill-white" d="M15.438 2.062a4.57 4.57 0 00-3.322 1.583A4.33 4.33 0 0011.02 6.5a4.52 4.52 0 00.916 2.8c.24.367.533.7.866 1a4.2 4.2 0 002.392.934c.734 0 1.459-.217 2.08-.634a4.13 4.13 0 001.528-1.65c.348-.683.515-1.45.467-2.233a4.55 4.55 0 00-1.512-3.35C17.272 2.58 16.372 2.13 15.438 2.06z"></path>
            </svg>
            {loading ? 'Connecting...' : 'Apple'}
          </button>
        </div>
      </div>
    </main>
  );
};

export default Auth;
