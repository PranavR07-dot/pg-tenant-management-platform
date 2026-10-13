/**
 * publicPropertyService.js
 *
 * Queries that any visitor (unauthenticated or authenticated) can make.
 * Only reads from `properties` and `rooms` — which have public SELECT policies
 * after migration 006_public_listing_rls.sql is applied.
 *
 * NEVER queries tenants, payments, or profiles in this file.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Fetches properties with aggregated room statistics for the public listing.
 * Returns safe, non-sensitive fields only.
 *
 * @param {{ city?: string, minRent?: number, maxRent?: number, search?: string }} filters
 * @returns {Promise<{ data: Array, error: string | null, unconfigured: boolean }>}
 */
export async function fetchPublicProperties(filters = {}) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: null, unconfigured: true }
  }

  // Primary & only path: query sanitized public_properties and public_rooms views
  const { data, error } = await supabase
    .from('public_properties')
    .select(
      'id, name, address, city, description, created_at, is_published, cover_image_url, images:public_property_images(id, image_url, is_cover), rooms:public_rooms(id, room_number, room_type, monthly_rent, status, amenities, capacity)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    const isSetupBlock =
      error.code === '42P01' || // undefined_table / view not found
      error.code === 'PGRST205' || // could not find the table/view in the schema cache
      error.code === 'PGRST301' ||
      error.message?.toLowerCase().includes('schema cache') ||
      error.message?.toLowerCase().includes('permission') ||
      error.message?.toLowerCase().includes('rls') ||
      error.message?.includes('does not exist') ||
      (data === null && !error.message)

    if (isSetupBlock) {
      return {
        data: [],
        error: null,
        migrationRequired: true,
        migrationHint:
          'Public property listing is not yet enabled. Run supabase/migrations/006_secure_public_listing_rls.sql (and 007_property_images.sql) in your Supabase SQL Editor.',
      }
    }
    return { data: [], error: error.message, unconfigured: false }
  }

  let results = (data || []).map((p) => {
    const rooms = p.rooms || []
    const totalRooms = rooms.length
    const vacantRooms = rooms.filter((r) => r.status === 'vacant').length
    const minRent = rooms.length > 0 ? Math.min(...rooms.map((r) => Number(r.monthly_rent) || 0)) : 0
    const maxRent = rooms.length > 0 ? Math.max(...rooms.map((r) => Number(r.monthly_rent) || 0)) : 0

    // Collect all unique amenities across rooms
    const amenities = [...new Set(rooms.flatMap((r) => r.amenities || []))]

    // Determine cover image URL from view or images relation
    const images = p.images || []
    const coverFromRelation = images.find((img) => img.is_cover)?.image_url || images[0]?.image_url
    const coverImageUrl = p.cover_image_url || coverFromRelation || null

    return {
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      description: p.description,
      created_at: p.created_at,
      coverImageUrl,
      images,
      totalRooms,
      vacantRooms,
      minRent,
      maxRent,
      amenities,
      rooms: rooms.map((r) => ({
        id: r.id,
        room_number: r.room_number,
        room_type: r.room_type,
        monthly_rent: Number(r.monthly_rent) || 0,
        status: r.status,
        amenities: r.amenities || [],
        capacity: r.capacity || 1,
      })),
    }
  })

  // Client-side filters
  if (filters.city?.trim()) {
    const city = filters.city.trim().toLowerCase()
    results = results.filter(
      (p) =>
        p.city?.toLowerCase().includes(city) ||
        p.address?.toLowerCase().includes(city)
    )
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    results = results.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    )
  }

  if (filters.maxRent && Number(filters.maxRent) > 0) {
    const max = Number(filters.maxRent)
    results = results.filter((p) => p.minRent <= max)
  }

  if (filters.availableOnly) {
    results = results.filter((p) => p.vacantRooms > 0)
  }

  return { data: results, error: null, unconfigured: false, migrationRequired: false }
}

/**
 * Fetches a single property and its rooms for the public detail page.
 * Returns safe, non-sensitive fields only.
 *
 * @param {string} propertyId
 * @returns {Promise<{ data: object | null, error: string | null }>}
 */
export async function fetchPublicPropertyById(propertyId) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null, unconfigured: true }
  }

  // Primary & only path: query sanitized public views
  const { data, error } = await supabase
    .from('public_properties')
    .select(
      'id, name, address, city, description, created_at, is_published, cover_image_url, images:public_property_images(id, image_url, is_cover, display_order), rooms:public_rooms(id, room_number, room_type, monthly_rent, deposit_amount, status, amenities, capacity, floor)'
    )
    .eq('id', propertyId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: 'Property not found.' }
    return { data: null, error: error.message }
  }

  if (!data) return { data: null, error: 'Property not found.' }

  const rooms = data.rooms || []
  const images = (data.images || []).sort((a, b) => {
    if (a.is_cover) return -1
    if (b.is_cover) return 1
    return (a.display_order || 0) - (b.display_order || 0)
  })
  const coverImageUrl = data.cover_image_url || images[0]?.image_url || null
  const totalRooms = rooms.length
  const vacantRooms = rooms.filter((r) => r.status === 'vacant').length
  const occupiedRooms = rooms.filter((r) => r.status === 'occupied').length
  const amenities = [...new Set(rooms.flatMap((r) => r.amenities || []))]
  const minRent = rooms.length > 0 ? Math.min(...rooms.map((r) => Number(r.monthly_rent) || 0)) : 0
  const maxRent = rooms.length > 0 ? Math.max(...rooms.map((r) => Number(r.monthly_rent) || 0)) : 0

  return {
    data: {
      id: data.id,
      name: data.name,
      address: data.address,
      city: data.city,
      description: data.description,
      created_at: data.created_at,
      coverImageUrl,
      images,
      totalRooms,
      vacantRooms,
      occupiedRooms,
      minRent,
      maxRent,
      amenities,
      rooms: rooms.map((r) => ({
        id: r.id,
        room_number: r.room_number,
        room_type: r.room_type || 'single',
        monthly_rent: Number(r.monthly_rent) || 0,
        deposit_amount: Number(r.deposit_amount) || 0,
        status: r.status,
        amenities: r.amenities || [],
        capacity: r.capacity || 1,
        floor: r.floor,
      })),
    },
    error: null,
  }
}

/**
 * Returns a list of distinct cities that have properties.
 * Used to populate the city filter dropdown.
 * @returns {Promise<string[]>}
 */
export async function fetchPublicCities() {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('public_properties')
    .select('city')
    .order('city', { ascending: true })

  if (error || !data) return []

  const cities = [...new Set(data.map((p) => p.city).filter(Boolean))]
  return cities
}
