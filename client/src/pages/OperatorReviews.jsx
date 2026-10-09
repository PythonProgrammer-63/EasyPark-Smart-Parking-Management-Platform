import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Clock, MapPin, Building2 } from 'lucide-react';
import { api } from '../services/api';

export default function OperatorReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await api.getOperatorReviews();
      setReviews(res.reviews || []);
    } catch (err) {
      console.error('Fetch reviews error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
            <span>Customer Reviews & Ratings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Read real feedback left by drivers who parked at your locations
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl flex items-center gap-2">
          <span className="text-xs font-bold text-amber-900">Overall Rating:</span>
          <span className="text-base font-extrabold text-amber-600">⭐ {avgRating}</span>
          <span className="text-xs text-amber-700">({totalReviews} reviews)</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 bg-amber-50 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Reviews Received Yet</h3>
          <p className="text-xs text-slate-500">
            As drivers find and use your parking lots, their feedback and ratings will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={rev.user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                    alt={rev.user_name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{rev.user_name}</h4>
                    <span className="text-[11px] text-slate-400">
                      Parked at <strong className="text-slate-700">{rev.parking_name}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-amber-500 text-sm font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                  <span>{rev.rating}</span>
                  <span>{'★'.repeat(rev.rating)}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                "{rev.comment}"
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(rev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
