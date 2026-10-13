import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Checks whether a room has space for a new tenant.
 *
 * @param {string} roomId
 * @param {string|null} excludeTenantId - Excludes a tenant when checking during an edit
 * @returns {Promise<{ available: boolean, reason?: string, capacity: number, activeCount: number, remaining: number }>}
 */
export async function checkRoomAvailability(roomId, excludeTenantId = null) {
  if (!isSupabaseConfigured() || !roomId) {
    return { available: false, reason: 'Invalid room or configuration.', capacity: 1, activeCount: 0, remaining: 0 }
  }

  // Fetch room details
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, room_number, status, capacity')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return { available: false, reason: 'Room not found.', capacity: 1, activeCount: 0, remaining: 0 }
  }

  if (room.status === 'maintenance') {
    return {
      available: false,
      reason: `Room ${room.room_number} is currently marked for maintenance.`,
      capacity: room.capacity || 1,
      activeCount: 0,
      remaining: 0,
    }
  }

  // Query active occupants in this room
  let query = supabase
    .from('tenants')
    .select('id', { count: 'exact' })
    .eq('room_id', roomId)
    .eq('active', true)

  if (excludeTenantId) {
    query = query.neq('id', excludeTenantId)
  }

  const { count, error: countError } = await query
  if (countError) {
    return { available: false, reason: 'Could not verify occupancy count.', capacity: room.capacity || 1, activeCount: 0, remaining: 0 }
  }

  const activeCount = count ?? 0
  const capacity = room.capacity || 1
  const remaining = Math.max(0, capacity - activeCount)

  if (remaining <= 0) {
    return {
      available: false,
      reason: `Room ${room.room_number} is at full capacity (${activeCount}/${capacity} occupied).`,
      capacity,
      activeCount,
      remaining: 0,
    }
  }

  return {
    available: true,
    capacity,
    activeCount,
    remaining,
  }
}

/**
 * Synchronizes room status based on remaining active tenants.
 */
export async function syncRoomOccupancy(roomId) {
  if (!roomId || !isSupabaseConfigured()) return

  try {
    const { count } = await supabase
      .from('tenants')
      .select('id', { count: 'exact' })
      .eq('room_id', roomId)
      .eq('active', true)

    const activeCount = count ?? 0

    // Fetch current room status to avoid overwriting 'maintenance'
    const { data: room } = await supabase
      .from('rooms')
      .select('status')
      .eq('id', roomId)
      .single()

    if (!room || room.status === 'maintenance') return

    const nextStatus = activeCount > 0 ? 'occupied' : 'vacant'
    if (room.status !== nextStatus) {
      await supabase
        .from('rooms')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', roomId)
    }
  } catch (err) {
    console.warn('[tenantService] syncRoomOccupancy error:', err.message)
  }
}

/**
 * Fetches tenants, joined with room, property, and payment history.
 */
export async function fetchTenants(filters = {}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('tenants')
    .select(
      '*, room:rooms(id, room_number, floor, monthly_rent, deposit_amount, status, capacity, property_id, property:properties(id, name, city)), payments(id, amount, status, due_date)'
    )
    .order('created_at', { ascending: false })

  if (filters.status === 'active') {
    query = query.eq('active', true)
  } else if (filters.status === 'inactive') {
    query = query.eq('active', false)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error }
  }

  let results = data || []

  // Filter by property if specified
  if (filters.propertyId && filters.propertyId !== 'all') {
    results = results.filter((t) => t.room?.property_id === filters.propertyId)
  }

  // Filter by search query (name, phone, email, room number)
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    results = results.filter(
      (t) =>
        t.full_name?.toLowerCase().includes(s) ||
        t.phone?.toLowerCase().includes(s) ||
        t.email?.toLowerCase().includes(s) ||
        t.room?.room_number?.toLowerCase().includes(s) ||
        t.room?.property?.name?.toLowerCase().includes(s)
    )
  }

  return { data: results, error: null }
}

/**
 * Fetches a single tenant by ID.
 */
