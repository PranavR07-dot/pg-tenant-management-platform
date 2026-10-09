import { Building2, CreditCard, TrendingUp, Users } from 'lucide-react'
import { formatCurrency } from '@/utils/helpers'

const STATS = [
  { label: 'Total Rooms', value: '—', icon: Building2, color: 'bg-indigo-50 text-indigo-600' },
  { label: 'Active Tenants', value: '—', icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Monthly Revenue', value: '—', icon: CreditCard, color: 'bg-blue-50 text-blue-600' },
  { label: 'Occupancy Rate', value: '—', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your PG properties</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder content */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">
          Connect your Supabase project to start seeing data here.
        </p>
      </div>
    </div>
  )
}
