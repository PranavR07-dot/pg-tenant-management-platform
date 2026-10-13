import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DoorOpen,
  Filter,
  Info,
  LogOut,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { fetchProperties } from '@/services/propertyService'
import { fetchRooms } from '@/services/roomService'
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  moveOutTenant,
  updateTenant,
} from '@/services/tenantService'
import TenantModal from './TenantModal'
import MoveOutModal from './MoveOutModal'
import TenantDetailModal from './TenantDetailModal'
import DeleteConfirmModal from '../rooms/DeleteConfirmModal'

export default function TenantsPage() {
  const isMountedRef = useRef(true)

  // Data states
  const [tenants, setTenants] = useState([])
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('active') // 'all' | 'active' | 'inactive'
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [tenantModalOpen, setTenantModalOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)

  const [moveOutModalOpen, setMoveOutModalOpen] = useState(false)
  const [tenantToMoveOut, setTenantToMoveOut] = useState(null)

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTenantDetail, setSelectedTenantDetail] = useState(null)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState(null)

  // Load tenants, properties, and rooms
  const handleLoadResults = useCallback(([tenantsRes, propsRes, roomsRes]) => {
    if (!isMountedRef.current) return

    if (tenantsRes.error) {
      setFeedback({ type: 'error', message: `Tenants: ${tenantsRes.error.message}` })
    } else {
      setTenants(tenantsRes.data)
    }

    if (propsRes.error) {
      console.warn('Properties load error:', propsRes.error.message)
    } else {
      setProperties(propsRes.data)
    }

    if (roomsRes.error) {
      console.warn('Rooms load error:', roomsRes.error.message)
    } else {
      setRooms(roomsRes.data)
    }

    setLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all([
      fetchTenants(),
      fetchProperties(),
      fetchRooms(),
    ])
    handleLoadResults(results)
  }, [handleLoadResults])

  useEffect(() => {
    isMountedRef.current = true
    Promise.all([fetchTenants(), fetchProperties(), fetchRooms()]).then(handleLoadResults)
    return () => {
      isMountedRef.current = false
    }
  }, [handleLoadResults])

  // Derived tenant metrics
  const stats = useMemo(() => {
    const total = tenants.length
    const active = tenants.filter((t) => t.active).length
    const movedOut = tenants.filter((t) => !t.active).length
    const totalRevenue = tenants
      .filter((t) => t.active)
      .reduce((sum, t) => sum + Number(t.monthly_rent ?? t.room?.monthly_rent ?? 0), 0)

    return { total, active, movedOut, totalRevenue }
  }, [tenants])

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      // Status filter
      if (statusFilter === 'active' && !tenant.active) return false
      if (statusFilter === 'inactive' && tenant.active) return false

      // Property filter
      if (propertyFilter !== 'all' && tenant.room?.property_id !== propertyFilter) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesName = tenant.full_name?.toLowerCase().includes(q)
        const matchesPhone = tenant.phone?.toLowerCase().includes(q)
        const matchesEmail = tenant.email?.toLowerCase().includes(q)
        const matchesRoom = tenant.room?.room_number?.toLowerCase().includes(q)
        const matchesProp = tenant.room?.property?.name?.toLowerCase().includes(q)
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesRoom && !matchesProp) {
          return false
        }
      }

      return true
    })
  }, [tenants, statusFilter, propertyFilter, searchQuery])

  // Modal Open Handlers
  const handleOpenAddTenant = () => {
    if (properties.length === 0 || rooms.length === 0) {
      setFeedback({
        type: 'info',
        message: 'Please add properties and rooms before registering tenants.',
      })
      return
    }
    setEditingTenant(null)
    setTenantModalOpen(true)
  }

  const handleOpenEditTenant = (tenant) => {
    setEditingTenant(tenant)
    setTenantModalOpen(true)
  }

  const handleOpenMoveOut = (tenant) => {
    setTenantToMoveOut(tenant)
    setMoveOutModalOpen(true)
  }

  const handleOpenDetail = (tenant) => {
    setSelectedTenantDetail(tenant)
    setDetailModalOpen(true)
  }

  const handlePromptDelete = (tenant) => {
    setTenantToDelete(tenant)
    setDeleteModalOpen(true)
  }

  // Tenant Submit (Create / Edit)
  const handleTenantSubmit = async (formData) => {
    setActionLoading(true)
    setFeedback(null)

    if (editingTenant) {
      const res = await updateTenant(editingTenant.id, formData, editingTenant.room_id)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({
          type: 'success',
          message: `Tenant "${formData.full_name}" updated successfully.`,
        })
        setTenantModalOpen(false)
        await loadData()
      }
    } else {
      const res = await createTenant(formData)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        const msg = res.schemaNotice
          ? `Tenant "${formData.full_name}" registered! (${res.schemaNotice})`
          : `Tenant "${formData.full_name}" registered successfully!`
        setFeedback({ type: 'success', message: msg })
        setTenantModalOpen(false)
        await loadData()
      }
    }

    setActionLoading(false)
  }

  // Move-out handler
  const handleConfirmMoveOut = async ({ moveOutDate, notes }) => {
    if (!tenantToMoveOut) return
    setActionLoading(true)
    setFeedback(null)

    const res = await moveOutTenant(tenantToMoveOut.id, { moveOutDate, notes })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error.message })
    } else {
      setFeedback({
        type: 'success',
        message: `Move-out recorded for "${tenantToMoveOut.full_name}". Room ${tenantToMoveOut.room?.room_number || ''} updated.`,
      })
      setMoveOutModalOpen(false)
      await loadData()
    }

    setActionLoading(false)
  }

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return
    setActionLoading(true)
    setFeedback(null)

    const res = await deleteTenant(tenantToDelete.id, tenantToDelete.room_id)
    if (res.error) {
      setFeedback({ type: 'error', message: res.error.message })
    } else {
      setFeedback({
        type: 'success',
        message: `Tenant record for "${tenantToDelete.full_name}" deleted.`,
      })
      setDeleteModalOpen(false)
      await loadData()
    }

    setActionLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track active occupants, room allocations, move-in and departure history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            title="Refresh tenant data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddTenant}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Register Tenant</span>
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

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Tenants</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Registered</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
              <UserMinus size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Moved Out</p>
              <p className="text-xl font-bold text-gray-900">{stats.movedOut}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DoorOpen size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Monthly Rent Roll</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenant name, phone, email, or room #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past ({stats.movedOut})
            </button>
          </div>

          {/* Property Selector */}
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Filter size={15} className="text-gray-400" />
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Tenant Listing */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs animate-pulse space-y-3"
            >
              <div className="h-5 bg-gray-200 rounded w-36" />
              <div className="h-4 bg-gray-100 rounded w-48" />
              <div className="h-4 bg-gray-100 rounded w-28" />
            </div>
          ))}
        </div>
      ) : properties.length === 0 || rooms.length === 0 ? (
        // Prompt to setup properties/rooms first
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Building2 size={24} />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Rooms Required Before Registering Tenants
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            You need to create at least one property and room before you can allocate tenants.
          </p>
          <div className="mt-5">
            <Link to="/rooms">
              <Button className="gap-2">
                <DoorOpen size={16} /> Manage Properties & Rooms
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredTenants.length === 0 ? (
        // No tenants matching filters
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-xs">
          <Users size={36} className="mx-auto text-gray-300 mb-2" />
          <h3 className="text-base font-semibold text-gray-900">No tenants found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {tenants.length === 0
              ? 'Register your first tenant to start managing your PG occupancy.'
              : 'Try clearing your search query or switching the status filter.'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {tenants.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter('all')
                  setPropertyFilter('all')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </Button>
            )}
            <Button size="sm" onClick={handleOpenAddTenant} className="gap-1.5">
              <Plus size={15} /> Register Tenant
            </Button>
          </div>
        </div>
      ) : (
        // Tenant Cards Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const rent = tenant.monthly_rent ?? tenant.room?.monthly_rent ?? 0
            const deposit = tenant.deposit_amount ?? tenant.room?.deposit_amount ?? 0

            return (
              <div
                key={tenant.id}
                className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  {/* Top row: Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(tenant)}
                          className="text-base font-bold text-gray-900 hover:text-indigo-600 text-left transition-colors truncate"
                        >
                          {tenant.full_name}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 size={13} className="text-gray-400 shrink-0" />
                        <span className="truncate">
                          {tenant.room?.property?.name || 'Property'}
                        </span>
                        <span>·</span>
                        <DoorOpen size={13} className="text-gray-400 shrink-0" />
                        <span>Room {tenant.room?.room_number || 'N/A'}</span>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                        tenant.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tenant.active ? 'Active' : 'Moved Out'}
                    </span>
                  </div>

                  {/* Contact Row */}
                  <div className="space-y-1 text-xs text-gray-600 pt-1">
                    {tenant.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone size={13} className="text-gray-400 shrink-0" />
                        <a
                          href={`tel:${tenant.phone}`}
                          className="hover:underline hover:text-indigo-600"
                        >
                          {tenant.phone}
                        </a>
                      </p>
                    )}
                    {tenant.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={13} className="text-gray-400 shrink-0" />
                        <a
                          href={`mailto:${tenant.email}`}
                          className="hover:underline hover:text-indigo-600"
                        >
                          {tenant.email}
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Financial & Stay Dates */}
                  <div className="flex items-baseline justify-between pt-2 border-t border-gray-100 text-xs">
                    <div>
                      <span className="text-base font-bold text-gray-900">
                        {formatCurrency(rent)}
                      </span>
                      <span className="text-gray-500"> /mo</span>
                    </div>

                    <div className="text-right text-gray-500">
                      <span>In: {tenant.move_in_date ? formatDate(tenant.move_in_date) : 'N/A'}</span>
                      {!tenant.active && tenant.move_out_date && (
                        <p className="text-red-600">
                          Out: {formatDate(tenant.move_out_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {deposit > 0 && (
                    <p className="text-[11px] text-gray-400 text-right">
                      Deposit: {formatCurrency(deposit)}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(tenant)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    View Details →
                  </button>

                  <div className="flex items-center gap-1">
                    {tenant.active && (
                      <button
                        type="button"
                        onClick={() => handleOpenMoveOut(tenant)}
                        className="px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
                        title="Record tenant departure"
                      >
                        <LogOut size={12} />
                        <span>Move Out</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditTenant(tenant)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition-colors"
                      title="Edit tenant details"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePromptDelete(tenant)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                      title="Delete tenant record"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <TenantModal
        key={tenantModalOpen ? editingTenant?.id || 'new-tenant' : 'closed-tenant'}
        isOpen={tenantModalOpen}
        onClose={() => setTenantModalOpen(false)}
        onSubmit={handleTenantSubmit}
        properties={properties}
        rooms={rooms}
        initialData={editingTenant}
        loading={actionLoading}
      />

      <MoveOutModal
        isOpen={moveOutModalOpen}
        onClose={() => setMoveOutModalOpen(false)}
        onConfirm={handleConfirmMoveOut}
        tenant={tenantToMoveOut}
        loading={actionLoading}
      />

      <TenantDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        tenant={selectedTenantDetail}
        onEdit={(t) => handleOpenEditTenant(t)}
        onMoveOut={(t) => handleOpenMoveOut(t)}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemType="tenant"
        itemName={tenantToDelete?.full_name}
        warningMessage="This will permanently delete this tenant. If payments are linked, consider moving them out instead to preserve financial records."
        loading={actionLoading}
      />
    </div>
  )
}