export async function getTenantById(tenantId) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('tenants')
    .select(
      '*, room:rooms(id, room_number, floor, monthly_rent, deposit_amount, status, capacity, property_id, property:properties(id, name, city)), payments(*)'
    )
    .eq('id', tenantId)
    .single()

  return { data, error }
}

/**
 * Creates a new tenant and assigns them to an available room.
 */
export async function createTenant(tenantData) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!tenantData.full_name?.trim()) {
    return { data: null, error: new Error('Tenant full name is required.') }
  }

  if (!tenantData.room_id) {
    return { data: null, error: new Error('Please assign a room to the tenant.') }
  }

  if (!tenantData.move_in_date) {
    return { data: null, error: new Error('Move-in date is required.') }
  }

  // Validate room availability and capacity
  const availability = await checkRoomAvailability(tenantData.room_id)
  if (!availability.available) {
    return { data: null, error: new Error(availability.reason || 'Selected room is not available.') }
  }

  const rentVal = tenantData.monthly_rent !== '' && tenantData.monthly_rent != null
    ? Number(tenantData.monthly_rent)
    : null

  const depositVal = tenantData.deposit_amount !== '' && tenantData.deposit_amount != null
    ? Number(tenantData.deposit_amount)
    : null

  const fullPayload = {
    room_id: tenantData.room_id,
    full_name: tenantData.full_name.trim(),
    email: tenantData.email?.trim() || null,
    phone: tenantData.phone?.trim() || null,
    emergency_contact: tenantData.emergency_contact?.trim() || null,
    move_in_date: tenantData.move_in_date,
    move_out_date: null,
    active: true,
    notes: tenantData.notes?.trim() || null,
    monthly_rent: rentVal,
    deposit_amount: depositVal,
  }

  let { data, error } = await supabase
    .from('tenants')
    .insert(fullPayload)
    .select('*, room:rooms(id, room_number, property_id)')
    .single()

  // Gracefully fallback if migration 005 (monthly_rent/deposit_amount columns) not run
  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const { monthly_rent: _mr, deposit_amount: _da, ...basePayload } = fullPayload
    const retry = await supabase
      .from('tenants')
      .insert(basePayload)
      .select('*, room:rooms(id, room_number, property_id)')
      .single()

    if (retry.error) {
      return { data: null, error: retry.error }
    }

    await syncRoomOccupancy(tenantData.room_id)
    return {
      data: retry.data,
      error: null,
      schemaNotice: 'Note: To persist custom lease rent & deposit on tenant records, run migration 005.',
    }
  }

  if (error) {
    return { data: null, error }
  }

  // Synchronize room status
  await syncRoomOccupancy(tenantData.room_id)

  return { data, error: null, schemaNotice: null }
}

/**
 * Updates an existing tenant record.
 */
export async function updateTenant(tenantId, updates, previousRoomId = null) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!updates.full_name?.trim()) {
    return { data: null, error: new Error('Tenant full name is required.') }
  }

  const targetRoomId = updates.room_id || previousRoomId
  if (!targetRoomId) {
    return { data: null, error: new Error('Room is required.') }
  }

  // If transferring to a different room, check new room availability
  const isRoomChange = previousRoomId && updates.room_id && previousRoomId !== updates.room_id
  if (isRoomChange && updates.active !== false) {
    const availability = await checkRoomAvailability(updates.room_id, tenantId)
    if (!availability.available) {
      return { data: null, error: new Error(availability.reason || 'Selected room is not available.') }
    }
  }

  const rentVal = updates.monthly_rent !== '' && updates.monthly_rent != null
    ? Number(updates.monthly_rent)
    : null

  const depositVal = updates.deposit_amount !== '' && updates.deposit_amount != null
    ? Number(updates.deposit_amount)
    : null

  const fullPayload = {
    room_id: targetRoomId,
    full_name: updates.full_name.trim(),
    email: updates.email?.trim() || null,
    phone: updates.phone?.trim() || null,
    emergency_contact: updates.emergency_contact?.trim() || null,
    move_in_date: updates.move_in_date,
    move_out_date: updates.move_out_date || null,
    notes: updates.notes?.trim() || null,
    monthly_rent: rentVal,
    deposit_amount: depositVal,
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('tenants')
    .update(fullPayload)
    .eq('id', tenantId)
    .select('*, room:rooms(id, room_number, property_id)')
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const { monthly_rent: _mr, deposit_amount: _da, ...basePayload } = fullPayload
    const retry = await supabase
      .from('tenants')
      .update(basePayload)
      .eq('id', tenantId)
      .select('*, room:rooms(id, room_number, property_id)')
      .single()

    if (retry.error) {
      return { data: null, error: retry.error }
    }
    data = retry.data
    error = null
  }

  if (error) {
    return { data: null, error }
  }

  // Sync occupancy for both old and new rooms if transferred
  if (isRoomChange) {
    await Promise.all([
      syncRoomOccupancy(previousRoomId),
      syncRoomOccupancy(updates.room_id),
    ])
  } else {
    await syncRoomOccupancy(targetRoomId)
  }

  return { data, error: null }
}

