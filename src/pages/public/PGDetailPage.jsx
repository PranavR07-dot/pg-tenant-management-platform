import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Images,
  LayoutDashboard,
  MapPin,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { fetchPublicPropertyById } from '@/services/publicPropertyService'

// ─── Room type labels ──────────────────────────────────────────────────────────
const ROOM_TYPE_LABELS = {
  single: 'Single Room',
  double: 'Double Sharing',
  triple: 'Triple Sharing',
  four: 'Four Sharing',
}

function RoomCard({ room }) {
  const isVacant = room.status === 'vacant'
  const isMaintenance = room.status === 'maintenance'

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${
      isVacant
        ? 'border-emerald-200 bg-emerald-50/50'
        : isMaintenance
        ? 'border-gray-200 bg-gray-50'
        : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Room {room.room_number}</p>
          {room.floor && <p className="text-xs text-gray-400">Floor: {room.floor}</p>}
          <p className="text-xs text-gray-500 mt-0.5">{ROOM_TYPE_LABELS[room.room_type] || room.room_type || 'Standard'}</p>
        </div>
        <div className="shrink-0">
          {isVacant ? (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              <CheckCircle2 size={11} /> Available
            </span>
          ) : isMaintenance ? (
            <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              Maintenance
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              <XCircle size={11} /> Occupied
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div>
          <p className="text-lg font-bold text-indigo-600">
            {room.monthly_rent > 0 ? formatCurrency(room.monthly_rent) : '—'}
            {room.monthly_rent > 0 && <span className="text-xs font-normal text-gray-400">/mo</span>}
          </p>
          {room.deposit_amount > 0 && (
            <p className="text-xs text-gray-400">Deposit: {formatCurrency(room.deposit_amount)}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Users size={12} />
          <span>{room.capacity} bed{room.capacity !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {room.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {room.amenities.map((a) => (
            <span key={a} className="bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0.5 rounded">
              {a.split(' (')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main PGDetailPage ────────────────────────────────────────────────────────
export default function PGDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isMountedRef = useRef(true)

  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    isMountedRef.current = true
    let active = true

    async function load() {
      const result = await fetchPublicPropertyById(id)
      if (!active || !isMountedRef.current) return

      if (result.error) {
        setError(result.error)
      } else {
        setProperty(result.data)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
      isMountedRef.current = false
    }
  }, [id])

  const vacantRooms = property?.rooms.filter((r) => r.status === 'vacant') || []
  const occupiedRooms = property?.rooms.filter((r) => r.status === 'occupied') || []

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const images = property?.images || []
  const hasImages = images.length > 0

  const handleOpenLightbox = (index) => setLightboxIndex(index)
  const handleCloseLightbox = () => setLightboxIndex(null)
  const handlePrevImage = () => {
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }
  const handleNextImage = () => {
    setLightboxIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/pgs" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm">
            <ArrowLeft size={16} />
            Back to listings
          </Link>
          {user ? (
            <Link
              to="/manager/dashboard"
              className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
            >
              <LayoutDashboard size={15} />
              Manager Dashboard
            </Link>
          ) : (
            <Link
              to="/manager/login"
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Manager Login
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Loading */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-60 bg-gray-200 rounded-2xl" />
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
            <p className="font-medium text-red-700">{error}</p>
            <Link to="/pgs" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
              ← Back to all listings
            </Link>
          </div>
        )}

        {/* Content */}
        {!loading && !error && property && (
          <>
            {/* ── Image Gallery / Hero ── */}
            {hasImages ? (
              <div className="space-y-3">
                {/* Main Hero Cover + Side Grid (if multiple images) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl overflow-hidden max-h-[420px]">
                  {/* Primary Large Image */}
                  <div
                    onClick={() => handleOpenLightbox(0)}
                    className={`relative cursor-pointer group overflow-hidden bg-gray-100 ${
                      images.length > 1 ? 'md:col-span-2' : 'md:col-span-3'
                    } h-72 md:h-96`}
                  >
                    <img
                      src={images[0].image_url}
                      alt={property.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-opacity">
                        <Images size={14} /> View photo
                      </span>
                    </div>
                  </div>

                  {/* Secondary Thumbnails Column (up to 2 side images) */}
                  {images.length > 1 && (
                    <div className="hidden md:grid grid-rows-2 gap-3 h-96">
                      {images.slice(1, 3).map((img, idx) => (
                        <div
                          key={img.id}
                          onClick={() => handleOpenLightbox(idx + 1)}
                          className="relative cursor-pointer group overflow-hidden rounded-xl bg-gray-100 h-[186px]"
                        >
                          <img
                            src={img.image_url}
                            alt={`${property.name} ${idx + 2}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            {idx === 1 && images.length > 3 ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-semibold">
                                +{images.length - 3} more photos
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Thumbnails Strip if > 3 images */}
                {images.length > 3 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleOpenLightbox(idx)}
                        className="relative shrink-0 w-20 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-500 transition-colors"
                      >
                        <img
                          src={img.image_url}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Fallback hero placeholder */
              <div className="h-56 sm:h-72 bg-gradient-to-br from-indigo-100 to-cyan-100 rounded-2xl flex items-center justify-center">
                <Building2 size={64} className="text-indigo-300" />
              </div>
            )}

            {/* Property header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
                  {(property.city || property.address) && (
                    <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1.5">
                      <MapPin size={14} />
                      <span>{[property.address, property.city].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {property.description && (
                    <p className="text-gray-600 text-sm mt-3 leading-relaxed">{property.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {property.minRent > 0 && (
                    <>
                      <p className="text-xs text-gray-400">Rent starting from</p>
                      <p className="text-2xl font-extrabold text-indigo-600">{formatCurrency(property.minRent)}</p>
                      <p className="text-xs text-gray-400">per month</p>
                      {property.maxRent > property.minRent && (
                        <p className="text-xs text-gray-400">up to {formatCurrency(property.maxRent)}/mo</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{property.totalRooms}</p>
                  <p className="text-xs text-gray-500">Total Rooms</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{property.vacantRooms}</p>
                  <p className="text-xs text-gray-500">Available</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-600">{occupiedRooms.length}</p>
                  <p className="text-xs text-gray-500">Occupied</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {property.totalRooms > 0
                      ? `${Math.round((property.vacantRooms / property.totalRooms) * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Availability</p>
                </div>
              </div>
            </div>

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-full font-medium"
                    >
                      <CheckCircle2 size={13} />
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Rooms */}
            {property.rooms.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">
                  Rooms
                  {vacantRooms.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-emerald-600">
                      {vacantRooms.length} available
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {property.rooms.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </div>
            )}

            {/* Contact CTA — intentionally vague; real contact is through manager */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
              <Building2 size={32} className="mx-auto text-indigo-400 mb-3" />
              <h3 className="font-semibold text-indigo-900">Interested in this PG?</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Contact the property manager directly to enquire about availability and to book a room.
              </p>
              <p className="text-xs text-indigo-500 mt-3 max-w-sm mx-auto">
                This platform helps PG owners manage their properties. Booking and contact features are
                handled directly by the property manager.
              </p>
              <Link
                to="/pgs"
                className="mt-5 inline-block text-sm text-indigo-600 hover:underline font-medium"
              >
                ← Browse more PGs
              </Link>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Listed since {property.created_at ? formatDate(property.created_at) : '—'}
            </p>
          </>
        )}
      </div>

      {/* ─── Lightbox Modal ──────────────────────────────────────────────── */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseLightbox}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleCloseLightbox}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
            title="Close"
          >
            <X size={22} />
          </button>

          {/* Previous image */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handlePrevImage()
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
              title="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Main preview image */}
          <div
            className="max-w-4xl max-h-[85vh] relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex].image_url}
              alt={`${property.name} photo ${lightboxIndex + 1}`}
              className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-xs text-white/70">
              {lightboxIndex + 1} of {images.length}
            </div>
          </div>

          {/* Next image */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleNextImage()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
              title="Next photo"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
