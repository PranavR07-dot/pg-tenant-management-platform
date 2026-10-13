import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { AVAILABLE_AMENITIES, ROOM_TYPES } from '@/services/roomService'

export default function RoomModal({
  isOpen,
  onClose,
  onSubmit,
  properties = [],
  existingRooms = [],
  initialData = null,
  preselectedPropertyId = '',
  loading = false,
}) {
  const isEditing = Boolean(initialData)

  const [formData, setFormData] = useState(() => ({
    propertyId:
      initialData?.property_id ||
      preselectedPropertyId ||
      properties[0]?.id ||
      '',
    roomNumber: initialData?.room_number || '',
    floor: initialData?.floor || '',
    roomType: initialData?.room_type || 'single',
    capacity: initialData?.capacity || 1,
    monthlyRent: initialData?.monthly_rent ?? '',
    depositAmount: initialData?.deposit_amount ?? '',
    status: initialData?.status || 'vacant',
    amenities: Array.isArray(initialData?.amenities) ? initialData.amenities : [],
  }))

  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (!formData.propertyId) {
      errs.propertyId = 'Please select a property.'
    }

    if (!formData.roomNumber.trim()) {
      errs.roomNumber = 'Room number/identifier is required.'
    } else {
      // Check duplicate within the property
      const targetRoomNum = formData.roomNumber.trim().toLowerCase()
      const isDuplicate = existingRooms.some(
        (r) =>
          r.property_id === formData.propertyId &&
          r.room_number?.toLowerCase() === targetRoomNum &&
          (!isEditing || r.id !== initialData?.id)
      )
      if (isDuplicate) {
        errs.roomNumber = `Room "${formData.roomNumber.trim()}" already exists in this property.`
      }
    }

    if (formData.monthlyRent === '' || isNaN(Number(formData.monthlyRent)) || Number(formData.monthlyRent) < 0) {
      errs.monthlyRent = 'Please enter a valid monthly rent (e.g. 8000).'
    }

    if (
      formData.depositAmount !== '' &&
      (isNaN(Number(formData.depositAmount)) || Number(formData.depositAmount) < 0)
    ) {
      errs.depositAmount = 'Deposit must be 0 or a positive number.'
    }

    const cap = Number(formData.capacity)
    if (isNaN(cap) || cap < 1 || !Number.isInteger(cap)) {
      errs.capacity = 'Capacity must be at least 1 person.'
    }

    return errs
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleRoomTypeChange = (e) => {
    const typeVal = e.target.value
    const matched = ROOM_TYPES.find((t) => t.value === typeVal)
    setFormData((prev) => ({
      ...prev,
      roomType: typeVal,
      capacity: matched?.defaultCapacity ?? prev.capacity,
    }))
  }

  const toggleAmenity = (amenity) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(amenity)
      const nextAmenities = exists
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity]
      return { ...prev, amenities: nextAmenities }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    await onSubmit(formData)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Room' : 'Add New Room'}
      subtitle={
        isEditing
          ? 'Update room specifications and pricing'
          : 'Create a room and configure rent and amenities'
      }
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Property Selector */}
        <div className="flex flex-col gap-1">
          <label htmlFor="room-prop" className="text-sm font-medium text-gray-700">
            Property *
          </label>
          <select
            id="room-prop"
            name="propertyId"
            value={formData.propertyId}
            onChange={handleChange}
            disabled={loading || (isEditing && Boolean(initialData))}
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

        {/* Room Number and Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="room-num"
            name="roomNumber"
            label="Room Number / Identifier *"
            placeholder="e.g. 101, A-12, Floor 2-B"
            value={formData.roomNumber}
            onChange={handleChange}
            error={errors.roomNumber}
            disabled={loading}
            autoFocus
          />

          <Input
            id="room-floor"
            name="floor"
            label="Floor Level"
            placeholder="e.g. 1st Floor, Ground"
            value={formData.floor}
            onChange={handleChange}
            error={errors.floor}
            disabled={loading}
          />
        </div>

        {/* Room Type and Capacity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="room-type" className="text-sm font-medium text-gray-700">
              Room Sharing Type
            </label>
            <select
              id="room-type"
              name="roomType"
              value={formData.roomType}
              onChange={handleRoomTypeChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="room-capacity"
            name="capacity"
            type="number"
            min="1"
            label="Capacity (Persons) *"
            value={formData.capacity}
            onChange={handleChange}
            error={errors.capacity}
            disabled={loading}
          />
        </div>

        {/* Rent, Deposit, and Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="room-rent"
            name="monthlyRent"
            type="number"
            min="0"
            label="Monthly Rent (₹) *"
            placeholder="e.g. 8500"
            value={formData.monthlyRent}
            onChange={handleChange}
            error={errors.monthlyRent}
            disabled={loading}
          />

          <Input
            id="room-deposit"
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

          <div className="flex flex-col gap-1">
            <label htmlFor="room-status" className="text-sm font-medium text-gray-700">
              Availability Status
            </label>
            <select
              id="room-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {/* Amenities Selection */}
        <div className="space-y-2 pt-1">
          <label className="text-sm font-medium text-gray-700">Room Amenities</label>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 border border-gray-200 rounded-lg bg-gray-50/50">
            {AVAILABLE_AMENITIES.map((item) => {
              const isSelected = formData.amenities.includes(item)
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAmenity(item)}
                  disabled={loading}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}
                  {item}
                </button>
              )
            })}
          </div>
        </div>

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
            {isEditing ? 'Save Changes' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
