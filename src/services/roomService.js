import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Standard amenities available for PG rooms
 */
export const AVAILABLE_AMENITIES = [
  'Wi-Fi',
  'Air Conditioning (AC)',
  'Attached Bathroom',
  'Balcony',
  'Geyser / Hot Water',
  'Cupboard / Wardrobe',
  'Study Table & Chair',
  'TV',
  'Daily Housekeeping',
  'Power Backup',
  'Refrigeration Access',
]

/**
 * Common room types
 */
export const ROOM_TYPES = [
  { value: 'single', label: 'Single Room', defaultCapacity: 1 },
  { value: 'double', label: 'Double Sharing (2 Beds)', defaultCapacity: 2 },
  { value: 'triple', label: 'Triple Sharing (3 Beds)', defaultCapacity: 3 },
  { value: 'four', label: 'Four Sharing (4 Beds)', defaultCapacity: 4 },
]

/**
 * Fetches all rooms owned by the current owner, optionally filtered.
 */
export async function fetchRooms(filters = {}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('rooms')
    .select('*, property:properties(id, name, city), tenants(id, full_name, phone, active)')
    .order('room_number', { ascending: true })

  if (filters.propertyId && filters.propertyId !== 'all') {
    query = query.eq('property_id', filters.propertyId)
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error }
  }

  let results = (data || []).map((r) => {
    const activeTenants = (r.tenants || []).filter((t) => t.active)
    return {
      ...r,
      activeTenantsCount: activeTenants.length,
      activeTenantNames: activeTenants.map((t) => t.full_name),
    }
  })

  // Optional in-memory client search (by room number, floor, or property name)
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    results = results.filter(
      (r) =>
        r.room_number?.toLowerCase().includes(s) ||
        r.floor?.toLowerCase().includes(s) ||
        r.property?.name?.toLowerCase().includes(s)
    )
  }

  return { data: results, error: null }
}

/**
 * Fetches a single room by its ID.
 */
export async function getRoomById(roomId) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('rooms')
    .select('*, property:properties(id, name, city), tenants(*)')
    .eq('id', roomId)
    .single()

  return { data, error }
}

/**
 * Creates a new room.
 * Validates inputs, handles duplicate room numbers, and updates property room count.
 */
export async function createRoom({
  propertyId,
  roomNumber,
  floor,
  monthlyRent,
  depositAmount,
  status = 'vacant',
  amenities = [],
  roomType = 'single',
  capacity = 1,
}) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!propertyId) {
    return { data: null, error: new Error('Please select a property for this room.') }
  }

  if (!roomNumber?.trim()) {
    return { data: null, error: new Error('Room number/name is required.') }
  }

  const rentVal = Number(monthlyRent)
  if (isNaN(rentVal) || rentVal < 0) {
    return { data: null, error: new Error('Monthly rent must be a valid positive amount.') }
  }

  const depositVal = Number(depositAmount || 0)
  if (isNaN(depositVal) || depositVal < 0) {
    return { data: null, error: new Error('Deposit amount must be a valid positive amount.') }
  }

  const capacityVal = Number(capacity || 1)
  if (isNaN(capacityVal) || capacityVal < 1) {
    return { data: null, error: new Error('Capacity must be at least 1.') }
  }

  const fullPayload = {
    property_id: propertyId,
    room_number: roomNumber.trim(),
    floor: floor?.trim() || null,
    monthly_rent: rentVal,
    deposit_amount: depositVal,
    status: status || 'vacant',
    amenities: Array.isArray(amenities) ? amenities : [],
    room_type: roomType,
    capacity: capacityVal,
  }

  let { data, error } = await supabase
    .from('rooms')
    .insert(fullPayload)
    .select('*, property:properties(id, name)')
    .single()

  // If room_type or capacity columns don't exist yet (migration 004 pending)
  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const { room_type: _rt, capacity: _c, ...basePayload } = fullPayload
    const retry = await supabase
      .from('rooms')
      .insert(basePayload)
      .select('*, property:properties(id, name)')
      .single()

    if (retry.error) {
      if (retry.error.code === '23505') {
        return {
          data: null,
          error: new Error(`Room "${roomNumber}" already exists in this property.`),
        }
      }
      return { data: null, error: retry.error }
    }

    // Refresh property total_rooms count
    await syncPropertyTotalRooms(propertyId)

    return {
      data: retry.data,
      error: null,
      schemaNotice: 'Note: To persist room type and capacity, run migration 004 in Supabase.',
    }
  }

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: new Error(`Room "${roomNumber}" already exists in this property.`),
      }
    }
    return { data: null, error }
  }

  // Refresh property total_rooms count
  await syncPropertyTotalRooms(propertyId)

  return { data, error: null, schemaNotice: null }
}

