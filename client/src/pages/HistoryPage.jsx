import React, { useState, useEffect } from 'react';
import { History, Trash2, MapPin, Clock, CreditCard, ChevronRight, Eye, CheckCircle2, Banknote } from 'lucide-react';
import { api } from '../services/api';

export default function HistoryPage({ onSelectParking }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.getHistory();
      setHistory(res.history || []);
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteItem = async (historyId) => {
    try {
      await api.deleteHistoryItem(historyId);
      setHistory(prev => prev.filter(h => h.history_id !== historyId));
    } catch (err) {
      console.error('Delete item error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all your parking history?')) return;
    try {
      await api.clearHistory();
      setHistory([]);
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-brand-600" />
            <span>Parking Activity & History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review spots you recently viewed or paid for
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Activity Logged</h3>
          <p className="text-xs text-slate-500">
            As you browse and interact with parking facilities, your history will automatically record here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {history.map((item) => {
            const dateObj = new Date(item.created_at);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={item.history_id}
                className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                    item.action_type === 'paid'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.action_type === 'booked'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-brand-50 text-brand-600'
                  }`}>
                    {item.action_type === 'paid' ? <CreditCard className="w-5 h-5" /> : item.action_type === 'booked' ? <Banknote className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{item.parking_name}</h3>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                        item.action_type === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.action_type === 'booked'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.action_type === 'paid' ? 'Paid Parking' : item.action_type === 'booked' ? 'Slot Booked' : 'Viewed'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.address || `${item.area}, ${item.city}`}</span>
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{dateStr} at {timeStr}</span>
                      </span>
                      {item.price_paid > 0 && (
                        <span className={`font-bold ${item.action_type === 'booked' ? 'text-amber-700' : 'text-emerald-600'}`}>
                          {item.action_type === 'booked' ? 'Parking charge: ' : 'Charged: '}₹{item.price_paid}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onSelectParking(item.parking_id)}
                    className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs rounded-xl flex items-center gap-1 transition"
                  >
                    <span>View Spot</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.history_id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