/**
 * Moves out an active tenant, recording the departure date while preserving all history.
 */
export async function moveOutTenant(tenantId, { moveOutDate, notes } = {}) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // Fetch current tenant to know which room to free up
  const { data: tenant, error: fetchErr } = await supabase
    .from('tenants')
    .select('id, room_id, move_in_date, notes, active')
    .eq('id', tenantId)
    .single()

  if (fetchErr || !tenant) {
    return { success: false, error: new Error('Tenant record not found.') }
  }

  if (!tenant.active) {
    return { success: false, error: new Error('Tenant is already marked as moved out / inactive.') }
  }

  const effectiveMoveOutDate = moveOutDate || new Date().toISOString().slice(0, 10)

  if (tenant.move_in_date && effectiveMoveOutDate < tenant.move_in_date) {
    return {
      success: false,
      error: new Error(`Move-out date cannot be earlier than move-in date (${tenant.move_in_date}).`),
    }
  }

  const updatedNotes = notes
    ? (tenant.notes ? `${tenant.notes}\n[Move-out Note]: ${notes.trim()}` : `[Move-out Note]: ${notes.trim()}`)
    : tenant.notes

  const { error: updateErr } = await supabase
    .from('tenants')
    .update({
      active: false,
      move_out_date: effectiveMoveOutDate,
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (updateErr) {
    return { success: false, error: updateErr }
  }

  // Update room occupancy
  await syncRoomOccupancy(tenant.room_id)

  return { success: true, error: null }
}

/**
 * Reactivates a past tenant into a room.
 */
export async function reactivateTenant(tenantId, { roomId, moveInDate }) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  const availability = await checkRoomAvailability(roomId, tenantId)
  if (!availability.available) {
    return { success: false, error: new Error(availability.reason || 'Selected room is not available.') }
  }

  const effectiveMoveIn = moveInDate || new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('tenants')
    .update({
      active: true,
      room_id: roomId,
      move_in_date: effectiveMoveIn,
      move_out_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) {
    return { success: false, error }
  }

  await syncRoomOccupancy(roomId)
  return { success: true, error: null }
}

/**
 * Safely deletes a tenant record (only allowed if no payment records exist).
 */
export async function deleteTenant(tenantId, roomId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // Check if payments exist
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('id')
    .eq('tenant_id', tenantId)

  if (payError) {
    return { success: false, error: payError }
  }

  if (payments && payments.length > 0) {
    return {
      success: false,
      error: new Error(
        `Cannot delete this tenant because ${payments.length} payment record(s) are linked to them. Move out the tenant instead to preserve financial records.`
      ),
    }
  }

  const { error: deleteError } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId)

  if (deleteError) {
    return { success: false, error: deleteError }
  }

  if (roomId) {
    await syncRoomOccupancy(roomId)
  }

  return { success: true, error: null }
}
