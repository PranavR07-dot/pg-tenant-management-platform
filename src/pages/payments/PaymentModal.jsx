import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '@/services/paymentService'

export default function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  tenants = [],
  initialData = null,
  loading = false,
}) {
  const isEditing = Boolean(initialData)

  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        tenantId: initialData.tenant_id || '',
        amount: initialData.amount ?? '',
        dueDate: initialData.due_date || new Date().toISOString().slice(0, 10),
        paidDate: initialData.paid_date || new Date().toISOString().slice(0, 10),
        status: initialData.status || 'pending',
        method: initialData.method || 'upi',
        referenceNo: initialData.reference_no || '',
        notes: initialData.notes || '',
      }
    }

    const firstTenant = tenants[0]
    const defaultRent = firstTenant
      ? firstTenant.monthly_rent ?? firstTenant.room?.monthly_rent ?? ''
      : ''

    return {
      tenantId: firstTenant?.id || '',
      amount: defaultRent,
      dueDate: new Date().toISOString().slice(0, 10),
      paidDate: new Date().toISOString().slice(0, 10),
      status: 'pending',
      method: 'upi',
      referenceNo: '',
      notes: '',
    }
  })

  const [errors, setErrors] = useState({})

  const handleTenantChange = (e) => {
    const tId = e.target.value
    const matched = tenants.find((t) => t.id === tId)
    const rent = matched ? matched.monthly_rent ?? matched.room?.monthly_rent ?? '' : ''
    setFormData((prev) => ({
      ...prev,
      tenantId: tId,
      amount: rent || prev.amount,
    }))
    setErrors((prev) => ({ ...prev, tenantId: undefined }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.tenantId) {
      errs.tenantId = 'Please select a tenant.'
    }

    const amt = Number(formData.amount)
    if (isNaN(amt) || amt <= 0) {
      errs.amount = 'Amount must be greater than 0.'
    }

    if (!formData.dueDate) {
      errs.dueDate = 'Due date is required.'
    }

    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    await onSubmit({
      tenant_id: formData.tenantId,
      amount: formData.amount,
      due_date: formData.dueDate,
      paid_date: formData.status === 'paid' || formData.status === 'partial' ? formData.paidDate : null,
      status: formData.status,
      method: formData.status === 'paid' || formData.status === 'partial' ? formData.method : null,
      reference_no: formData.referenceNo,
      notes: formData.notes,
    })
  }

  const isPaidOrPartial = formData.status === 'paid' || formData.status === 'partial'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Payment Record' : 'Record Rent Payment'}
      subtitle={
        isEditing
          ? 'Update payment amount, settlement status, or transaction reference'
          : 'Log a new rent invoice or received payment for a tenant'
      }
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tenant Selection */}
        <div className="flex flex-col gap-1">
          <label htmlFor="p-tenant" className="text-sm font-medium text-gray-700">
            Tenant *
          </label>
          <select
            id="p-tenant"
            name="tenantId"
            value={formData.tenantId}
            onChange={handleTenantChange}
            disabled={loading || (isEditing && Boolean(initialData))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          >
            <option value="">Select tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} — Room {t.room?.room_number || 'N/A'}{' '}
                {t.room?.property?.name ? `(${t.room.property.name})` : ''}
              </option>
            ))}
          </select>
          {errors.tenantId && <p className="text-xs text-red-500">{errors.tenantId}</p>}
        </div>

        {/* Amount & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="p-amount"
            name="amount"
            type="number"
            min="1"
            label="Amount (₹) *"
            placeholder="e.g. 8500"
            value={formData.amount}
            onChange={handleChange}
            error={errors.amount}
            disabled={loading}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="p-status" className="text-sm font-medium text-gray-700">
              Payment Status *
            </label>
            <select
              id="p-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="p-duedate"
            name="dueDate"
            type="date"
            label="Due Date *"
            value={formData.dueDate}
            onChange={handleChange}
            error={errors.dueDate}
            disabled={loading}
          />

          {isPaidOrPartial ? (
            <Input
              id="p-paiddate"
              name="paidDate"
              type="date"
              label="Paid Date"
              value={formData.paidDate}
              onChange={handleChange}
              disabled={loading}
            />
          ) : (
            <div className="flex items-center text-xs text-gray-400 pt-7">
              <span>Settlement date enabled once marked as Paid.</span>
            </div>
          )}
        </div>

        {/* Payment Method & Reference No (shown when paid/partial) */}
        {isPaidOrPartial && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex flex-col gap-1">
              <label htmlFor="p-method" className="text-sm font-medium text-gray-700">
                Payment Method
              </label>
              <select
                id="p-method"
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

            <Input
              id="p-ref"
              name="referenceNo"
              label="Transaction / UTR No."
              placeholder="e.g. UPI/123456789, Cheque #004"
              value={formData.referenceNo}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="p-notes" className="text-sm font-medium text-gray-700">
            Notes / Receipt Remarks
          </label>
          <textarea
            id="p-notes"
            name="notes"
            rows={2}
            placeholder="e.g. October Rent + 500 electricity bill"
            value={formData.notes}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Save Changes' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
