import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Determines whether an error from Supabase indicates a missing table
 * (relation does not exist, not found in PostgREST schema cache, etc.)
 *
 * @param {any} error
 * @returns {boolean}
 */
function isMissingTableError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST200' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '404' ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  )
}

/**
 * Fetches all dashboard statistics for the currently authenticated PG owner.
 *
 * Returns counts and derived metrics from: properties, rooms, tenants, payments.
 * If any core table does not exist in Supabase yet, it is reported as `tablesMissing: true`
 * alongside the list of missing tables, rather than an unhandled error.
 *
 * @returns {Promise<{
 *   data: {
 *     totalRooms: number,
 *     vacantRooms: number,
 *     occupiedRooms: number,
 *     activeTenants: number,
 *     monthlyRevenue: number,
 *     pendingPayments: number,
 *     overduePayments: number,
 *     occupancyRate: number,
 *     totalProperties: number,
 *   } | null,
 *   tablesMissing: boolean,
 *   missingTables: string[],
 *   error: string | null
 * }>}
 */
export async function fetchDashboardStats() {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      tablesMissing: false,
      missingTables: [],
      error: 'Supabase credentials are not configured. Check your .env.local file.',
    }
  }

  const missingTables = []

  // Helper: run a query and catch "table does not exist" / schema cache errors gracefully
  async function safeQuery(tableName, queryFn) {
    try {
      const result = await queryFn()
      if (result.error) {
        if (isMissingTableError(result.error)) {
          missingTables.push(tableName)
          return null
        }
        // Other database error — surface it clearly
        throw new Error(`[${tableName}] ${result.error.message}`)
      }
      return result
    } catch (err) {
      if (isMissingTableError(err)) {
        missingTables.push(tableName)
        return null
      }
      throw err
    }
  }

  try {
    // Run all queries in parallel for performance.
    // Avoid head: true so PostgREST returns accurate schema cache errors for missing tables.
    const [propertiesResult, roomsResult, tenantsResult, paymentsResult] = await Promise.all([
      // Total properties owned by this user
      safeQuery('properties', () =>
        supabase
          .from('properties')
          .select('id', { count: 'exact' })
      ),

      // Room counts by status & rent
      safeQuery('rooms', () =>
        supabase
          .from('rooms')
          .select('id, status, monthly_rent', { count: 'exact' })
      ),

      // Active tenants count
      safeQuery('tenants', () =>
        supabase
          .from('tenants')
          .select('id', { count: 'exact' })
          .eq('active', true)
      ),

      // This month's payments
      safeQuery('payments', () => {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
        return supabase
          .from('payments')
          .select('amount, status, due_date')
          .gte('due_date', monthStart)
          .lte('due_date', monthEnd)
      }),
    ])

    if (missingTables.length > 0) {
      return { data: null, tablesMissing: true, missingTables, error: null }
    }

    // --- Derive stats from query results ---
    const totalProperties = propertiesResult?.count ?? (propertiesResult?.data?.length ?? 0)

    const rooms = roomsResult?.data ?? []
    const totalRooms = roomsResult?.count ?? rooms.length
    const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
    const vacantRooms = rooms.filter((r) => r.status === 'vacant').length
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

    // Monthly revenue = sum of monthly_rent for occupied rooms
    const monthlyRevenue = rooms
      .filter((r) => r.status === 'occupied')
      .reduce((sum, r) => sum + Number(r.monthly_rent || 0), 0)

    const activeTenants = tenantsResult?.count ?? (tenantsResult?.data?.length ?? 0)

    const payments = paymentsResult?.data ?? []
    const pendingPayments = payments.filter((p) => p.status === 'pending').length
    const overduePayments = payments.filter((p) => p.status === 'overdue').length

    return {
      data: {
        totalProperties,
        totalRooms,
        vacantRooms,
        occupiedRooms,
        activeTenants,
        monthlyRevenue,
        pendingPayments,
        overduePayments,
        occupancyRate,
      },
      tablesMissing: false,
      missingTables: [],
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      tablesMissing: false,
      missingTables: [],
      error: err.message || 'An unexpected error occurred while fetching dashboard data.',
    }
  }
}

