import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const BUCKET_NAME = 'property-images'

/**
 * Fetches all images for a property (manager/owner view).
 * @param {string} propertyId
 * @returns {Promise<{ data: Array, error: Error | null }>}
 */
export async function fetchPropertyImages(propertyId) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('property_images')
    .select('*')
    .eq('property_id', propertyId)
    .order('is_cover', { ascending: false })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    // If table doesn't exist yet (migration 007 pending), fail gracefully
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return { data: [], error: null, migrationRequired: true }
    }
    return { data: [], error }
  }

  return { data: data || [], error: null }
}

/**
 * Uploads a file to Supabase Storage and records it in property_images table.
 * @param {string} propertyId
 * @param {File} file
 * @param {boolean} isCover
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function uploadPropertyImage(propertyId, file, isCover = false) {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    return { data: null, error: new Error('You must be signed in to upload images.') }
  }

  // Generate safe storage path: {owner_id}/{property_id}/{timestamp}_{filename}
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${propertyId}/${Date.now()}_${cleanName}`

  // 1. Upload file to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return { data: null, error: uploadError }
  }

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(uploadData.path)

  // 3. If setting as cover, unset any existing cover for this property
  if (isCover) {
    await supabase
      .from('property_images')
      .update({ is_cover: false })
      .eq('property_id', propertyId)
  }

  // 4. Insert row into property_images
  const { data: dbData, error: dbError } = await supabase
    .from('property_images')
    .insert({
      property_id: propertyId,
      image_url: publicUrl,
      storage_path: uploadData.path,
      is_cover: isCover,
    })
    .select()
    .single()

  if (dbError) {
    // Attempt rollback of uploaded file
    await supabase.storage.from(BUCKET_NAME).remove([uploadData.path])
    return { data: null, error: dbError }
  }

  return { data: dbData, error: null }
}

/**
 * Sets a specific image as the cover image for a property.
 * @param {string} propertyId
 * @param {string} imageId
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 */
export async function setCoverImage(propertyId, imageId) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // Unset all covers for this property first
  const { error: unsetError } = await supabase
    .from('property_images')
    .update({ is_cover: false })
    .eq('property_id', propertyId)

  if (unsetError) {
    return { success: false, error: unsetError }
  }

  // Set selected image as cover
  const { error: setError } = await supabase
    .from('property_images')
    .update({ is_cover: true })
    .eq('id', imageId)

  if (setError) {
    return { success: false, error: setError }
  }

  return { success: true, error: null }
}

/**
 * Deletes a property image from database and storage.
 * @param {string} imageId
 * @param {string} storagePath
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 */
export async function deletePropertyImage(imageId, storagePath) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: new Error('Supabase is not configured.') }
  }

  // 1. Delete from database
  const { error: dbError } = await supabase
    .from('property_images')
    .delete()
    .eq('id', imageId)

  if (dbError) {
    return { success: false, error: dbError }
  }

  // 2. Delete file from storage (if path provided)
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (storageError) {
      console.warn('[ImageService] Failed to remove storage object:', storageError.message)
    }
  }

  return { success: true, error: null }
}
