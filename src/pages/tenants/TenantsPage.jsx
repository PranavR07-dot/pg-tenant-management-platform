import { Users } from 'lucide-react'

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your tenants</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <Users size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">Tenant management — coming in Phase 4.</p>
      </div>
    </div>
  )
}
