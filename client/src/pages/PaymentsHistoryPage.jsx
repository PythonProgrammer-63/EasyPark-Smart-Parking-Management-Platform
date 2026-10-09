import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, Banknote, Download, ShieldCheck, MapPin } from 'lucide-react';
import { api } from '../services/api';

export default function PaymentsHistoryPage({ onSelectParking }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printingPayment, setPrintingPayment] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.getPaymentHistory();
      setPayments(res.payments || []);
    } catch (err) {
      console.error('Fetch payments error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (!printingPayment) return undefined;

    const handleAfterPrint = () => setPrintingPayment(null);
    window.addEventListener('afterprint', handleAfterPrint);
    const frameId = window.requestAnimationFrame(() => window.print());

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printingPayment]);

  const totalSpent = payments.reduce((acc, p) => p.status === 'Success' ? acc + p.amount : acc, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            <span>Payment Receipts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete transaction records for your parking payments
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800">Total Spent:</span>
          <span className="text-base font-extrabold text-emerald-700">₹{totalSpent}</span>
        </div>
      </div>

      {/* Payment ledger summary */}
      <div className="mb-6 p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center gap-3 text-xs text-blue-800">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
        <div>
          <p className="font-bold">Payment Ledger</p>
          <p className="text-[11px] text-blue-700">
            Online payments are recorded after verification. Cash payments remain processing until the operator confirms collection.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading payment receipts...</div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Payment Records Yet</h3>
          <p className="text-xs text-slate-500">
            When you pay parking charges from any parking details page, your official receipts will be listed here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {payments.map((pay) => {
            const dateObj = new Date(pay.created_at);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={pay.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 transition">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                    {pay.payment_method === 'UPI' ? <QrCode className="w-5 h-5" /> : pay.payment_method === 'Cash' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{pay.parking_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        pay.status === 'Pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : pay.status === 'Failed'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {pay.status === 'Pending' ? 'Processing' : pay.status === 'Success' ? 'Paid' : pay.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{pay.parking_address || pay.city}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Ref: {pay.transaction_id}
                      </span>
                      <span>Method: <strong className="text-slate-800">{pay.payment_method}</strong></span>
                      <span>Duration: <strong className="text-slate-800">{pay.duration_hours} Hr</strong></span>
                      <span className="text-slate-400">{dateStr} at {timeStr}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">
                      {pay.status === 'Pending' ? 'Amount Due' : pay.status === 'Success' ? 'Amount Paid' : 'Amount'}
                    </span>
                    <span className={`text-xl font-extrabold ${pay.status === 'Pending' ? 'text-amber-700' : pay.status === 'Failed' ? 'text-red-600' : 'text-emerald-600'}`}>₹{pay.amount}</span>
                  </div>

                  {pay.status === 'Success' && (
                    <button
                      onClick={() => setPrintingPayment(pay)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title={`Print receipt for payment ${pay.transaction_id}`}
                      aria-label={`Print receipt for payment ${pay.transaction_id}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {printingPayment && (
        <section className="single-payment-receipt" aria-label="Selected payment receipt">
          <h1>EasyPark Payment Receipt</h1>
          <p className="receipt-status">PAID</p>
          <dl>
            <div><dt>Payment reference</dt><dd>{printingPayment.transaction_id}</dd></div>
            <div><dt>Parking facility</dt><dd>{printingPayment.parking_name}</dd></div>
            <div><dt>Address</dt><dd>{printingPayment.parking_address || printingPayment.city}</dd></div>
            <div><dt>Payment method</dt><dd>{printingPayment.payment_method}</dd></div>
            <div><dt>Duration</dt><dd>{printingPayment.duration_hours} hour(s)</dd></div>
            <div>
              <dt>Paid on</dt>
              <dd>{new Date(printingPayment.created_at).toLocaleString()}</dd>
            </div>
            <div className="receipt-total">
              <dt>Total paid</dt>
              <dd>₹{printingPayment.amount}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
