import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { PAYMENT_METHODS } from '@/services/paymentService'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { CheckCircle2 } from 'lucide-react'

export default function MarkAsPaidModal({
  isOpen,
  onClose,
  onConfirm,
  payment,
  loading = false,
}) {
  const [formData, setFormData] = useState(() => ({
    paidDate: new Date().toISOString().slice(0, 10),
    method: 'upi',
    referenceNo: '',
    notes: '',
  }))

  if (!payment) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onConfirm({
      paidDate: formData.paidDate,
      method: formData.method,
      referenceNo: formData.referenceNo,
      notes: formData.notes,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark Payment as Paid"
      subtitle="Record received rent settlement"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bill Summary Banner */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">
              {payment.tenant?.full_name || 'Tenant'}
            </span>
            <span className="text-base font-bold text-indigo-700">
              {formatCurrency(payment.amount)}
            </span>
          </div>

          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>Room {payment.tenant?.room?.room_number || 'N/A'}</span>
            <span>Due: {payment.due_date ? formatDate(payment.due_date) : 'N/A'}</span>
          </div>
        </div>

        {/* Date & Payment Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="mark-paid-date"
            name="paidDate"
            type="date"
            label="Payment Received Date *"
            value={formData.paidDate}
            onChange={handleChange}
            disabled={loading}
            autoFocus
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="mark-method" className="text-sm font-medium text-gray-700">
              Payment Method *
            </label>
            <select
              id="mark-method"
              name="method"
              value={formData.method}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reference / UTR Number */}
        <Input
          id="mark-ref"
          name="referenceNo"
          label="Transaction / UTR Reference No."
          placeholder="e.g. UPI/123456789012"
          value={formData.referenceNo}
          onChange={handleChange}
          disabled={loading}
        />

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mark-notes" className="text-sm font-medium text-gray-700">
            Receipt Notes
          </label>
          <input
            id="mark-notes"
            name="notes"
            placeholder="e.g. Received via PhonePe"
            value={formData.notes}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 flex items-center gap-1.5"
          >
            <CheckCircle2 size={16} />
            <span>Confirm Settlement</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
