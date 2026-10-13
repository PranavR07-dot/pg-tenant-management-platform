import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DoorOpen,
  Filter,
  Info,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/utils/helpers'
import {
  createProperty,
  deleteProperty,
  fetchProperties,
  updateProperty,
} from '@/services/propertyService'
import { uploadPropertyImage } from '@/services/propertyImageService'
import {
  createRoom,
  deleteRoom,
  fetchRooms,
  updateRoom,
} from '@/services/roomService'
import PropertyModal from './PropertyModal'
import RoomModal from './RoomModal'
import DeleteConfirmModal from './DeleteConfirmModal'

export default function RoomsPage() {
  const isMountedRef = useRef(true)

  // State
  const [activeTab, setActiveTab] = useState('rooms') // 'rooms' | 'properties'
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error' | 'info', message: string }

  // Filters for rooms
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [propertyModalOpen, setPropertyModalOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)

  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null) // { type: 'property'|'room', item: object }

  // Load properties and rooms
  const handleLoadResults = useCallback(([propRes, roomRes]) => {
    if (!isMountedRef.current) return

    if (propRes.error) {
      setFeedback({ type: 'error', message: `Properties: ${propRes.error.message}` })
    } else {
      setProperties(propRes.data)
    }

    if (roomRes.error) {
      setFeedback({ type: 'error', message: `Rooms: ${roomRes.error.message}` })
    } else {
      setRooms(roomRes.data)
    }

    setLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all([fetchProperties(), fetchRooms()])
    handleLoadResults(results)
  }, [handleLoadResults])

  useEffect(() => {
    isMountedRef.current = true
    Promise.all([fetchProperties(), fetchRooms()]).then(handleLoadResults)
    return () => {
      isMountedRef.current = false
    }
  }, [handleLoadResults])

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Property filter
      if (selectedPropertyFilter !== 'all' && room.property_id !== selectedPropertyFilter) {
        return false
      }
      // Status filter
      if (selectedStatusFilter !== 'all' && room.status !== selectedStatusFilter) {
        return false
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesRoom = room.room_number?.toLowerCase().includes(q)
        const matchesFloor = room.floor?.toLowerCase().includes(q)
        const matchesProp = room.property?.name?.toLowerCase().includes(q)
        const matchesCity = room.property?.city?.toLowerCase().includes(q)
        if (!matchesRoom && !matchesFloor && !matchesProp && !matchesCity) {
          return false
        }
      }
      return true
    })
  }, [rooms, selectedPropertyFilter, selectedStatusFilter, searchQuery])

  // Filtered properties
  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties
    const q = searchQuery.toLowerCase().trim()
    return properties.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    )
  }, [properties, searchQuery])

  // Handlers for Property operations
  const handleOpenAddProperty = () => {
    setEditingProperty(null)
    setPropertyModalOpen(true)
  }

  const handleOpenEditProperty = (prop) => {
    setEditingProperty(prop)
    setPropertyModalOpen(true)
  }

  const handlePropertySubmit = async (formData) => {
    setActionLoading(true)
    setFeedback(null)

    const { pendingFiles = [], ...propertyPayload } = formData

    if (editingProperty) {
      const res = await updateProperty(editingProperty.id, propertyPayload)
      if (res.error) {
        setFeedback({ type: 'error', message: `Failed to update property: ${res.error.message}` })
      } else {
        setFeedback({ type: 'success', message: `Property "${formData.name}" updated successfully.` })
        setPropertyModalOpen(false)
        await loadData()
      }
    } else {
      const res = await createProperty(propertyPayload)
      if (res.error) {
        setFeedback({ type: 'error', message: `Failed to create property: ${res.error.message}` })
      } else {
        const createdProperty = res.data

        // If user selected pending photos during creation, upload them now
        if (createdProperty?.id && pendingFiles.length > 0) {
          for (const item of pendingFiles) {
            try {
              await uploadPropertyImage(createdProperty.id, item.file, item.isCover)
            } catch (err) {
              console.warn('Failed to upload image:', err)
            }
          }
        }

        const msg = res.schemaNotice
          ? `Property "${formData.name}" created! (${res.schemaNotice})`
          : `Property "${formData.name}" created successfully!`
        setFeedback({ type: 'success', message: msg })
        setPropertyModalOpen(false)
        await loadData()
      }
    }
    setActionLoading(false)
  }

  // Handlers for Room operations
  const handleOpenAddRoom = (defaultPropertyId = '') => {
    if (properties.length === 0) {
      setFeedback({
        type: 'info',
        message: 'Please create at least one property before adding rooms.',
      })
      setPropertyModalOpen(true)
      return
    }
    setEditingRoom(null)
    setSelectedPropertyFilter(defaultPropertyId || selectedPropertyFilter)
    setRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room) => {
    setEditingRoom(room)
    setRoomModalOpen(true)
  }

  const handleRoomSubmit = async (formData) => {
    setActionLoading(true)
    setFeedback(null)

    if (editingRoom) {
      const updates = {
        room_number: formData.roomNumber,
        floor: formData.floor,
        monthly_rent: formData.monthlyRent,
        deposit_amount: formData.depositAmount,
        status: formData.status,
        amenities: formData.amenities,
        room_type: formData.roomType,
        capacity: formData.capacity,
      }
      const res = await updateRoom(editingRoom.id, updates)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({ type: 'success', message: `Room "${formData.roomNumber}" updated successfully.` })
        setRoomModalOpen(false)
        await loadData()
      }
    } else {
      const res = await createRoom(formData)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        const msg = res.schemaNotice
          ? `Room "${formData.roomNumber}" created! (${res.schemaNotice})`
          : `Room "${formData.roomNumber}" created successfully!`
        setFeedback({ type: 'success', message: msg })
        setRoomModalOpen(false)
        await loadData()
      }
    }
    setActionLoading(false)
  }

  // Delete initiation and confirmation
  const handlePromptDelete = (type, item) => {
    setItemToDelete({ type, item })
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    setActionLoading(true)
    setFeedback(null)

    if (itemToDelete.type === 'property') {
      const res = await deleteProperty(itemToDelete.item.id)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({
          type: 'success',
          message: `Property "${itemToDelete.item.name}" deleted successfully.`,
        })
        setDeleteModalOpen(false)
        await loadData()
      }
    } else if (itemToDelete.type === 'room') {
      const res = await deleteRoom(itemToDelete.item.id, itemToDelete.item.property_id)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({
          type: 'success',
          message: `Room "${itemToDelete.item.room_number}" deleted successfully.`,
        })
        setDeleteModalOpen(false)
        await loadData()
      }
    }

    setActionLoading(false)
  }

  // Status badge styling helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Occupied
          </span>
        )
      case 'maintenance':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Maintenance
          </span>
        )
      case 'vacant':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Vacant
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties & Rooms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your buildings, hostels, and room inventory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            title="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenAddProperty}
            className="flex items-center gap-1.5"
          >
            <Building2 size={16} />
            <span>Add Property</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAddRoom()}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Add Room</span>
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm transition-all ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : feedback.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle size={18} className="shrink-0 text-red-500 mt-0.5" />
          ) : feedback.type === 'info' ? (
            <Info size={18} className="shrink-0 text-blue-500 mt-0.5" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p>{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'rooms'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DoorOpen size={18} />
            <span>Rooms</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'rooms'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {rooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'properties'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 size={18} />
            <span>Properties</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'properties'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {properties.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'rooms'
                ? 'Search by room #, floor, or property...'
                : 'Search property name, address, or city...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Room specific filters */}
        {activeTab === 'rooms' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Property Selector */}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Filter size={15} className="text-gray-400" />
              <select
                value={selectedPropertyFilter}
                onChange={(e) => setSelectedPropertyFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Properties ({properties.length})</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        )}
      </div>

      {/* ─── ROOMS TAB CONTENT ────────────────────────────────────────── */}
      {activeTab === 'rooms' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs animate-pulse space-y-3"
                >
                  <div className="h-5 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-40" />
                  <div className="h-4 bg-gray-100 rounded w-32" />
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            // No properties created yet
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Building2 size={24} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                No Properties Created Yet
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Before adding rooms, create your first PG property or building.
              </p>
              <div className="mt-5">
                <Button onClick={handleOpenAddProperty} className="gap-2">
                  <Plus size={16} /> Add First Property
                </Button>
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            // Properties exist but no rooms match filters
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-xs">
              <DoorOpen size={36} className="mx-auto text-gray-300 mb-2" />
              <h3 className="text-base font-semibold text-gray-900">No rooms found</h3>
              <p className="text-sm text-gray-500 mt-1">
                {rooms.length === 0
                  ? 'Get started by creating rooms for your properties.'
                  : 'Try adjusting your search query or filters to find what you need.'}
              </p>
              <div className="mt-4 flex justify-center gap-3">
                {rooms.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedPropertyFilter('all')
                      setSelectedStatusFilter('all')
                      setSearchQuery('')
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    handleOpenAddRoom(
                      selectedPropertyFilter !== 'all' ? selectedPropertyFilter : ''
                    )
                  }
                  className="gap-1.5"
                >
                  <Plus size={15} /> Add Room
                </Button>
              </div>
            </div>
          ) : (
            // Room Cards Grid
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-3">
                    {/* Top Row: Room identifier & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            Room {room.room_number}
                          </h3>
                          {renderStatusBadge(room.status)}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Building2 size={13} className="text-gray-400" />
                          <span>{room.property?.name || 'Assigned Property'}</span>
                          {room.floor && <span>· {room.floor}</span>}
                        </p>
                      </div>

                      {/* Room type tag */}
                      {room.room_type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium capitalize">
                          {room.room_type}
                        </span>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(room.monthly_rent)}
                        </span>
                        <span className="text-xs text-gray-500"> / month</span>
                      </div>
                      {Number(room.deposit_amount) > 0 && (
                        <span className="text-xs text-gray-500">
                          Deposit: {formatCurrency(room.deposit_amount)}
                        </span>
                      )}
                    </div>

                    {/* Tenant Info */}
                    <div className="pt-2 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Users size={14} className="text-gray-400" />
                        {room.activeTenantsCount > 0 ? (
                          <span className="font-medium text-gray-800 truncate">
                            Tenant: {room.activeTenantNames.join(', ')}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">No tenant assigned</span>
                        )}
                      </div>
                    </div>

                    {/* Amenities list */}
                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {room.amenities.slice(0, 3).map((a) => (
                          <span
                            key={a}
                            className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium"
                          >
                            {a}
                          </span>
                        ))}
                        {room.amenities.length > 3 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{room.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditRoom(room)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition-colors"
                      title="Edit room"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePromptDelete('room', room)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                      title="Delete room"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── PROPERTIES TAB CONTENT ───────────────────────────────────── */}
      {activeTab === 'properties' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs animate-pulse space-y-3"
                >
                  <div className="h-5 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-48" />
                </div>
              ))}
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center shadow-xs">
              <Building2 size={36} className="mx-auto text-gray-300 mb-2" />
              <h3 className="text-base font-semibold text-gray-900">
                {properties.length === 0 ? 'No properties added' : 'No properties match search'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {properties.length === 0
                  ? 'Add your first PG property to begin organizing rooms.'
                  : 'Try clearing your search query.'}
              </p>
              <div className="mt-4">
                <Button onClick={handleOpenAddProperty} className="gap-1.5">
                  <Plus size={15} /> Add Property
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {prop.coverImageUrl ? (
                          <img
                            src={prop.coverImageUrl}
                            alt={prop.name}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-500">
                            <Building2 size={22} />
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{prop.name}</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin size={13} className="text-gray-400 shrink-0" />
                            <span>
                              {prop.city}
                              {prop.address ? ` · ${prop.address}` : ''}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {prop.is_published ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            Draft
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                          <DoorOpen size={13} />
                          {prop.roomCount} {prop.roomCount === 1 ? 'Room' : 'Rooms'}
                        </span>
                      </div>
                    </div>

                    {prop.contact_number && (
                      <p className="text-xs text-gray-600 flex items-center gap-1.5">
                        <Phone size={13} className="text-gray-400" />
                        <span>{prop.contact_number}</span>
                      </p>
                    )}

                    {prop.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {prop.description}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPropertyFilter(prop.id)
                        setActiveTab('rooms')
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      View Rooms →
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenAddRoom(prop.id)}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        + Add Room
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditProperty(prop)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition-colors"
                        title="Edit property"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePromptDelete('property', prop)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                        title="Delete property"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PropertyModal
        key={propertyModalOpen ? editingProperty?.id || 'new-prop' : 'closed-prop'}
        isOpen={propertyModalOpen}
        onClose={() => setPropertyModalOpen(false)}
        onSubmit={handlePropertySubmit}
        initialData={editingProperty}
        loading={actionLoading}
      />

      <RoomModal
        key={roomModalOpen ? editingRoom?.id || 'new-room' : 'closed-room'}
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onSubmit={handleRoomSubmit}
        properties={properties}
        existingRooms={rooms}
        initialData={editingRoom}
        preselectedPropertyId={
          selectedPropertyFilter !== 'all' ? selectedPropertyFilter : ''
        }
        loading={actionLoading}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemType={itemToDelete?.type || 'item'}
        itemName={
          itemToDelete?.type === 'property'
            ? itemToDelete?.item?.name
            : itemToDelete?.item?.room_number
        }
        warningMessage={
          itemToDelete?.type === 'property'
            ? `Deleting this property will also remove all its rooms. Any active tenants must be checked out first.`
            : `Ensure any tenants are checked out or reassigned before deleting.`
        }
        loading={actionLoading}
      />
    </div>
  )
}
