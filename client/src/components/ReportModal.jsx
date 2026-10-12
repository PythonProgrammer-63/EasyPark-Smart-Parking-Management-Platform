import React, { useState } from 'react';
import { AlertTriangle, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const REPORT_REASONS = [
  'Wrong Location',
  'Wrong Price',
  'Parking Closed',
  'Wrong Contact Number',
  'Incorrect Photos',
  'Incorrect Availability',
  'Other'
];

export default function ReportModal({ isOpen, onClose, parkingId, parkingName }) {
  const [reason, setReason] = useState('Wrong Location');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide details about the inaccuracy.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.submitReport(parkingId, { reason, description });
      setSubmitted(true);
    } catch (err) {
      console.error('Report error:', err);
      setError(err.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError(null);
    setDescription('');
    setReason('Wrong Location');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Report Logged</h3>
            <p className="text-xs text-slate-500 mb-6">
              Thank you for keeping EasyPark accurate! The parking operator has received your alert.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Report Inaccuracy</h3>
                  <p className="text-xs text-slate-500">{parkingName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  What is incorrect?
                </label>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      onClick={() => setReason(r)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        reason === r
                          ? 'border-brand-500 bg-brand-50/70 text-brand-800 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{r}</span>
                      <input
                        type="radio"
                        name="report_reason"
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Additional Details
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail (e.g. entrance has shifted 50m north or price changed to ₹40)..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
