import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate, getInitials } from '@/utils/helpers'
import {
  Building2,
  CreditCard,
  DoorOpen,
  FileText,
  Mail,
  Phone,
  ShieldAlert,
} from 'lucide-react'

function calculateStayDuration(moveInDate, moveOutDate) {
  if (!moveInDate) return ''
  const start = new Date(moveInDate)
  if (isNaN(start.getTime())) return ''
  if (!moveOutDate) return 'Active'
  const end = new Date(moveOutDate)
  if (isNaN(end.getTime())) return ''
  const months = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
  )
  return months === 1 ? '1 month' : `${months} months`
}

export default function TenantDetailModal({
  isOpen,
  onClose,
  tenant,
  onEdit,
  onMoveOut,
}) {
  if (!tenant) return null

  const stayDuration = calculateStayDuration(tenant.move_in_date, tenant.move_out_date)

  const rentAmount = tenant.monthly_rent ?? tenant.room?.monthly_rent ?? 0
  const depositAmount = tenant.deposit_amount ?? tenant.room?.deposit_amount ?? 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tenant Details"
      subtitle="Complete profile, room allocation, and occupancy records"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Profile Card Header */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
            {getInitials(tenant.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {tenant.full_name}
              </h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tenant.active
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tenant.active ? 'Active Tenant' : 'Moved Out'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-400" />
              <span>{tenant.room?.property?.name || 'Assigned Property'}</span>
              <span>·</span>
              <DoorOpen size={13} className="text-gray-400" />
              <span>Room {tenant.room?.room_number || 'N/A'}</span>
              {tenant.room?.floor && <span>({tenant.room.floor})</span>}
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 border border-gray-200 rounded-xl space-y-1">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
              <Phone size={12} /> Contact Number
            </span>
            {tenant.phone ? (
              <a
                href={`tel:${tenant.phone}`}
                className="font-medium text-indigo-600 hover:underline block"
              >
                {tenant.phone}
              </a>
            ) : (
              <span className="text-gray-400 italic">Not provided</span>
            )}
          </div>

          <div className="p-3 border border-gray-200 rounded-xl space-y-1">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
              <Mail size={12} /> Email Address
            </span>
            {tenant.email ? (
              <a
                href={`mailto:${tenant.email}`}
                className="font-medium text-indigo-600 hover:underline block truncate"
              >
                {tenant.email}
              </a>
            ) : (
              <span className="text-gray-400 italic">Not provided</span>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        {tenant.emergency_contact && (
          <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl text-sm space-y-1">
            <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
              <ShieldAlert size={13} /> Emergency Contact
            </span>
            <p className="text-gray-800 font-medium">{tenant.emergency_contact}</p>
          </div>
        )}

        {/* Tenancy & Financial Terms */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Monthly Rent</span>
            <span className="text-base font-bold text-gray-900 mt-0.5 block">
              {formatCurrency(rentAmount)}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Deposit</span>
            <span className="text-base font-bold text-gray-900 mt-0.5 block">
              {formatCurrency(depositAmount)}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 block">Move-in Date</span>
            <span className="text-sm font-semibold text-gray-900 mt-0.5 block">
              {tenant.move_in_date ? formatDate(tenant.move_in_date) : 'N/A'}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-500 block">
              {tenant.active ? 'Duration' : 'Moved Out'}
            </span>
            <span className="text-sm font-semibold text-gray-900 mt-0.5 block">
              {tenant.active
                ? stayDuration || 'Active'
                : tenant.move_out_date
                ? formatDate(tenant.move_out_date)
                : 'Moved Out'}
            </span>
          </div>
        </div>

        {/* Notes / Identity Remarks */}
        {tenant.notes && (
          <div className="p-3.5 border border-gray-200 rounded-xl space-y-1">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
              <FileText size={12} /> Notes & ID Remarks
            </span>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {tenant.notes}
            </p>
          </div>
        )}

        {/* Payments Summary (if records exist) */}
        {tenant.payments && tenant.payments.length > 0 && (
          <div className="p-3.5 border border-gray-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <CreditCard size={14} className="text-gray-400" />
                Payment Records ({tenant.payments.length})
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto divide-y divide-gray-100 text-xs">
              {tenant.payments.map((p) => (
                <div key={p.id} className="py-1.5 flex items-center justify-between">
                  <span className="text-gray-600">
                    Due: {p.due_date ? formatDate(p.due_date) : 'N/A'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {formatCurrency(p.amount)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        p.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            {tenant.active && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose()
                  onMoveOut(tenant)
                }}
              >
                Move Out
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose()
                onEdit(tenant)
              }}
            >
              Edit Details
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
