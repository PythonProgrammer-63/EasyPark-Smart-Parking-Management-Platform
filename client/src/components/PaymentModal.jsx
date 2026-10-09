import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Download,
  Car,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

let razorpayCheckoutLoader;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayCheckoutLoader) return razorpayCheckoutLoader;

  razorpayCheckoutLoader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayCheckoutLoader = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayCheckoutLoader;
}

export default function PaymentModal({ isOpen, onClose, parking, onPaymentSuccess }) {
  const [duration, setDuration] = useState('1'); // '1', '2', '5', '24'
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [payerName, setPayerName] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);

  useEffect(() => {
    if (!isOpen || !parking) return undefined;
    let isCurrent = true;
    setSlotsLoading(true);
    setError(null);
    setSelectedSlotId('');
    api.getParkingSlots(parking.id)
      .then((response) => {
        if (isCurrent) setSlots(response.slots || []);
      })
      .catch((err) => {
        if (isCurrent) setError(err.message || 'Unable to load available slots.');
      })
      .finally(() => {
        if (isCurrent) setSlotsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [isOpen, parking?.id]);

  useEffect(() => {
    if (!paymentScreenshot) {
      setScreenshotPreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(paymentScreenshot);
    setScreenshotPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [paymentScreenshot]);

  if (!isOpen || !parking) return null;

  // Calculate charge
  const calculateAmount = () => {
    if (parking.is_free) return 0;
    switch (duration) {
      case '1':
        return parking.hourly_price;
      case '2':
        return parking.two_hour_price || parking.hourly_price * 1.8;
      case '5':
        return parking.five_hour_price || parking.hourly_price * 4;
      case '24':
        return parking.daily_price || parking.hourly_price * 8;
      default:
        return parking.hourly_price * parseFloat(duration || 1);
    }
  };

  const amountToPay = calculateAmount();

  const handlePay = async (e) => {
    e.preventDefault();
    setError(null);
    if (!vehicleNumber.trim()) {
      setError('Please enter your vehicle registration number before paying.');
      return;
    }
    if (!selectedSlotId) {
      setError('Please select an available slot.');
      return;
    }
    setLoading(true);
    let activeHold = null;
    let holdRenewalTimer = null;
    const releaseHold = async () => {
      if (holdRenewalTimer) window.clearInterval(holdRenewalTimer);
      holdRenewalTimer = null;
      if (!activeHold) return;
      const hold = activeHold;
      activeHold = null;
      try {
        await api.releaseSlotHold(hold.slot_id, hold.hold_token);
      } catch (releaseError) {
        console.error('Unable to release parking slot hold:', releaseError);
      }
    };

    try {
      const vehicle = vehicleNumber.toUpperCase().trim();
      if (parking.is_free) {
        const result = await api.bookFreeParkingSlot({
          parking_id: parking.id,
          slot_id: Number(selectedSlotId),
          duration_hours: Number(duration),
          vehicle_number: vehicle
        });
        setReceipt(result.receipt);
        onPaymentSuccess?.(result.receipt);
        setSlots((availableSlots) => availableSlots.filter((slot) => slot.id !== Number(selectedSlotId)));
        return;
      }

      if (paymentMethod === 'UPI') {
        if (!parking.payment_qr_url) {
          throw new Error('This parking facility has not added a business payment QR yet.');
        }
        setShowUpiQr(true);
        setLoading(false);
        return;
      }

      if (paymentMethod === 'Card') {
        const { order } = await api.createRazorpayOrder({
          parking_id: parking.id,
          slot_id: Number(selectedSlotId),
          duration_hours: parseFloat(duration),
          vehicle_number: vehicle,
          payment_method: paymentMethod
        });
        activeHold = { slot_id: order.slot_id, hold_token: order.hold_token };
        const checkoutReady = await loadRazorpayCheckout();
        if (!checkoutReady || !window.Razorpay) {
          throw new Error('Unable to load Razorpay Checkout. Please check your connection and try again.');
        }

        const checkoutBlock = paymentMethod === 'UPI'
          ? {
              upi_only: {
                name: 'Pay via UPI',
                instruments: [{ method: 'upi' }]
              }
            }
          : {
              cards_only: {
                name: 'Pay via Card',
                instruments: [{ method: 'card' }]
              }
            };
        const checkoutBlockName = paymentMethod === 'UPI' ? 'upi_only' : 'cards_only';
        const checkout = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'EasyPark',
          description: `Parking charge: ${order.parking_name}`,
          order_id: order.id,
          theme: { color: '#2563eb' },
          config: {
            display: {
              blocks: checkoutBlock,
              sequence: [`block.${checkoutBlockName}`],
              preferences: { show_default_blocks: false }
            }
          },
          handler: async (response) => {
            if (holdRenewalTimer) window.clearInterval(holdRenewalTimer);
            holdRenewalTimer = null;
            activeHold = null;
            setLoading(true);
            try {
              const result = await api.verifyRazorpayPayment({ ...response, vehicle_number: vehicle });
              setReceipt(result.receipt);
              onPaymentSuccess?.(result.receipt);
              setSlots((availableSlots) => availableSlots.filter((slot) => slot.id !== Number(selectedSlotId)));
            } catch (err) {
              setError(err.message || 'Razorpay payment could not be verified.');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: () => {
              releaseHold();
              setLoading(false);
            }
          }
        });
        checkout.on('payment.failed', (event) => {
          setError(event.error?.description || 'Payment was not completed. You have not been charged by EasyPark.');
          releaseHold();
          setLoading(false);
        });
        holdRenewalTimer = window.setInterval(async () => {
          if (!activeHold) return;
          try {
            await api.renewSlotHold(activeHold.slot_id, activeHold.hold_token);
          } catch (renewError) {
            setError(renewError.message || 'Your slot hold expired. Please choose another slot.');
            checkout.close();
            releaseHold();
            setLoading(false);
          }
        }, 60_000);
        checkout.open();
        return;
      }

      const res = await api.payParkingCharge({
        parking_id: parking.id,
        slot_id: Number(selectedSlotId),
        amount: amountToPay,
        payment_method: paymentMethod,
        duration_hours: parseFloat(duration),
        vehicle_number: vehicle
      });

      setReceipt(res.receipt);
      if (onPaymentSuccess) {
        onPaymentSuccess(res.receipt);
      }
      setSlots((availableSlots) => availableSlots.filter((slot) => slot.id !== Number(selectedSlotId)));
    } catch (err) {
      await releaseHold();
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpiPayment = async () => {
    const normalizedPayerName = payerName.trim();
    if (!normalizedPayerName) {
      setError('Enter the payer name shown in your UPI app.');
      return;
    }
    if (!paymentScreenshot) {
      setError('Upload a screenshot of the completed UPI payment.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const screenshotData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the payment screenshot.'));
        reader.readAsDataURL(paymentScreenshot);
      });
      const result = await api.payParkingCharge({
        parking_id: parking.id,
        slot_id: Number(selectedSlotId),
        amount: amountToPay,
        payment_method: 'UPI',
        duration_hours: parseFloat(duration),
        vehicle_number: vehicleNumber.toUpperCase().trim(),
        payer_name: normalizedPayerName,
        payment_screenshot: screenshotData
      });
      setReceipt(result.receipt);
      onPaymentSuccess?.(result.receipt);
      setSlots((availableSlots) => availableSlots.filter((slot) => slot.id !== Number(selectedSlotId)));
    } catch (err) {
      setError(err.message || 'Unable to record the QR/UPI payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReceipt(null);
    setError(null);
    setShowUpiQr(false);
    setPayerName('');
    setPaymentScreenshot(null);
    onClose();
  };

  return (
    <div className="payment-modal-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="payment-modal-card bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Receipt View after successful payment */}
        {receipt ? (
          <div className="payment-receipt-print p-6 text-center">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
              receipt.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              {receipt.payment_method === 'Cash'
                ? 'Slot Reserved - Payment Processing'
                : receipt.payment_method === 'UPI'
                  ? 'Slot Reserved - UPI Payment Processing'
                : receipt.payment_method === 'Free'
                  ? 'Slot Booking Confirmed!'
                  : 'Slot Booked & Payment Successful!'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {['Cash', 'UPI'].includes(receipt.payment_method)
                ? receipt.payment_method === 'Cash'
                  ? 'Your slot is confirmed. Pay the outstanding amount at the facility.'
                  : 'Your slot is confirmed. The operator will verify receipt of your direct UPI payment.'
                : 'Your parking slot has been confirmed.'}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 text-xs mb-6">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono font-bold text-slate-900">{receipt.transaction_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Parking Facility:</span>
                <span className="font-bold text-slate-900">{receipt.parking_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Slot ID:</span>
                <span className="font-mono font-bold text-brand-700">{receipt.slot_code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Vehicle Number:</span>
                <span className="font-bold text-slate-900">{receipt.vehicle_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-900">{receipt.duration_hours} Hour(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-brand-600">{receipt.payment_method}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Payment Status:</span>
                <span className={`font-bold ${receipt.status === 'Pending' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {receipt.status === 'Pending' ? 'Processing' : receipt.status === 'Success' && receipt.payment_method !== 'Free' ? 'Paid' : 'No payment due'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-700 font-bold">{receipt.status === 'Pending' ? 'Amount Due:' : 'Total Amount Paid:'}</span>
                <span className={`text-base font-extrabold ${receipt.status === 'Pending' ? 'text-amber-700' : 'text-emerald-600'}`}>₹{receipt.amount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-3 px-4 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : showUpiQr ? (
          <div className="p-6">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-extrabold text-slate-900">Pay {parking.name} with its UPI QR</h3>
              <p className="mt-1 text-xs text-slate-500">Scan this business QR using your UPI app, then confirm below. EasyPark does not process this payment.</p>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {parking.payment_qr_url ? (
              <img
                src={parking.payment_qr_url}
                alt={`${parking.name} business UPI payment QR`}
                className="mx-auto max-h-72 w-auto max-w-full rounded-xl border border-slate-200 object-contain"
              />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
                This facility has not uploaded its business QR yet. Choose Cash at Booth or cancel this booking.
              </p>
            )}
            <p className="my-4 text-center text-lg font-extrabold text-slate-900">Amount: ₹{amountToPay}</p>
            <div className="space-y-3">
              <div>
                <label htmlFor="upi-payer-name" className="mb-1 block text-xs font-bold text-slate-700">
                  Payer name (as shown in your UPI app) *
                </label>
                <input
                  id="upi-payer-name"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder="Name on the payment"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label htmlFor="upi-payment-screenshot" className="mb-1 block text-xs font-bold text-slate-700">
                  Payment screenshot * (JPEG, PNG, WebP · max 5 MB)
                </label>
                <input
                  id="upi-payment-screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  required
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setPaymentScreenshot(null);
                    if (!file) return;
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      setError('Choose a JPEG, PNG, or WebP payment screenshot.');
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setError('Payment screenshots must be 5 MB or smaller.');
                      return;
                    }
                    setError(null);
                    setPaymentScreenshot(file);
                  }}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-brand-700"
                />
              </div>
              {screenshotPreview && (
                <img
                  src={screenshotPreview}
                  alt="Preview of uploaded UPI payment screenshot"
                  className="mx-auto max-h-44 max-w-full rounded-xl border border-slate-200 object-contain"
                />
              )}
            </div>
            <p className="my-4 text-center text-[11px] text-slate-500">The booking and payment remain processing until the operator reviews your payer name and screenshot.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowUpiQr(false); setError(null); }}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmUpiPayment}
                disabled={loading || !parking.payment_qr_url || !payerName.trim() || !paymentScreenshot}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Submitting proof...' : 'Submit Payment Proof'}
              </button>
            </div>
          </div>
        ) : (
          /* Payment Form */
          <div>
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-600 block">
                  EasyPark Booking
                </span>
                <h3 className="font-bold text-slate-900 text-base">Reserve Your Parking Slot</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment provider notice */}
            <div className="bg-blue-50 px-6 py-2 border-b border-blue-100 flex items-center gap-2 text-[11px] text-blue-700 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
              <span>Pay by card with Razorpay or pay UPI directly to the parking business QR.</span>
            </div>

            <form onSubmit={handlePay} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Parking Info Header */}
              <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200/80">
                <h4 className="font-bold text-xs text-slate-900">{parking.name}</h4>
                <p className="text-[11px] text-slate-500">{parking.area}, {parking.city}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Choose Your Slot ID
                </label>
                {slotsLoading ? (
                  <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">Loading available slots...</p>
                ) : slots.length === 0 ? (
                  <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">No slots are currently available.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={loading}
                        onClick={() => setSelectedSlotId(String(slot.id))}
                        className={`p-2 rounded-xl border text-xs font-mono font-bold transition ${
                          selectedSlotId === String(slot.id)
                            ? 'border-brand-600 bg-brand-50 text-brand-700'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {slot.slot_code}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle Number Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vehicle Registration No.
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. MH 12 AB 1234"
                    className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-brand-500 uppercase tracking-wider"
                  />
                  <Car className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Select Duration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Parking Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: '1', label: '1 Hr', price: parking.hourly_price },
                    { val: '2', label: '2 Hrs', price: parking.two_hour_price || parking.hourly_price * 1.8 },
                    { val: '5', label: '5 Hrs', price: parking.five_hour_price || parking.hourly_price * 4 },
                    { val: '24', label: 'Daily', price: parking.daily_price || parking.hourly_price * 8 }
                  ].map(d => (
                    <button
                      type="button"
                      key={d.val}
                      onClick={() => setDuration(d.val)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        duration === d.val
                          ? 'border-brand-600 bg-brand-50/80 text-brand-700 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="block text-xs">{d.label}</span>
                      <span className="text-[11px] font-extrabold text-slate-900">
                        {parking.is_free ? 'FREE' : `₹${d.price}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              {!parking.is_free && <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('UPI')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'UPI'
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-brand-600" />
                    <span className="text-xs">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Card')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'Card'
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    <span className="text-xs">Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'Cash'
                        ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Cash at Booth</span>
                  </button>
                </div>
              </div>}

              {parking.is_free && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800">
                  This parking is free. Confirm your slot booking without payment.
                </div>
              )}

              {!parking.is_free && paymentMethod === 'Card' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                  Pay securely by card through Razorpay Checkout. Card details are never entered or stored by EasyPark.
                </div>
              )}

              {!parking.is_free && paymentMethod === 'UPI' && (
                <div className={`p-3 rounded-xl border text-[11px] ${
                  parking.payment_qr_url
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {parking.payment_qr_url
                    ? 'Pay directly to this parking business using its QR code. No Razorpay fee or checkout.'
                    : 'This facility has not added a business QR yet. Choose Cash at Booth or contact the operator.'}
                </div>
              )}

              {!parking.is_free && paymentMethod === 'Cash' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800">
                  Your slot will be reserved and the payment will show as processing until the attendant collects the cash.
                </div>
              )}

              {/* Total & Submit */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    {paymentMethod === 'Cash' ? 'Amount Due at Booth' : 'Total Amount'}
                  </span>
                  <span className="text-xl font-extrabold text-slate-900">₹{amountToPay}</span>
                </div>
                <button
                  type="submit"
                  disabled={
                    loading
                    || slotsLoading
                    || slots.length === 0
                    || !selectedSlotId
                    || (!parking.is_free && paymentMethod === 'UPI' && !parking.payment_qr_url)
                  }
                  className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition disabled:opacity-50"
                >
                  {loading
                    ? 'Processing...'
                    : parking.is_free
                      ? 'Confirm Free Slot Booking'
                      : paymentMethod === 'UPI'
                          ? parking.payment_qr_url ? 'Show Business UPI QR' : 'Business QR Not Added'
                        : paymentMethod === 'Cash'
                          ? 'Reserve Slot - Pay at Booth'
                          : `Pay ₹${amountToPay} with Razorpay`}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
