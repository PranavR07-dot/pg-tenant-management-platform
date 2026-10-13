import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/utils/helpers'
import { DoorOpen, LogOut } from 'lucide-react'

export default function MoveOutModal({
  isOpen,
  onClose,
  onConfirm,
  tenant,
  loading = false,
}) {
  const [moveOutDate, setMoveOutDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  if (!tenant) return null

  const handleConfirm = async (e) => {
    e.preventDefault()
    if (!moveOutDate) {
      setError('Move-out date is required.')
      return
    }

    if (tenant.move_in_date && moveOutDate < tenant.move_in_date) {
      setError(`Move-out date cannot be earlier than move-in date (${formatDate(tenant.move_in_date)}).`)
      return
    }

    setError('')
    await onConfirm({ moveOutDate, notes })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Move-Out"
      subtitle="Complete checkout and update room vacancy"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Tenant Summary Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900">{tenant.full_name}</span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
              <DoorOpen size={12} />
              Room {tenant.room?.room_number || 'N/A'}
            </span>
          </div>

          <div className="text-xs text-gray-500 flex items-center justify-between">
            <span>Property: {tenant.room?.property?.name || 'Assigned Property'}</span>
            <span>Moved In: {tenant.move_in_date ? formatDate(tenant.move_in_date) : 'N/A'}</span>
          </div>
        </div>

        {/* Move-out Date Input */}
        <Input
          id="move-out-date"
          type="date"
          label="Move-out Date *"
          value={moveOutDate}
          onChange={(e) => {
            setMoveOutDate(e.target.value)
            setError('')
          }}
          error={error}
          disabled={loading}
          autoFocus
        />

        {/* Departure Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="move-out-notes" className="text-sm font-medium text-gray-700">
            Checkout Notes / Deposit Settlement
          </label>
          <textarea
            id="move-out-notes"
            rows={2}
            placeholder="e.g. Key handed over, room inspected, deposit of ₹15,000 refunded via UPI"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        {/* Explanatory Info Notice */}
        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
          <strong>Note:</strong> Marking as moved out will free up a vacancy in{' '}
          <strong>Room {tenant.room?.room_number}</strong>. The tenant&apos;s past history and rent records will be permanently preserved.
        </p>

        {/* Modal Actions */}
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
            variant="danger"
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <LogOut size={15} />
            <span>Confirm Move-Out</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
