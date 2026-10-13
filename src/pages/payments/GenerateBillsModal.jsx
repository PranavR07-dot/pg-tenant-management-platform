import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Sparkles } from 'lucide-react'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

export default function GenerateBillsModal({
  isOpen,
  onClose,
  onGenerate,
  activeTenantsCount = 0,
  loading = false,
}) {
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-05`
  })

  const handleMonthChange = (e) => {
    const m = Number(e.target.value)
    setMonth(m)
    const mStr = String(m).padStart(2, '0')
    setDueDate(`${year}-${mStr}-05`)
  }

  const handleYearChange = (e) => {
    const y = Number(e.target.value)
    setYear(y)
    const mStr = String(month).padStart(2, '0')
    setDueDate(`${y}-${mStr}-05`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onGenerate({ year, month, dueDate })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Monthly Rent Invoices"
      subtitle="Batch create rent invoices for active tenants"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
          <p>
            Generates a <strong>Pending</strong> rent bill for all{' '}
            <strong>{activeTenantsCount} active tenant(s)</strong> based on their agreed monthly rent.
          </p>
          <p className="mt-1 text-blue-600">
            Tenants who already have a payment record for this month will be skipped to avoid duplicate billing.
          </p>
        </div>

        {/* Month and Year Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="gen-month" className="text-sm font-medium text-gray-700">
              Billing Month *
            </label>
            <select
              id="gen-month"
              value={month}
              onChange={handleMonthChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="gen-year" className="text-sm font-medium text-gray-700">
              Billing Year *
            </label>
            <select
              id="gen-year"
              value={year}
              onChange={handleYearChange}
              disabled={loading}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Due Date */}
        <Input
          id="gen-due-date"
          type="date"
          label="Rent Due Date *"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={loading}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={15} />
            <span>Generate Invoices</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
