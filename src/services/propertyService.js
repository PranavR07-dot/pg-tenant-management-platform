import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Fetches all properties belonging to the authenticated owner.
 * Returns properties with calculated live room count.
 */
export async function fetchProperties() {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  // Attempt to select properties with rooms count and images
  let { data, error } = await supabase
    .from('properties')
    .select('*, rooms(count), images:property_images(*)')
    .order('created_at', { ascending: false })

  // Fallback if property_images table not yet migrated
  if (error && (error.code === '42P01' || error.message?.includes('property_images'))) {
    const fallback = await supabase
      .from('properties')
      .select('*, rooms(count)')
      .order('created_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    return { data: [], error }
  }

  const formatted = (data || []).map((p) => {
    const images = p.images || []
    const cover = images.find((img) => img.is_cover) || images[0] || null
    return {
      ...p,
      roomCount: p.rooms?.[0]?.count ?? p.total_rooms ?? 0,
      images,
      coverImageUrl: cover?.image_url || null,
    }
  })

  return { data: formatted, error: null }
}

/**
 * Fetches a single property by its ID.
 */
export async function getPropertyById(propertyId) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let { data, error } = await supabase
    .from('properties')
    .select('*, rooms(*), images:property_images(*)')
    .eq('id', propertyId)
    .single()

  if (error && (error.code === '42P01' || error.message?.includes('property_images'))) {
    const fallback = await supabase
      .from('properties')
      .select('*, rooms(*)')
      .eq('id', propertyId)
      .single()
    data = fallback.data
    error = fallback.error
  }

  return { data, error }
}

/**
 * Creates a new property for the authenticated owner.
 * Adapts gracefully if optional extended columns (description, contact_number)
 * have not been migrated yet.
 */
export async function createProperty({ name, address, city, description, contact_number, is_published }) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    return { data: null, error: new Error('You must be signed in to create a property.') }
  }

  const fullPayload = {
    owner_id: user.id,
    name: name.trim(),
    address: address?.trim() || '',
    city: city?.trim() || '',
    description: description?.trim() || null,
    contact_number: contact_number?.trim() || null,
    is_published: typeof is_published === 'boolean' ? is_published : false,
  }

  let { data, error } = await supabase
    .from('properties')
    .insert(fullPayload)
    .select()
    .single()

  // If columns don't exist (migrations 004 or 006 not yet run), retry progressively with base schema
  if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('is_published'))) {
    const { is_published: _p, ...payloadWithoutPublished } = fullPayload
    let retry = await supabase
      .from('properties')
      .insert(payloadWithoutPublished)
      .select()
      .single()

    if (retry.error && (retry.error.code === '42703' || retry.error.message?.includes('column'))) {
      const basePayload = {
        owner_id: user.id,
        name: fullPayload.name,
        address: fullPayload.address,
        city: fullPayload.city,
      }
      retry = await supabase
        .from('properties')
        .insert(basePayload)
        .select()
        .single()
    }

    return {
      data: retry.data,
      error: retry.error,
      schemaNotice: 'Note: To persist extended details and public listing status, ensure migrations 004 and 006 are run in Supabase.',
    }
  }

  return { data, error, schemaNotice: null }
}

/**
 * Updates an existing property.
 */
export async function updateProperty(propertyId, updates) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const payload = {
    name: updates.name.trim(),
    address: updates.address?.trim() || '',
    city: updates.city?.trim() || '',
    description: updates.description?.trim() || null,
    contact_number: updates.contact_number?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (typeof updates.is_published === 'boolean') {
    payload.is_published = updates.is_published
  }

  let { data, error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', propertyId)
    .select()
    .single()

  if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('is_published'))) {
    const { description: _d, contact_number: _c, is_published: _p, ...basePayload } = payload
    const retry = await supabase
      .from('properties')
      .update(basePayload)
      .eq('id', propertyId)
      .select()
      .single()
    return { data: retry.data, error: retry.error }
  }

  return { data, error }
}

/**
 * Deletes a property after verifying there are no active tenants.
 */
export async function deleteProperty(propertyId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // Safety check: ensure no rooms in this property have active tenants
  const { data: rooms, error: checkError } = await supabase
    .from('rooms')
    .select('id, room_number, tenants(id, active)')
    .eq('property_id', propertyId)

  if (checkError) {
    return { success: false, error: checkError }
  }

  const hasActiveTenants = (rooms || []).some((r) =>
    (r.tenants || []).some((t) => t.active)
  )

  if (hasActiveTenants) {
    return {
      success: false,
      error: new Error(
        'Cannot delete this property because it contains rooms with active tenants. Please relocate or check out all active tenants first.'
      ),
    }
  }

  const { error: deleteError } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)

  return { success: !deleteError, error: deleteError }
}
