import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { fetchAllReportData } from '@/services/reportService'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns a fixed-point string for bar heights; avoids new Date() during render */
function pct(value, max) {
  if (!max || max === 0) return 0
  return Math.round((value / max) * 100)
}

function clampPct(value) {
  return Math.min(100, Math.max(0, value))
}

// ─── Reusable chart primitives ────────────────────────────────────────────────

/** Simple vertical bar chart rendered entirely in HTML/CSS — no canvas or SVG dep */
function BarChart({ bars, height = 180, formatValue = (v) => v, showLegend = false, legendItems = [] }) {
  const maxVal = useMemo(() => Math.max(...bars.map((b) => b.value), 1), [bars])

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((bar, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-xs text-gray-500 font-medium" style={{ fontSize: 10 }}>
              {bar.value > 0 ? formatValue(bar.value) : ''}
            </span>
            <div className="w-full flex flex-col justify-end" style={{ height: height - 28 }}>
              <div
                className={`w-full rounded-t transition-all ${bar.color || 'bg-indigo-500'}`}
                style={{ height: `${clampPct(pct(bar.value, maxVal))}%`, minHeight: bar.value > 0 ? 4 : 0 }}
                title={`${bar.label}: ${formatValue(bar.value)}`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-1.5 mt-1.5">
        {bars.map((bar, idx) => (
          <div key={idx} className="flex-1 text-center min-w-0">
            <span className="text-gray-400 block truncate" style={{ fontSize: 9 }}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      {showLegend && legendItems.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${item.color}`} />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Grouped bar for two datasets (collected vs pending) */
function GroupedBarChart({ data, height = 180 }) {
  const maxVal = useMemo(
    () => Math.max(...data.map((d) => d.collected + d.pending + d.overdue), 1),
    [data]
  )

  return (
    <div className="w-full">
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, idx) => {
          const collPct = clampPct(pct(d.collected, maxVal))
          const pendPct = clampPct(pct(d.pending, maxVal))
          const overPct = clampPct(pct(d.overdue, maxVal))
          return (
            <div key={idx} className="flex-1 flex gap-0.5 items-end min-w-0" style={{ height: height - 24 }}>
              <div
                className="flex-1 bg-emerald-400 rounded-t"
                style={{ height: `${collPct}%`, minHeight: d.collected > 0 ? 2 : 0 }}
                title={`Collected: ${formatCurrency(d.collected)}`}
              />
              <div
                className="flex-1 bg-amber-400 rounded-t"
                style={{ height: `${pendPct}%`, minHeight: d.pending > 0 ? 2 : 0 }}
                title={`Pending: ${formatCurrency(d.pending)}`}
              />
              <div
                className="flex-1 bg-red-400 rounded-t"
                style={{ height: `${overPct}%`, minHeight: d.overdue > 0 ? 2 : 0 }}
                title={`Overdue: ${formatCurrency(d.overdue)}`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d, idx) => (
          <div key={idx} className="flex-1 text-center min-w-0">
            <span className="text-gray-400 block truncate" style={{ fontSize: 9 }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-xs text-gray-600">Collected</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /><span className="text-xs text-gray-600">Pending</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400" /><span className="text-xs text-gray-600">Overdue</span></div>
      </div>
    </div>
  )
}

/** Horizontal stacked segment bar for a single metric with breakdown */
function SegmentBar({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  return (
    <div className="flex h-5 rounded-full overflow-hidden w-full gap-px">
      {segments.map((seg, i) => {
        const width = total > 0 ? (seg.value / total) * 100 : 0
        if (width < 0.5) return null
        return (
          <div
            key={i}
            className={seg.color}
            style={{ width: `${width}%` }}
            title={`${seg.label}: ${seg.pct ?? Math.round(width)}%`}
          />
        )
      })}
    </div>
  )
}

/** A KPI stat card */
function StatCard({ label, value, sub, icon: Icon, accent = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${colors[accent]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Tab: Revenue ─────────────────────────────────────────────────────────────

function RevenueTab({ revenue, payments }) {
  const trend = revenue.data || []
  const pd = payments.data

  const recentMonths = trend.slice(-6)

  const totalCollected12m = trend.reduce((s, m) => s + m.collected, 0)
  const totalPending12m = trend.reduce((s, m) => s + m.pending, 0)
  const totalOverdue12m = trend.reduce((s, m) => s + m.overdue, 0)

  const currentMonthData = trend[trend.length - 1]
  const prevMonthData = trend[trend.length - 2]

  const momChange =
    prevMonthData?.collected > 0
      ? Math.round(
          (((currentMonthData?.collected || 0) - prevMonthData.collected) / prevMonthData.collected) * 100
        )
      : null

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Collected (12 months)"
          value={formatCurrency(totalCollected12m)}
          icon={Wallet}
          accent="emerald"
        />
        <StatCard
          label="This Month Collected"
          value={formatCurrency(currentMonthData?.collected || 0)}
          sub={momChange !== null ? `${momChange >= 0 ? '+' : ''}${momChange}% vs last month` : undefined}
          icon={TrendingUp}
          accent="indigo"
        />
        <StatCard
          label="Pending Dues"
          value={formatCurrency(totalPending12m)}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(totalOverdue12m)}
          icon={AlertTriangle}
          accent="red"
        />
      </div>

      {/* 12-month chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-1 text-sm">Revenue Trend — Last 12 Months</h3>
        <p className="text-xs text-gray-400 mb-5">Monthly collected, pending, and overdue amounts by due date</p>
        <GroupedBarChart data={trend} height={200} />
      </div>

      {/* Collection efficiency */}
      {pd && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Overall Collection Efficiency</h3>
              <p className="text-xs text-gray-400">Percentage of total billed amount actually collected</p>
            </div>
            <span className={`text-2xl font-bold ${pd.collectionEfficiency >= 80 ? 'text-emerald-600' : pd.collectionEfficiency >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {pd.collectionEfficiency}%
            </span>
          </div>
          <SegmentBar
            segments={[
              { label: 'Collected', value: pd.totalCollected, color: 'bg-emerald-400' },
              { label: 'Pending', value: pd.totalPending, color: 'bg-amber-400' },
              { label: 'Overdue', value: pd.totalOverdue, color: 'bg-red-400' },
              { label: 'Waived', value: pd.totalWaived, color: 'bg-gray-300' },
            ]}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
            <span className="text-xs text-gray-500">Billed: <strong>{formatCurrency(pd.totalBilled)}</strong></span>
            <span className="text-xs text-emerald-600">Collected: <strong>{formatCurrency(pd.totalCollected)}</strong></span>
            <span className="text-xs text-amber-600">Pending: <strong>{formatCurrency(pd.totalPending)}</strong></span>
            <span className="text-xs text-red-600">Overdue: <strong>{formatCurrency(pd.totalOverdue)}</strong></span>
          </div>
        </div>
      )}

      {/* Recent 6 months table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Recent 6 Months Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Month</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-emerald-600 uppercase">Collected</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-amber-600 uppercase">Pending</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-red-600 uppercase">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentMonths.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{m.label}</td>
                  <td className="px-5 py-3 text-right text-emerald-700 font-medium">{formatCurrency(m.collected)}</td>
                  <td className="px-5 py-3 text-right text-amber-700">{m.pending > 0 ? formatCurrency(m.pending) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3 text-right text-red-700">{m.overdue > 0 ? formatCurrency(m.overdue) : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Occupancy ───────────────────────────────────────────────────────────

function OccupancyTab({ occupancy }) {
  const props = occupancy.data || []
  const totalRooms = props.reduce((s, p) => s + p.total, 0)
  const totalOccupied = props.reduce((s, p) => s + p.occupied, 0)
  const totalVacant = props.reduce((s, p) => s + p.vacant, 0)
  const totalMaintenance = props.reduce((s, p) => s + p.maintenance, 0)
  const overallOccupancy = totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Rooms" value={totalRooms} icon={Building2} accent="indigo" />
        <StatCard label="Occupied" value={totalOccupied} sub={`${overallOccupancy}% occupancy`} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Vacant" value={totalVacant} icon={AlertTriangle} accent="amber" />
        <StatCard label="Maintenance" value={totalMaintenance} icon={AlertTriangle} accent="red" />
      </div>

      {props.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No properties found. Add your first property to see occupancy data.</p>
        </div>
      ) : (
        <>
          {/* Bar chart of occupancy % */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-1">Occupancy Rate by Property</h3>
            <p className="text-xs text-gray-400 mb-5">Percentage of rooms occupied per property</p>
            <BarChart
              height={200}
              bars={props.map((p) => ({
                label: p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name,
                value: p.occupancyPct,
                color: p.occupancyPct >= 80 ? 'bg-emerald-500' : p.occupancyPct >= 50 ? 'bg-amber-400' : 'bg-red-400',
              }))}
              formatValue={(v) => `${v}%`}
            />
          </div>

          {/* Property table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Property-wise Room Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Property</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-emerald-600 uppercase">Occupied</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-amber-600 uppercase">Vacant</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-red-600 uppercase">Maint.</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-indigo-600 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {props.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{p.city || '—'}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{p.total}</td>
                      <td className="px-5 py-3 text-right text-emerald-700 font-medium">{p.occupied}</td>
                      <td className="px-5 py-3 text-right text-amber-700">{p.vacant}</td>
                      <td className="px-5 py-3 text-right text-red-600">{p.maintenance}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${p.occupancyPct >= 80 ? 'bg-emerald-100 text-emerald-800' : p.occupancyPct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                          {p.occupancyPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab: Tenants ─────────────────────────────────────────────────────────────

function TenantsTab({ tenants }) {
  const d = tenants.data

  if (!d) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Users size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No tenant data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Tenants" value={d.currentActive} icon={Users} accent="emerald" />
        <StatCard label="New This Month" value={d.newThisMonth} icon={TrendingUp} accent="indigo" />
        <StatCard label="Moved Out (this year)" value={d.movedOutThisYear} icon={AlertTriangle} accent="amber" />
        <StatCard
          label="Avg Tenancy Duration"
          value={d.avgTenancy > 0 ? `${d.avgTenancy} days` : '—'}
          sub={d.avgTenancy > 0 ? `≈ ${Math.round(d.avgTenancy / 30)} months` : 'No move-outs yet'}
          icon={BarChart3}
          accent="violet"
        />
      </div>

      {/* Retention card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Tenant Retention Rate</h3>
            <p className="text-xs text-gray-400">% of moved-out tenants who stayed ≥ 3 months</p>
          </div>
          <span className={`text-2xl font-bold ${d.retentionRate >= 70 ? 'text-emerald-600' : d.retentionRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
            {d.retentionRate}%
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${d.retentionRate >= 70 ? 'bg-emerald-400' : d.retentionRate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${clampPct(d.retentionRate)}%` }}
          />
        </div>
        {d.retentionRate === 0 && (
          <p className="text-xs text-gray-400 mt-2">No moved-out tenants to calculate retention yet.</p>
        )}
      </div>

      {/* Recent movements */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Recent Tenant Movements</h3>
          <p className="text-xs text-gray-400 mt-0.5">Most recent 15 tenants by move-in date</p>
        </div>
        {d.recentMovements.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No tenant records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Room / Property</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Move In</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Move Out</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {d.recentMovements.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{t.full_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      <span className="font-medium text-gray-700">{t.room}</span>
                      {t.property !== '—' && <span className="ml-1 text-gray-400">· {t.property}</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{t.move_in_date ? formatDate(t.move_in_date) : '—'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{t.move_out_date ? formatDate(t.move_out_date) : <span className="text-gray-300">Active</span>}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {t.active ? 'Active' : 'Moved Out'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Payments ────────────────────────────────────────────────────────────

function PaymentsAnalyticsTab({ payments }) {
  const d = payments.data
  if (!d) return null

  const STATUS_COLORS = {
    paid: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    overdue: 'bg-red-100 text-red-800',
    partial: 'bg-orange-100 text-orange-800',
    waived: 'bg-gray-100 text-gray-600',
  }
  const STATUS_BAR_COLORS = {
    paid: 'bg-emerald-400',
    pending: 'bg-amber-400',
    overdue: 'bg-red-400',
    partial: 'bg-orange-400',
    waived: 'bg-gray-300',
  }

  return (
    <div className="space-y-6">
      {/* Efficiency KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Collection Efficiency" value={`${d.collectionEfficiency}%`} icon={TrendingUp} accent={d.collectionEfficiency >= 80 ? 'emerald' : 'amber'} />
        <StatCard label="Total Billed" value={formatCurrency(d.totalBilled)} icon={Wallet} accent="indigo" />
        <StatCard label="Total Collected" value={formatCurrency(d.totalCollected)} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(d.totalPending + d.totalOverdue)} sub={`${formatCurrency(d.totalOverdue)} overdue`} icon={AlertTriangle} accent="red" />
      </div>

      {/* Status distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Payment Status Distribution</h3>
        <div className="space-y-3">
          {d.statusBreakdown
            .filter((s) => s.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-20 justify-center shrink-0 ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STATUS_BAR_COLORS[s.status] || 'bg-gray-400'}`}
                    style={{ width: `${clampPct(s.pct)}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="text-xs text-gray-500 w-8 text-right">{s.pct}%</span>
                  <span className="text-xs font-medium text-gray-700 w-16 text-right">{formatCurrency(s.amount)}</span>
                  <span className="text-xs text-gray-400 w-12 text-right">{s.count} bill{s.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Payment method breakdown */}
      {d.methodBreakdown.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-1">Payment Method Breakdown</h3>
          <p className="text-xs text-gray-400 mb-4">Based on paid and partial payments only</p>
          <div className="space-y-3">
            {d.methodBreakdown.map((m) => (
              <div key={m.method} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-28 shrink-0 truncate">{m.label}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-400"
                    style={{ width: `${clampPct(m.pct)}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="text-xs text-gray-500 w-8 text-right">{m.pct}%</span>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right">{formatCurrency(m.amount)}</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{m.count} txn{m.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Wallet size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No paid payments recorded yet. Method breakdown will appear here once payments are marked as paid.</p>
        </div>
      )}
    </div>
  )
}

// ─── Loading & Error states ───────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  )
}

// ─── Main ReportsPage ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'revenue', label: 'Revenue', icon: Wallet },
  { id: 'occupancy', label: 'Occupancy', icon: Building2 },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'payments', label: 'Payments', icon: BarChart3 },
]

export default function ReportsPage() {
  const isMountedRef = useRef(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [activeTab, setActiveTab] = useState('revenue')
  const [refreshKey, setRefreshKey] = useState(0)

  // Called from the Refresh button — increments key to re-trigger the effect
  const loadReports = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    isMountedRef.current = true
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      const result = await fetchAllReportData()
      if (cancelled || !isMountedRef.current) return

      const firstError =
        result.revenue.error ||
        result.occupancy.error ||
        result.tenants.error ||
        result.payments.error

      if (firstError) {
        setError(firstError)
      } else {
        setReportData(result)
      }
      setLoading(false)
    }

    run()

    return () => {
      cancelled = true
      isMountedRef.current = false
    }
  }, [refreshKey])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time insights from your properties, rooms, tenants, and payments.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadReports}
          loading={loading}
          className="shrink-0"
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Failed to load report data</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={loadReports}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <RefreshCw size={13} /> Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && reportData && (
        <>
          {activeTab === 'revenue' && (
            <RevenueTab revenue={reportData.revenue} payments={reportData.payments} />
          )}
          {activeTab === 'occupancy' && (
            <OccupancyTab occupancy={reportData.occupancy} />
          )}
          {activeTab === 'tenants' && (
            <TenantsTab tenants={reportData.tenants} />
          )}
          {activeTab === 'payments' && (
            <PaymentsAnalyticsTab payments={reportData.payments} />
          )}
        </>
      )}
    </div>
  )
}
