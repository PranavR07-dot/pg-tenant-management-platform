import { useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/utils/helpers'

export default function TenantModal({
  isOpen,
  onClose,
  onSubmit,
  properties = [],
  rooms = [],
  initialData = null,
  preselectedRoomId = '',
  loading = false,
}) {
  const isEditing = Boolean(initialData)

  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        fullName: initialData.full_name || '',
        propertyId: initialData.room?.property_id || '',
        roomId: initialData.room_id || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        emergencyContact: initialData.emergency_contact || '',
        moveInDate: initialData.move_in_date || new Date().toISOString().slice(0, 10),
        monthlyRent: initialData.monthly_rent ?? initialData.room?.monthly_rent ?? '',
        depositAmount: initialData.deposit_amount ?? initialData.room?.deposit_amount ?? '',
        notes: initialData.notes || '',
      }
    }

    const defaultRoom = preselectedRoomId
      ? rooms.find((r) => r.id === preselectedRoomId)
      : null

    const defaultPropId = defaultRoom?.property_id || properties[0]?.id || ''
    const initialRoom = defaultRoom || rooms.find((r) => r.property_id === defaultPropId)

    return {
      fullName: '',
      propertyId: defaultPropId,
      roomId: initialRoom?.id || '',
      email: '',
      phone: '',
      emergencyContact: '',
      moveInDate: new Date().toISOString().slice(0, 10),
      monthlyRent: initialRoom?.monthly_rent ?? '',
      depositAmount: initialRoom?.deposit_amount ?? '',
      notes: '',
    }
  })

  const [errors, setErrors] = useState({})

  // Filter rooms by the currently selected property
  const availableRoomsForProperty = useMemo(() => {
    if (!formData.propertyId) return []
    return rooms.filter((r) => r.property_id === formData.propertyId)
  }, [rooms, formData.propertyId])

  const handlePropertyChange = (e) => {
    const nextPropId = e.target.value
    const firstRoom = rooms.find((r) => r.property_id === nextPropId)
    setFormData((prev) => ({
      ...prev,
      propertyId: nextPropId,
      roomId: firstRoom?.id || '',
      monthlyRent: firstRoom?.monthly_rent ?? '',
      depositAmount: firstRoom?.deposit_amount ?? '',
    }))
    setErrors((prev) => ({ ...prev, propertyId: undefined, roomId: undefined }))
  }

  const handleRoomChange = (e) => {
    const nextRoomId = e.target.value
    const matchedRoom = rooms.find((r) => r.id === nextRoomId)
    setFormData((prev) => ({
      ...prev,
      roomId: nextRoomId,
      // Auto-populate rent and deposit from selected room if not custom set
      monthlyRent: matchedRoom?.monthly_rent ?? prev.monthlyRent,
      depositAmount: matchedRoom?.deposit_amount ?? prev.depositAmount,
    }))
    setErrors((prev) => ({ ...prev, roomId: undefined }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!formData.fullName.trim()) {
      errs.fullName = 'Full name is required.'
    } else if (formData.fullName.trim().length < 2) {
      errs.fullName = 'Name must be at least 2 characters.'
    }

    if (!formData.propertyId) {
      errs.propertyId = 'Please select a property.'
    }

    if (!formData.roomId) {
      errs.roomId = 'Please assign a room.'
    }

    if (!formData.moveInDate) {
      errs.moveInDate = 'Move-in date is required.'
    }

    if (formData.phone?.trim() && !/^[+0-9\s-]{7,15}$/.test(formData.phone.trim())) {
      errs.phone = 'Please enter a valid phone number.'
    }

    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.'
    }

    if (formData.monthlyRent !== '' && (isNaN(Number(formData.monthlyRent)) || Number(formData.monthlyRent) < 0)) {
      errs.monthlyRent = 'Monthly rent must be a positive number.'
    }

    if (formData.depositAmount !== '' && (isNaN(Number(formData.depositAmount)) || Number(formData.depositAmount) < 0)) {
      errs.depositAmount = 'Deposit must be a positive number.'
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
      full_name: formData.fullName,
      room_id: formData.roomId,
      email: formData.email,
      phone: formData.phone,
      emergency_contact: formData.emergencyContact,
      move_in_date: formData.moveInDate,
      monthly_rent: formData.monthlyRent,
      deposit_amount: formData.depositAmount,
      notes: formData.notes,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Tenant' : 'Add New Tenant'}
      subtitle={
        isEditing
          ? 'Update tenant details, assigned room, or lease terms'
          : 'Register a tenant and assign them to an available room'
      }
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="t-name"
            name="fullName"
            label="Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={formData.fullName}
            onChange={handleChange}
            error={errors.fullName}
            disabled={loading}
            autoFocus
          />

          <Input
            id="t-phone"
            name="phone"
            label="Phone Number"
            placeholder="e.g. +91 98765 43210"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            disabled={loading}
          />
        </div>

        {/* Email & Emergency Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="t-email"
            name="email"
            type="email"
            label="Email Address"
            placeholder="e.g. rahul@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            disabled={loading}
          />

          <Input
            id="t-emergency"
            name="emergencyContact"
            label="Emergency Contact"
            placeholder="e.g. Suresh (Father) - 9876543211"
            value={formData.emergencyContact}
            onChange={handleChange}
            error={errors.emergencyContact}
            disabled={loading}
          />
        </div>

        {/* Property & Room Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <label htmlFor="t-prop" className="text-sm font-medium text-gray-700">
              Property *
            </label>
            <select
              id="t-prop"
              name="propertyId"
              value={formData.propertyId}
              onChange={handlePropertyChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              <option value="">Select a property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ''}
                </option>
              ))}
            </select>
            {errors.propertyId && <p className="text-xs text-red-500">{errors.propertyId}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="t-room" className="text-sm font-medium text-gray-700">
              Assigned Room *
            </label>
            <select
              id="t-room"
              name="roomId"
              value={formData.roomId}
              onChange={handleRoomChange}
              disabled={loading || !formData.propertyId}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              <option value="">Select a room...</option>
              {availableRoomsForProperty.map((r) => {
                const activeCount = (r.tenants || []).filter((t) => t.active).length
                const capacity = r.capacity || 1
                const isCurrentRoom = isEditing && r.id === initialData?.room_id
                const isFull = !isCurrentRoom && activeCount >= capacity
                const isMaintenance = r.status === 'maintenance'

                let statusLabel = ''
                if (isMaintenance) statusLabel = ' [Maintenance]'
                else if (isFull) statusLabel = ` [Full - ${activeCount}/${capacity}]`
                else statusLabel = ` [Available: ${activeCount}/${capacity}]`

                return (
                  <option
                    key={r.id}
                    value={r.id}
                    disabled={isFull || isMaintenance}
                  >
                    Room {r.room_number} ({formatCurrency(r.monthly_rent)}/mo){statusLabel}
                  </option>
                )
              })}
            </select>
            {errors.roomId && <p className="text-xs text-red-500">{errors.roomId}</p>}
          </div>
        </div>

        {/* Move-in Date, Rent, and Deposit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="t-movein"
            name="moveInDate"
            type="date"
            label="Move-in Date *"
            value={formData.moveInDate}
            onChange={handleChange}
            error={errors.moveInDate}
            disabled={loading}
          />

          <Input
            id="t-rent"
            name="monthlyRent"
            type="number"
            min="0"
            label="Agreed Rent (₹/mo)"
            placeholder="e.g. 8500"
            value={formData.monthlyRent}
            onChange={handleChange}
            error={errors.monthlyRent}
            disabled={loading}
          />

          <Input
            id="t-deposit"
            name="depositAmount"
            type="number"
            min="0"
            label="Security Deposit (₹)"
            placeholder="e.g. 15000"
            value={formData.depositAmount}
            onChange={handleChange}
            error={errors.depositAmount}
            disabled={loading}
          />
        </div>

        {/* Notes / KYC Details */}
        <div className="flex flex-col gap-1">
          <label htmlFor="t-notes" className="text-sm font-medium text-gray-700">
            Notes / ID Details
          </label>
          <textarea
            id="t-notes"
            name="notes"
            rows={2}
            placeholder="e.g. Aadhaar verified, college student at RV College, work company: Infosys"
            value={formData.notes}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        {/* Action Buttons */}
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
            {isEditing ? 'Save Changes' : 'Register Tenant'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
