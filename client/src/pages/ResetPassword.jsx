import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle, Car } from 'lucide-react';
import { api } from '../services/api';

export default function ResetPassword({ token, onNavigateLogin }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.resetPassword(token, newPassword);
      setMessage(response.message);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-6 text-white text-center">
          <Car className="w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold">Set a new password</h1>
          <p className="text-xs text-brand-100 mt-1">Choose a password with at least 6 characters.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs border border-emerald-100">{message}</div>}
          <label className="block text-xs font-bold text-slate-700">
            New password
            <span className="relative block mt-1.5">
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </span>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            Confirm new password
            <span className="relative block mt-1.5">
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </span>
          </label>
          {message ? (
            <button type="button" onClick={onNavigateLogin} className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2">
              Back to sign in <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? 'Resetting password...' : 'Reset password'} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