/**
 * Updates an existing room.
 */
export async function updateRoom(roomId, updates) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const rentVal = Number(updates.monthly_rent)
  if (isNaN(rentVal) || rentVal < 0) {
    return { data: null, error: new Error('Monthly rent must be a valid positive amount.') }
  }

  const depositVal = Number(updates.deposit_amount || 0)
  if (isNaN(depositVal) || depositVal < 0) {
    return { data: null, error: new Error('Deposit amount must be a valid positive amount.') }
  }

  const capacityVal = Number(updates.capacity || 1)
  if (isNaN(capacityVal) || capacityVal < 1) {
    return { data: null, error: new Error('Capacity must be at least 1.') }
  }

  const fullPayload = {
    room_number: updates.room_number?.trim(),
    floor: updates.floor?.trim() || null,
    monthly_rent: rentVal,
    deposit_amount: depositVal,
    status: updates.status || 'vacant',
    amenities: Array.isArray(updates.amenities) ? updates.amenities : [],
    room_type: updates.room_type || 'single',
    capacity: capacityVal,
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabase
    .from('rooms')
    .update(fullPayload)
    .eq('id', roomId)
    .select('*, property:properties(id, name)')
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const { room_type: _rt, capacity: _c, ...basePayload } = fullPayload
    const retry = await supabase
      .from('rooms')
      .update(basePayload)
      .eq('id', roomId)
      .select('*, property:properties(id, name)')
      .single()

    if (retry.error) {
      if (retry.error.code === '23505') {
        return {
          data: null,
          error: new Error(`Room "${updates.room_number}" already exists in this property.`),
        }
      }
      return { data: null, error: retry.error }
    }
    return { data: retry.data, error: null }
  }

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: new Error(`Room "${updates.room_number}" already exists in this property.`),
      }
    }
    return { data: null, error }
  }

  return { data, error: null }
}

/**
 * Deletes a room after checking for linked tenants.
 */
export async function deleteRoom(roomId, propertyId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // Safety check: ensure no active or linked tenants exist
  const { data: tenants, error: checkError } = await supabase
    .from('tenants')
    .select('id, full_name, active')
    .eq('room_id', roomId)

  if (checkError) {
    return { success: false, error: checkError }
  }

  if (tenants && tenants.length > 0) {
    const active = tenants.filter((t) => t.active)
    if (active.length > 0) {
      return {
        success: false,
        error: new Error(
          `Cannot delete room because it currently has active tenant(s): ${active
            .map((t) => t.full_name)
            .join(', ')}. Please check out or reassign tenants first.`
        ),
      }
    }
    return {
      success: false,
      error: new Error(
        'Cannot delete room because historical tenant records reference it. You can mark its status as "maintenance" instead.'
      ),
    }
  }

  const { error: deleteError } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)

  if (deleteError) {
    return { success: false, error: deleteError }
  }

  // Update property room count if propertyId is known
  if (propertyId) {
    await syncPropertyTotalRooms(propertyId)
  }

  return { success: true, error: null }
}

/**
 * Helper to keep properties.total_rooms synchronized with count of rooms.
 */
async function syncPropertyTotalRooms(propertyId) {
  try {
    const { count } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)

    if (typeof count === 'number') {
      await supabase
        .from('properties')
        .update({ total_rooms: count, updated_at: new Date().toISOString() })
        .eq('id', propertyId)
    }
  } catch (err) {
    console.warn('[roomService] Could not sync total_rooms count:', err.message)
  }
}
