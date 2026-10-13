import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// ─── Shared query helpers ─────────────────────────────────────────────────────

/**
 * Returns the ISO date string for the first day of a given month offset from today.
 * offset=0 → current month start, offset=-1 → previous month start, etc.
 * @param {number} offset
 * @returns {string} e.g. "2026-09-01"
 */
function monthStart(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the ISO date string for the last day of a given month offset from today.
 * @param {number} offset
 * @returns {string} e.g. "2026-09-30"
 */
function monthEnd(offset = 0) {
  const d = new Date()
  // Move to first of next month, then subtract a day
  d.setDate(1)
  d.setMonth(d.getMonth() + offset + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns a label like "Sep 2026" for the month at a given offset.
 * @param {number} offset
 * @returns {string}
 */
function monthLabel(offset = 0) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

// ─── Report 1: Monthly Revenue Trend (last 12 months) ────────────────────────

/**
 * Fetches paid payments for the last 12 months and aggregates by month.
 *
 * @returns {Promise<{
 *   data: Array<{ label: string, collected: number, pending: number, overdue: number }>,
 *   error: string | null
 * }>}
 */
export async function fetchMonthlyRevenueTrend() {
  if (!isSupabaseConfigured()) {
    return { data: [], error: 'Supabase is not configured.' }
  }

  // Fetch all payments from the past 12 months (due_date in range)
  const rangeStart = monthStart(-11)
  const rangeEnd = monthEnd(0)

  const { data, error } = await supabase
    .from('payments')
    .select('amount, status, due_date, paid_date')
    .gte('due_date', rangeStart)
    .lte('due_date', rangeEnd)
    .order('due_date', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  // Build a slot for each of the 12 months
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: monthLabel(i - 11),
    // e.g. "2026-09" — key for bucketing
    key: monthStart(i - 11).slice(0, 7),
    collected: 0,
    pending: 0,
    overdue: 0,
  }))

  const keyMap = Object.fromEntries(months.map((m, idx) => [m.key, idx]))

  for (const p of data || []) {
    const key = (p.due_date || '').slice(0, 7)
    const idx = keyMap[key]
    if (idx === undefined) continue
    const amt = Number(p.amount) || 0
    if (p.status === 'paid' || p.status === 'partial') {
      months[idx].collected += amt
    } else if (p.status === 'pending') {
      months[idx].pending += amt
    } else if (p.status === 'overdue') {
      months[idx].overdue += amt
    }
    // waived — not counted in any
  }

  return { data: months, error: null }
}

// ─── Report 2: Occupancy by Property ─────────────────────────────────────────

/**
 * Fetches properties with their room counts and status breakdown.
 *
 * @returns {Promise<{
 *   data: Array<{
 *     id: string, name: string, city: string,
 *     total: number, occupied: number, vacant: number, maintenance: number,
 *     occupancyPct: number
 *   }>,
 *   error: string | null
 * }>}
 */
export async function fetchOccupancyByProperty() {
  if (!isSupabaseConfigured()) {
    return { data: [], error: 'Supabase is not configured.' }
  }

  const { data, error } = await supabase
    .from('properties')
    .select('id, name, city, rooms(id, status)')
    .order('name', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  const result = (data || []).map((p) => {
    const rooms = p.rooms || []
    const total = rooms.length
    const occupied = rooms.filter((r) => r.status === 'occupied').length
    const vacant = rooms.filter((r) => r.status === 'vacant').length
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length
    const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0
    return { id: p.id, name: p.name, city: p.city, total, occupied, vacant, maintenance, occupancyPct }
  })

  return { data: result, error: null }
}

// ─── Report 3: Tenant Summary (active vs. moved-out, new this month) ─────────

/**
 * Fetches tenant move-in/move-out data for the past 12 months,
 * returning monthly active tenant counts and move-out events.
 *
 * @returns {Promise<{
 *   data: {
 *     currentActive: number,
 *     movedOutThisYear: number,
 *     newThisMonth: number,
 *     avgTenancy: number,        // average tenancy in days for moved-out tenants
 *     retentionRate: number,     // % who stayed >3 months out of those who moved out
 *     recentMovements: Array<{
 *       full_name: string,
 *       move_in_date: string,
 *       move_out_date: string | null,
 *       active: boolean,
 *       room: string,
 *       property: string
 *     }>
 *   },
 *   error: string | null
 * }>}
 */
export async function fetchTenantSummary() {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase is not configured.' }
  }

  const { data, error } = await supabase
    .from('tenants')
    .select(
      'id, full_name, active, move_in_date, move_out_date, room:rooms(room_number, property:properties(name))'
    )
    .order('move_in_date', { ascending: false })

  if (error) {
    return { data: null, error: error.message }
  }

  const tenants = data || []
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
  const thisMonthStart = monthStart(0)

  const currentActive = tenants.filter((t) => t.active).length
  const movedOutThisYear = tenants.filter(
    (t) => !t.active && t.move_out_date >= yearStart
  ).length
  const newThisMonth = tenants.filter(
    (t) => t.move_in_date && t.move_in_date >= thisMonthStart
  ).length

  // Average tenancy duration for tenants who have moved out
  const movedOut = tenants.filter((t) => !t.active && t.move_in_date && t.move_out_date)
  let avgTenancy = 0
  if (movedOut.length > 0) {
    const totalDays = movedOut.reduce((sum, t) => {
      const inDate = new Date(t.move_in_date)
      const outDate = new Date(t.move_out_date)
      return sum + Math.max(0, (outDate - inDate) / (1000 * 60 * 60 * 24))
    }, 0)
    avgTenancy = Math.round(totalDays / movedOut.length)
  }

  // Retention rate: % of moved-out tenants who stayed at least 90 days
  const retentionRate =
    movedOut.length > 0
      ? Math.round(
          (movedOut.filter((t) => {
            const days = (new Date(t.move_out_date) - new Date(t.move_in_date)) / (1000 * 60 * 60 * 24)
            return days >= 90
          }).length /
            movedOut.length) *
            100
        )
      : 0

  // Most recent 15 movements (both active and moved-out)
  const recentMovements = tenants.slice(0, 15).map((t) => ({
    full_name: t.full_name,
    move_in_date: t.move_in_date,
    move_out_date: t.move_out_date,
    active: t.active,
    room: t.room?.room_number || '—',
    property: t.room?.property?.name || '—',
  }))

  return {
    data: { currentActive, movedOutThisYear, newThisMonth, avgTenancy, retentionRate, recentMovements },
    error: null,
  }
}

// ─── Report 4: Payment Method & Collection Efficiency ────────────────────────

/**
 * Fetches all payments and calculates method distribution and collection efficiency.
 *
 * @returns {Promise<{
 *   data: {
 *     methodBreakdown: Array<{ method: string, label: string, count: number, amount: number, pct: number }>,
 *     collectionEfficiency: number, // % of due bills that were paid
 *     totalBilled: number,
 *     totalCollected: number,
 *     totalPending: number,
 *     totalOverdue: number,
 *     totalWaived: number,
 *     statusBreakdown: Array<{ status: string, count: number, amount: number, pct: number }>
 *   },
 *   error: string | null
 * }>}
 */
export async function fetchPaymentAnalytics() {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase is not configured.' }
  }

  const { data, error } = await supabase
    .from('payments')
    .select('amount, status, method')

  if (error) {
    return { data: null, error: error.message }
  }

  const payments = data || []

  // Method breakdown
  const METHOD_LABELS = {
    upi: 'UPI / QR',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    other: 'Other',
    null: 'Not Recorded',
  }

  const methodMap = {}
  let totalBilled = 0
  let totalCollected = 0
  let totalPending = 0
  let totalOverdue = 0
  let totalWaived = 0

  const statusCounts = { paid: 0, pending: 0, overdue: 0, partial: 0, waived: 0 }
  const statusAmounts = { paid: 0, pending: 0, overdue: 0, partial: 0, waived: 0 }

  for (const p of payments) {
    const amt = Number(p.amount) || 0
    totalBilled += amt

    // Status buckets
    const st = p.status || 'pending'
    statusCounts[st] = (statusCounts[st] || 0) + 1
    statusAmounts[st] = (statusAmounts[st] || 0) + amt

    if (st === 'paid') totalCollected += amt
    else if (st === 'pending') totalPending += amt
    else if (st === 'overdue') totalOverdue += amt
    else if (st === 'waived') totalWaived += amt

    // Method counts only for paid payments (method only meaningful then)
    if (st === 'paid' || st === 'partial') {
      const key = p.method || 'null'
      if (!methodMap[key]) methodMap[key] = { count: 0, amount: 0 }
      methodMap[key].count += 1
      methodMap[key].amount += amt
    }
  }

  const totalMethodAmount = Object.values(methodMap).reduce((s, v) => s + v.amount, 0)
  const methodBreakdown = Object.entries(methodMap)
    .map(([method, { count, amount }]) => ({
      method,
      label: METHOD_LABELS[method] || method,
      count,
      amount,
      pct: totalMethodAmount > 0 ? Math.round((amount / totalMethodAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const collectionEfficiency =
    totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0

  const totalPayments = payments.length
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    amount: statusAmounts[status] || 0,
    pct: totalPayments > 0 ? Math.round((count / totalPayments) * 100) : 0,
  }))

  return {
    data: {
      methodBreakdown,
      collectionEfficiency,
      totalBilled,
      totalCollected,
      totalPending,
      totalOverdue,
      totalWaived,
      statusBreakdown,
    },
    error: null,
  }
}

// ─── Composite: fetch all report data in parallel ────────────────────────────

/**
 * Fetches all analytics sections concurrently.
 * @returns {Promise<{
 *   revenue: Awaited<ReturnType<typeof fetchMonthlyRevenueTrend>>,
 *   occupancy: Awaited<ReturnType<typeof fetchOccupancyByProperty>>,
 *   tenants: Awaited<ReturnType<typeof fetchTenantSummary>>,
 *   payments: Awaited<ReturnType<typeof fetchPaymentAnalytics>>,
 * }>}
 */
export async function fetchAllReportData() {
  const [revenue, occupancy, tenants, payments] = await Promise.all([
    fetchMonthlyRevenueTrend(),
    fetchOccupancyByProperty(),
    fetchTenantSummary(),
    fetchPaymentAnalytics(),
  ])
  return { revenue, occupancy, tenants, payments }
}
