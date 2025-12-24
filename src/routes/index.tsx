import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Zap, Sparkles, Brain } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'

export const Route = createFileRoute('/')({ component: App })

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Stay in Flow',
    description: 'Instant answers keep you moving without interruption'
  },
  {
    icon: Zap,
    title: 'Keep Your Focus',
    description: 'Smart routing connects you to the right expert automatically'
  },
  {
    icon: Brain,
    title: 'Free Your Mind',
    description: 'AI remembers everything so you can think strategically'
  }
]

function App() {
  const navigate = useNavigate()

  const handleLoginSuccess = (session: any) => {
    navigate({ to: '/chat', search: { email: session.email } })
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column - Login Card */}
          <div className="max-w-md mx-auto w-full">
            <LoginForm onLoginSuccess={handleLoginSuccess} />
          </div>

          {/* Right Column - Features & Information */}
          <div className="hidden lg:flex flex-col justify-center space-y-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                  <Zap size={14} />
                  Advanced AI
                </div>
                <h2 className="text-4xl font-bold text-slate-900 leading-tight">
                  Feel like a SuperHuman
                </h2>
                <p className="text-lg text-slate-600">
                  AI handles the details. You handle the strategy.
                </p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="space-y-4">
              {FEATURES.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <div key={idx} className="flex gap-4 group">
                    <div className="shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-slate-100 text-slate-900 group-hover:bg-blue-100 group-hover:text-blue-900 transition-colors">
                        <Icon size={20} />
                      </div>
                    </div>
                    <div className="grow">
                      <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                      <p className="text-sm text-slate-600 mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}