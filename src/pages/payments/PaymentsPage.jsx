import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  Filter,
  Info,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { fetchProperties } from '@/services/propertyService'
import { fetchTenants } from '@/services/tenantService'
import {
  createPayment,
  deletePayment,
  fetchPayments,
  generateMonthlyRentBills,
  markPaymentAsPaid,
  updatePayment,
} from '@/services/paymentService'
import PaymentModal from './PaymentModal'
import MarkAsPaidModal from './MarkAsPaidModal'
import GenerateBillsModal from './GenerateBillsModal'
import DeleteConfirmModal from '../rooms/DeleteConfirmModal'

// Pure helper functions outside component to satisfy purity rules
function computePaymentMetrics(payments) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const todayStr = now.toISOString().slice(0, 10)

  let collectedThisMonth = 0
  let pendingAmount = 0
  let pendingCount = 0
  let overdueAmount = 0
  let overdueCount = 0
  let allTimeCollected = 0

  payments.forEach((p) => {
    const amt = Number(p.amount) || 0

    if (p.status === 'paid') {
      allTimeCollected += amt
      if (p.paid_date) {
        const d = new Date(p.paid_date)
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          collectedThisMonth += amt
        }
      }
    } else if (p.status === 'pending') {
      pendingAmount += amt
      pendingCount += 1
      if (p.due_date && p.due_date < todayStr) {
        overdueAmount += amt
        overdueCount += 1
      }
    } else if (p.status === 'overdue') {
      overdueAmount += amt
      overdueCount += 1
      pendingAmount += amt
      pendingCount += 1
    }
  })

  return {
    collectedThisMonth,
    pendingAmount,
    pendingCount,
    overdueAmount,
    overdueCount,
    allTimeCollected,
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

export default function PaymentsPage() {
  const isMountedRef = useRef(true)

  // Data states
  const [payments, setPayments] = useState([])
  const [tenants, setTenants] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all') // 'all'|'paid'|'pending'|'overdue'|'partial'|'waived'
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)

  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false)
  const [paymentToMarkPaid, setPaymentToMarkPaid] = useState(null)

  const [generateBillsOpen, setGenerateBillsOpen] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState(null)

  // Load payments, tenants, and properties
  const handleLoadResults = useCallback(([payRes, tenantRes, propRes]) => {
    if (!isMountedRef.current) return

    if (payRes.error) {
      setFeedback({ type: 'error', message: `Payments: ${payRes.error.message}` })
    } else {
      setPayments(payRes.data)
    }

    if (tenantRes.error) {
      console.warn('Tenants load error:', tenantRes.error.message)
    } else {
      setTenants(tenantRes.data)
    }

    if (propRes.error) {
      console.warn('Properties load error:', propRes.error.message)
    } else {
      setProperties(propRes.data)
    }

    setLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all([
      fetchPayments(),
      fetchTenants({ status: 'active' }),
      fetchProperties(),
    ])
    handleLoadResults(results)
  }, [handleLoadResults])

  useEffect(() => {
    isMountedRef.current = true
    Promise.all([
      fetchPayments(),
      fetchTenants({ status: 'active' }),
      fetchProperties(),
    ]).then(handleLoadResults)

    return () => {
      isMountedRef.current = false
    }
  }, [handleLoadResults])

  // Calculated KPI stats
  const metrics = useMemo(() => computePaymentMetrics(payments), [payments])

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    const todayStr = getTodayString()

    return payments.filter((payment) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
          const isOverdue =
            payment.status === 'overdue' ||
            (payment.status === 'pending' && payment.due_date && payment.due_date < todayStr)
          if (!isOverdue) return false
        } else if (payment.status !== statusFilter) {
          return false
        }
      }

      // Method filter
      if (methodFilter !== 'all' && payment.method !== methodFilter) {
        return false
      }

      // Property filter
      if (propertyFilter !== 'all' && payment.tenant?.room?.property?.id !== propertyFilter) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesTenant = payment.tenant?.full_name?.toLowerCase().includes(q)
        const matchesPhone = payment.tenant?.phone?.toLowerCase().includes(q)
        const matchesRoom = payment.tenant?.room?.room_number?.toLowerCase().includes(q)
        const matchesProp = payment.tenant?.room?.property?.name?.toLowerCase().includes(q)
        const matchesRef = payment.reference_no?.toLowerCase().includes(q)
        const matchesNotes = payment.notes?.toLowerCase().includes(q)

        if (
          !matchesTenant &&
          !matchesPhone &&
          !matchesRoom &&
          !matchesProp &&
          !matchesRef &&
          !matchesNotes
        ) {
          return false
        }
      }

      return true
    })
  }, [payments, statusFilter, methodFilter, propertyFilter, searchQuery])

  // Handlers for Modals
  const handleOpenAddPayment = () => {
    if (tenants.length === 0) {
      setFeedback({
        type: 'info',
        message: 'Please register at least one active tenant before recording payments.',
      })
      return
    }
    setEditingPayment(null)
    setPaymentModalOpen(true)
  }

  const handleOpenEditPayment = (payment) => {
    setEditingPayment(payment)
    setPaymentModalOpen(true)
  }

  const handleOpenMarkPaid = (payment) => {
    setPaymentToMarkPaid(payment)
    setMarkPaidModalOpen(true)
  }

  const handlePromptDelete = (payment) => {
    setPaymentToDelete(payment)
    setDeleteModalOpen(true)
  }

  // Payment Submit (Create / Edit)
  const handlePaymentSubmit = async (formData) => {
    setActionLoading(true)
    setFeedback(null)

    if (editingPayment) {
      const res = await updatePayment(editingPayment.id, formData)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({ type: 'success', message: 'Payment record updated successfully.' })
        setPaymentModalOpen(false)
        await loadData()
      }
    } else {
      const res = await createPayment(formData)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error.message })
      } else {
        setFeedback({ type: 'success', message: 'Payment record created successfully.' })
        setPaymentModalOpen(false)
        await loadData()
      }
    }

    setActionLoading(false)
  }

  // Quick Mark as Paid
  const handleConfirmMarkPaid = async (settlementData) => {
    if (!paymentToMarkPaid) return
    setActionLoading(true)
    setFeedback(null)

    const res = await markPaymentAsPaid(paymentToMarkPaid.id, settlementData)
    if (res.error) {
      setFeedback({ type: 'error', message: res.error.message })
    } else {
      setFeedback({
        type: 'success',
        message: `Settlement recorded for ${paymentToMarkPaid.tenant?.full_name || 'tenant'} (${formatCurrency(paymentToMarkPaid.amount)}).`,
      })
      setMarkPaidModalOpen(false)
      await loadData()
    }

    setActionLoading(false)
  }

  // Batch Monthly Rent Generation
  const handleGenerateMonthlyBills = async ({ year, month, dueDate }) => {
    setActionLoading(true)
    setFeedback(null)

    const res = await generateMonthlyRentBills({ year, month, dueDate })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error.message })
    } else {
      if (res.createdCount > 0) {
        setFeedback({
          type: 'success',
          message: `Generated ${res.createdCount} rent invoice(s). Skipped ${res.skippedCount} tenant(s) already billed.`,
        })
      } else {
        setFeedback({
          type: 'info',
          message: `All ${res.skippedCount} active tenant(s) already have bills recorded for this month. No new records created.`,
        })
      }
      setGenerateBillsOpen(false)
      await loadData()
    }

    setActionLoading(false)
  }

  // Delete payment
  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return
    setActionLoading(true)
    setFeedback(null)

    const res = await deletePayment(paymentToDelete.id)
    if (res.error) {
      setFeedback({ type: 'error', message: res.error.message })
    } else {
      setFeedback({ type: 'success', message: 'Payment record deleted successfully.' })
      setDeleteModalOpen(false)
      await loadData()
    }

    setActionLoading(false)
  }

  // Status Badge Rendering
  const renderStatusBadge = (payment) => {
    const todayStr = getTodayString()
    const isOverdue =
      payment.status === 'overdue' ||
      (payment.status === 'pending' && payment.due_date && payment.due_date < todayStr)

    if (payment.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 size={12} /> Paid
        </span>
      )
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          <AlertTriangle size={12} /> Overdue
        </span>
      )
    }

    if (payment.status === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
          <Clock size={12} /> Partial
        </span>
      )
    }

    if (payment.status === 'waived') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
          Waived
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        <Clock size={12} /> Pending
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments & Collections</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track rent collections, pending dues, settlements, and payment receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            title="Refresh payment data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setGenerateBillsOpen(true)}
            className="flex items-center gap-1.5"
            disabled={tenants.length === 0}
            title="Batch generate monthly invoices"
          >
            <Sparkles size={15} className="text-indigo-600" />
            <span className="hidden sm:inline">Generate Invoices</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddPayment}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Record Payment</span>
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

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Collected (This Month)</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(metrics.collectedThisMonth)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending Dues</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(metrics.pendingAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Overdue Amount</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(metrics.overdueAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">All-Time Revenue</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(metrics.allTimeCollected)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenant, room, UTR/ref #, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({metrics.pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'overdue'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overdue ({metrics.overdueCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'paid'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Paid
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

      {/* Main Payment Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded w-full" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        // Prompt to register tenants first
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Users size={24} />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Tenants Required to Track Rent
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            You need to register active tenants before you can record or track rent payments.
          </p>
          <div className="mt-5">
            <Link to="/tenants">
              <Button className="gap-2">
                <Users size={16} /> Register First Tenant
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredPayments.length === 0 ? (
        // No payments recorded yet
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-xs">
          <CreditCard size={36} className="mx-auto text-gray-300 mb-2" />
          <h3 className="text-base font-semibold text-gray-900">No payment records found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {payments.length === 0
              ? 'Start tracking rent by recording received payments or generating monthly invoices.'
              : 'Try clearing your search query or switching your status filter.'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {payments.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter('all')
                  setPropertyFilter('all')
                  setMethodFilter('all')
                  setSearchQuery('')
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setGenerateBillsOpen(true)}
                className="gap-1.5"
              >
                <Sparkles size={15} /> Generate Monthly Invoices
              </Button>
            )}
            <Button size="sm" onClick={handleOpenAddPayment} className="gap-1.5">
              <Plus size={15} /> Record Payment
            </Button>
          </div>
        </div>
      ) : (
        /* Payments Table */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Tenant & Room</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Settlement Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((p) => {
                  const isSettled = p.status === 'paid'

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Tenant & Room */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 truncate">
                          {p.tenant?.full_name || 'Tenant'}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <DoorOpen size={12} className="text-gray-400" />
                          <span>Room {p.tenant?.room?.room_number || 'N/A'}</span>
                          {p.tenant?.room?.property?.name && (
                            <>
                              <span>·</span>
                              <span className="truncate">{p.tenant.room.property.name}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {formatCurrency(p.amount)}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {p.due_date ? formatDate(p.due_date) : 'N/A'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{renderStatusBadge(p)}</td>

                      {/* Settlement info */}
                      <td className="py-3.5 px-4 text-xs text-gray-600">
                        {isSettled ? (
                          <div className="space-y-0.5">
                            <span className="font-medium text-gray-800 capitalize">
                              {p.method ? p.method.replace('_', ' ') : 'Paid'}
                            </span>
                            {p.paid_date && (
                              <p className="text-gray-400">on {formatDate(p.paid_date)}</p>
                            )}
                            {p.reference_no && (
                              <p className="text-gray-400 font-mono text-[11px] truncate max-w-xs">
                                Ref: {p.reference_no}
                              </p>
                            )}
                          </div>
                        ) : p.notes ? (
                          <span className="text-gray-500 italic truncate max-w-xs block">
                            {p.notes}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Unsettled</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isSettled && (
                            <button
                              type="button"
                              onClick={() => handleOpenMarkPaid(p)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1"
                              title="Mark as paid"
                            >
                              <CheckCircle2 size={13} />
                              <span className="hidden sm:inline">Mark Paid</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(p)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Edit payment"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePromptDelete(p)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md transition-colors"
                            title="Delete payment"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <PaymentModal
        key={paymentModalOpen ? editingPayment?.id || 'new-pay' : 'closed-pay'}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        tenants={tenants}
        initialData={editingPayment}
        loading={actionLoading}
      />

      <MarkAsPaidModal
        key={markPaidModalOpen ? paymentToMarkPaid?.id || 'mark-paid' : 'closed-mark'}
        isOpen={markPaidModalOpen}
        onClose={() => setMarkPaidModalOpen(false)}
        onConfirm={handleConfirmMarkPaid}
        payment={paymentToMarkPaid}
        loading={actionLoading}
      />

      <GenerateBillsModal
        isOpen={generateBillsOpen}
        onClose={() => setGenerateBillsOpen(false)}
        onGenerate={handleGenerateMonthlyBills}
        activeTenantsCount={tenants.length}
        loading={actionLoading}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemType="payment"
        itemName={paymentToDelete ? `${formatCurrency(paymentToDelete.amount)} for ${paymentToDelete.tenant?.full_name || 'Tenant'}` : ''}
        warningMessage="This will permanently delete this payment transaction record."
        loading={actionLoading}
      />
    </div>
  )
}
