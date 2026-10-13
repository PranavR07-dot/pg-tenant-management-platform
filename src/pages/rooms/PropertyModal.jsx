import { useState, useEffect, useRef } from 'react'
import {
  Upload,
  X,
  Star,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  fetchPropertyImages,
  uploadPropertyImage,
  setCoverImage,
  deletePropertyImage,
} from '@/services/propertyImageService'

export default function PropertyModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  loading = false,
}) {
  const isEditing = Boolean(initialData)

  const [formData, setFormData] = useState(() => ({
    name: initialData?.name || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    description: initialData?.description || '',
    contact_number: initialData?.contact_number || '',
    is_published: Boolean(initialData?.is_published),
  }))

  const [errors, setErrors] = useState({})

  // Image management state
  const [images, setImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([]) // For new properties before creation
  const fileInputRef = useRef(null)

  // Load images when editing an existing property
  useEffect(() => {
    let active = true

    if (isOpen && initialData?.id) {
      async function load() {
        setLoadingImages(true)
        const res = await fetchPropertyImages(initialData.id)
        if (!active) return
        if (!res.error) {
          setImages(res.data || [])
        }
        setLoadingImages(false)
      }
      load()
    }

    return () => {
      active = false
      setImages([])
      setPendingFiles([])
    }
  }, [isOpen, initialData?.id])

  const validate = () => {
    const errs = {}
    if (!formData.name.trim()) {
      errs.name = 'Property name is required.'
    } else if (formData.name.trim().length < 2) {
      errs.name = 'Property name must be at least 2 characters.'
    }

    if (!formData.city.trim()) {
      errs.city = 'City is required.'
    }

    return errs
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  // ─── Image Upload Handlers ────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setImageError(null)

    // Validate size (5MB max) and type
    const validFiles = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setImageError('Only image files (JPEG, PNG, WebP) are allowed.')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError(`"${file.name}" exceeds the 5MB size limit.`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    // If editing existing property, upload directly
    if (isEditing && initialData?.id) {
      setUploadingImage(true)
      for (const file of validFiles) {
        const isFirst = images.length === 0
        const res = await uploadPropertyImage(initialData.id, file, isFirst)
        if (res.error) {
          setImageError(`Failed to upload "${file.name}": ${res.error.message}`)
        } else if (res.data) {
          setImages((prev) => [...prev, res.data])
        }
      }
      setUploadingImage(false)
    } else {
      // For new property, create local object URLs for immediate preview
      const newPending = validFiles.map((file, idx) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        isCover: pendingFiles.length === 0 && idx === 0,
        id: `pending_${Date.now()}_${idx}`,
      }))
      setPendingFiles((prev) => [...prev, ...newPending])
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSetCover = async (img) => {
    setImageError(null)
    if (isEditing && initialData?.id) {
      const res = await setCoverImage(initialData.id, img.id)
      if (res.error) {
        setImageError(`Failed to set cover image: ${res.error.message}`)
      } else {
        setImages((prev) =>
          prev.map((item) => ({ ...item, is_cover: item.id === img.id }))
        )
      }
    } else {
      // Pending cover selection
      setPendingFiles((prev) =>
        prev.map((item) => ({ ...item, isCover: item.id === img.id }))
      )
    }
  }

  const handleDeleteImage = async (img) => {
    setImageError(null)
    if (isEditing && initialData?.id) {
      const res = await deletePropertyImage(img.id, img.storage_path)
      if (res.error) {
        setImageError(`Failed to delete image: ${res.error.message}`)
      } else {
        setImages((prev) => prev.filter((item) => item.id !== img.id))
      }
    } else {
      // Pending removal
      URL.revokeObjectURL(img.previewUrl)
      setPendingFiles((prev) => {
        const remaining = prev.filter((item) => item.id !== img.id)
        if (img.isCover && remaining.length > 0) {
          remaining[0].isCover = true
        }
        return remaining
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    // Pass pendingFiles to parent handler so they can be uploaded once propertyId exists
    await onSubmit({
      ...formData,
      pendingFiles: !isEditing ? pendingFiles : [],
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Property' : 'Add New Property'}
      subtitle={
        isEditing
          ? 'Update property details, photos, and public listing'
          : 'Create a PG building or hostel to start adding rooms'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <Input
          id="prop-name"
          name="name"
          label="Property Name *"
          placeholder="e.g. Green Valley PG, Sunrise Hostel"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          disabled={loading || uploadingImage}
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="prop-city"
            name="city"
            label="City *"
            placeholder="e.g. Bangalore, Pune"
            value={formData.city}
            onChange={handleChange}
            error={errors.city}
            disabled={loading || uploadingImage}
          />

          <Input
            id="prop-contact"
            name="contact_number"
            label="Contact Number"
            placeholder="e.g. +91 98765 43210"
            value={formData.contact_number}
            onChange={handleChange}
            error={errors.contact_number}
            disabled={loading || uploadingImage}
          />
        </div>

        <Input
          id="prop-address"
          name="address"
          label="Full Address"
          placeholder="e.g. #42, 5th Cross, Koramangala"
          value={formData.address}
          onChange={handleChange}
          error={errors.address}
          disabled={loading || uploadingImage}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="prop-desc" className="text-sm font-medium text-gray-700">
            Description / Notes
          </label>
          <textarea
            id="prop-desc"
            name="description"
            rows={3}
            placeholder="e.g. Men's PG near tech park with 3 floors and terrace dining"
            value={formData.description}
            onChange={handleChange}
            disabled={loading || uploadingImage}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>

        {/* ─── Property Photos Section ─────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <ImageIcon size={16} className="text-indigo-600" />
                Property Photos
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Upload photos for PG cards and discovery details (Max 5MB each).
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading || uploadingImage}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploadingImage}
                className="gap-1.5 shrink-0"
              >
                {uploadingImage ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                <span>Upload Photos</span>
              </Button>
            </div>
          </div>

          {imageError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{imageError}</span>
            </div>
          )}

          {/* Loading Photos Spinner */}
          {loadingImages && (
            <div className="py-6 flex items-center justify-center text-xs text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span>Loading saved photos...</span>
            </div>
          )}

          {/* Photos Grid */}
          {!loadingImages && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Existing Uploaded Images */}
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`group relative rounded-xl overflow-hidden border bg-white aspect-4/3 flex flex-col justify-between ${
                    img.is_cover ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={img.image_url}
                    alt="Property"
                    className="w-full h-full object-cover"
                  />

                  {/* Top-right delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img)}
                    disabled={loading || uploadingImage}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="Delete image"
                  >
                    <X size={12} />
                  </button>

                  {/* Cover badge / Set as Cover Button */}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                    {img.is_cover ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                        <Star size={10} className="fill-white" /> Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetCover(img)}
                        disabled={loading || uploadingImage}
                        className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs transition-colors"
                      >
                        Set Cover
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Pending Uploads (for new property modal) */}
              {pendingFiles.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-xl overflow-hidden border bg-white aspect-4/3 flex flex-col justify-between ${
                    item.isCover ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={item.previewUrl}
                    alt="Pending upload"
                    className="w-full h-full object-cover opacity-90"
                  />

                  <button
                    type="button"
                    onClick={() => handleDeleteImage(item)}
                    disabled={loading}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>

                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                    {item.isCover ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
                        <Star size={10} className="fill-white" /> Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetCover(item)}
                        className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs transition-colors"
                      >
                        Set Cover
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {images.length === 0 && pendingFiles.length === 0 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="col-span-2 sm:col-span-4 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-white transition-colors"
                >
                  <ImageIcon size={24} className="mx-auto text-gray-300 mb-1" />
                  <p className="text-xs text-gray-600 font-medium">No photos uploaded yet</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Click to choose photos from your device</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Public Listing Toggle ───────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <input
            id="prop-published"
            name="is_published"
            type="checkbox"
            checked={formData.is_published}
            onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
            disabled={loading || uploadingImage}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="prop-published" className="text-sm cursor-pointer">
            <span className="font-medium text-gray-900 block">List publicly for PG discovery</span>
            <span className="text-xs text-gray-500 block mt-0.5">
              When checked, this property, its cover photo, and available rooms will appear on the public homepage and listings page. Private details like tenant and payment data are never shared.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading || uploadingImage}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading || uploadingImage}>
            {isEditing ? 'Save Changes' : 'Create Property'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
