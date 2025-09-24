import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Reset loading state on component mount (handles OAuth redirects)
  useEffect(() => {
    console.log('🔐 Debug: Auth component mounted');
    console.log('🔐 Debug: Current URL:', window.location.href);
    console.log('🔐 Debug: URL origin:', window.location.origin);
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔐 Debug: Email login attempt started');
    console.log('🔐 Debug: Email provided:', email);

    if (!email.trim()) {
      console.log('🔐 Debug: Email validation failed - empty email');
      setMessage('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      console.log('🔐 Debug: Calling supabase.auth.signInWithOtp...');

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      console.log('🔐 Debug: Supabase response received');

      if (error) {
        console.error('❌ Debug: Email auth error:', error);
        console.error('❌ Debug: Error details:', error.message, error.status);
        setMessage(`Email authentication failed: ${error.message}`);
      } else {
        console.log('✅ Debug: Email auth successful - magic link sent');
        setMessage('Check your email for a login link!');
      }
    } catch (err) {
      console.error('❌ Debug: Unexpected error during email auth:', err);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      console.log('🔐 Debug: Google OAuth attempt started');
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      console.log('🔐 Debug: Google OAuth response received');
      console.log('🔐 Debug: OAuth data:', data);
      console.log('🔐 Debug: OAuth error:', error);

      if (error) {
        console.error('❌ Debug: Google auth error:', error);
        console.error('❌ Debug: Error details:', error.message, error.status);
        setMessage(`Google authentication failed: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data.url) {
        console.error('❌ Debug: No OAuth URL received from Supabase');
        setMessage('Failed to get Google authentication URL');
        setLoading(false);
        return;
      }

      console.log('✅ Debug: Google OAuth URL received, redirecting...');
      console.log('🔐 Debug: Redirect URL:', data.url);
      // Redirect will happen automatically
    } catch (err) {
      console.error('❌ Debug: Unexpected error during Google auth:', err);
      setMessage('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };


  return (
    <main className="flex flex-1 items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white/50 dark:bg-background-dark/50 p-8 shadow-lg backdrop-blur-sm">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">Sign in to continue to SubDash</p>
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

        <div>
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
        </div>
      </div>
    </main>
  );
};

export default Auth;
