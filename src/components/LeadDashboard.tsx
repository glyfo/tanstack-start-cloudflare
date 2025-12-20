import { TrendingUp, Zap, AlertCircle, CheckCircle } from 'lucide-react'

interface LeadDashboardProps {
  hotLeadsCount?: number
  qualifiedCount?: number
  prospectCount?: number
  averageScore?: number
}

export function LeadDashboard({
  hotLeadsCount = 0,
  qualifiedCount = 0,
  prospectCount = 0,
  averageScore = 0,
}: LeadDashboardProps) {
  return (
    <div className="bg-black text-white p-6 rounded-lg border border-white/10">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        Lead Qualification Dashboard
      </h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Hot Leads */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:border-red-500/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-white/60">Hot Leads</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{hotLeadsCount}</div>
          <p className="text-xs text-white/40 mt-1">Ready to close</p>
        </div>

        {/* Qualified */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:border-yellow-500/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-white/60">Qualified</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{qualifiedCount}</div>
          <p className="text-xs text-white/40 mt-1">In pipeline</p>
        </div>

        {/* Prospects */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:border-blue-500/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-white/60">Prospects</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{prospectCount}</div>
          <p className="text-xs text-white/40 mt-1">To qualify</p>
        </div>

        {/* Average Score */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:border-green-500/50 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-white/60">Avg Score</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{averageScore.toFixed(0)}</div>
          <p className="text-xs text-white/40 mt-1">Out of 100</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          💡 Tip: Share prospect details to get instant lead scores and route them to the right sales rep.
        </p>
      </div>
    </div>
  )
}
