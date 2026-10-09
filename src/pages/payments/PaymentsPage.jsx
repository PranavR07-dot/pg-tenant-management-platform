import { CreditCard } from 'lucide-react'

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Track rent payments</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">Payment tracking — coming in Phase 4.</p>
      </div>
    </div>
  )
}
