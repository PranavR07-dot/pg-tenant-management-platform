import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  { value: 'partial', label: 'Partial', color: 'bg-orange-100 text-orange-800' },
  { value: 'waived', label: 'Waived', color: 'bg-gray-100 text-gray-700' },
]

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI / QR Code' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer (IMPS/NEFT)' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
]

/**
 * Fetches all payments for the owner's tenants, with joined tenant, room, and property information.
 */
export async function fetchPayments(filters = {}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('payments')
    .select(
      '*, tenant:tenants(id, full_name, phone, email, active, room:rooms(id, room_number, floor, monthly_rent, property:properties(id, name, city)))'
    )
    .order('due_date', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.method && filters.method !== 'all') {
    query = query.eq('method', filters.method)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error }
  }

  let results = data || []

  // Automatic overdue check on client: if status is 'pending' and due_date < today
  const todayStr = new Date().toISOString().slice(0, 10)
  results = results.map((p) => {
    if (p.status === 'pending' && p.due_date && p.due_date < todayStr) {
      return { ...p, isPastDue: true }
    }
    return { ...p, isPastDue: false }
  })

  // Filter by property if specified
  if (filters.propertyId && filters.propertyId !== 'all') {
    results = results.filter((p) => p.tenant?.room?.property?.id === filters.propertyId)
  }

  // Filter by search query
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    results = results.filter(
      (p) =>
        p.tenant?.full_name?.toLowerCase().includes(q) ||
        p.tenant?.phone?.toLowerCase().includes(q) ||
        p.tenant?.room?.room_number?.toLowerCase().includes(q) ||
        p.tenant?.room?.property?.name?.toLowerCase().includes(q) ||
        p.reference_no?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
    )
  }

  return { data: results, error: null }
}

/**
 * Records a new payment.
 */
export async function createPayment(paymentData) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!paymentData.tenant_id) {
    return { data: null, error: new Error('Please select a tenant.') }
  }

  const amountVal = Number(paymentData.amount)
  if (isNaN(amountVal) || amountVal <= 0) {
    return { data: null, error: new Error('Payment amount must be greater than 0.') }
  }

  if (!paymentData.due_date) {
    return { data: null, error: new Error('Due date is required.') }
  }

  const payload = {
    tenant_id: paymentData.tenant_id,
    amount: amountVal,
    due_date: paymentData.due_date,
    paid_date: paymentData.status === 'paid' ? (paymentData.paid_date || new Date().toISOString().slice(0, 10)) : (paymentData.paid_date || null),
    status: paymentData.status || 'pending',
    method: paymentData.method || null,
    reference_no: paymentData.reference_no?.trim() || null,
    notes: paymentData.notes?.trim() || null,
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(payload)
    .select(
      '*, tenant:tenants(id, full_name, phone, room:rooms(id, room_number, property:properties(id, name)))'
    )
    .single()

  return { data, error }
}

/**
 * Updates an existing payment.
 */
export async function updatePayment(paymentId, updates) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const amountVal = Number(updates.amount)
  if (isNaN(amountVal) || amountVal <= 0) {
    return { data: null, error: new Error('Payment amount must be greater than 0.') }
  }

  const payload = {
    amount: amountVal,
    due_date: updates.due_date,
    paid_date: updates.status === 'paid' ? (updates.paid_date || new Date().toISOString().slice(0, 10)) : (updates.paid_date || null),
    status: updates.status,
    method: updates.method || null,
    reference_no: updates.reference_no?.trim() || null,
    notes: updates.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId)
    .select(
      '*, tenant:tenants(id, full_name, phone, room:rooms(id, room_number, property:properties(id, name)))'
    )
    .single()

  return { data, error }
}

/**
 * Quick action to mark a pending or overdue payment as paid.
 */
export async function markPaymentAsPaid(paymentId, { method, referenceNo, paidDate, notes } = {}) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const payload = {
    status: 'paid',
    method: method || 'upi',
    reference_no: referenceNo?.trim() || null,
    paid_date: paidDate || new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }

  if (notes?.trim()) {
    payload.notes = notes.trim()
  }

  const { data, error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId)
    .select(
      '*, tenant:tenants(id, full_name, phone, room:rooms(id, room_number, property:properties(id, name)))'
    )
    .single()

  return { data, error }
}

/**
 * Deletes a payment record.
 */
export async function deletePayment(paymentId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  return { success: !error, error }
}

/**
 * Batch generates rent records for all active tenants for a given month.
 * Avoids duplicate bills if a tenant already has a payment due in that month.
 */
export async function generateMonthlyRentBills({ year, month, dueDate }) {
  if (!isSupabaseConfigured()) {
    return { createdCount: 0, skippedCount: 0, error: new Error('Supabase is not configured.') }
  }

  // 1. Fetch active tenants with their room rent
  const { data: activeTenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, full_name, monthly_rent, room:rooms(monthly_rent)')
    .eq('active', true)

  if (tenantErr) {
    return { createdCount: 0, skippedCount: 0, error: tenantErr }
  }

  if (!activeTenants || activeTenants.length === 0) {
    return { createdCount: 0, skippedCount: 0, error: new Error('No active tenants found to bill.') }
  }

  // 2. Determine start and end date of the month to check existing bills
  const y = Number(year)
  const m = Number(month) // 1-12
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: existingPayments, error: payErr } = await supabase
    .from('payments')
    .select('tenant_id')
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)

  if (payErr) {
    return { createdCount: 0, skippedCount: 0, error: payErr }
  }

  const billedTenantIds = new Set((existingPayments || []).map((p) => p.tenant_id))

  const newRecords = []
  let skippedCount = 0

  const targetDueDate = dueDate || `${y}-${String(m).padStart(2, '0')}-05`

  for (const t of activeTenants) {
    if (billedTenantIds.has(t.id)) {
      skippedCount++
      continue
    }

    const rentAmount = Number(t.monthly_rent ?? t.room?.monthly_rent ?? 0)
    if (rentAmount <= 0) {
      skippedCount++
      continue
    }

    newRecords.push({
      tenant_id: t.id,
      amount: rentAmount,
      due_date: targetDueDate,
      status: 'pending',
      notes: `Rent for ${new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
    })
  }

  if (newRecords.length === 0) {
    return { createdCount: 0, skippedCount, error: null }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('payments')
    .insert(newRecords)
    .select('id')

  if (insertErr) {
    return { createdCount: 0, skippedCount, error: insertErr }
  }

  return { createdCount: inserted?.length || 0, skippedCount, error: null }
}
