import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LoginForm } from '@/components/auth/LoginForm'

export const Route = createFileRoute('/')({ component: App })

// Sun icon with 28 sharper rays (Donna-style)
function SunIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M 12.00,0.00 L 12.50,7.53 L 14.67,0.30 L 13.49,7.75 L 17.21,1.19 L 14.39,8.19 L 19.48,2.62 L 15.18,8.82 L 21.38,4.52 L 15.81,9.61 L 22.81,6.79 L 16.25,10.51 L 23.70,9.33 L 16.47,11.50 L 24.00,12.00 L 16.47,12.50 L 23.70,14.67 L 16.25,13.49 L 22.81,17.21 L 15.81,14.39 L 21.38,19.48 L 15.18,15.18 L 19.48,21.38 L 14.39,15.81 L 17.21,22.81 L 13.49,16.25 L 14.67,23.70 L 12.50,16.47 L 12.00,24.00 L 11.50,16.47 L 9.33,23.70 L 10.51,16.25 L 6.79,22.81 L 9.61,15.81 L 4.52,21.38 L 8.82,15.18 L 2.62,19.48 L 8.19,14.39 L 1.19,17.21 L 7.75,13.49 L 0.30,14.67 L 7.53,12.50 L 0.00,12.00 L 7.53,11.50 L 0.30,9.33 L 7.75,10.51 L 1.19,6.79 L 8.19,9.61 L 2.62,4.52 L 8.82,8.82 L 4.52,2.62 L 9.61,8.19 L 6.79,1.19 L 10.51,7.75 L 9.33,0.30 L 11.50,7.53 Z" />
    </svg>
  )
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'Stay in Flow',
    description: 'Instant answers keep you moving without interruption'
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: 'Smart Routing',
    description: 'Connects leads from every channel into one conversation'
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: 'AI Memory',
    description: 'Remembers everything so you can think strategically'
  }
]

function App() {
  const navigate = useNavigate()

  const handleLoginSuccess = (session: any) => {
    navigate({ to: '/chat', search: { email: session.email } })
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="flex flex-col lg:flex-row min-h-screen">

        {/* Left Panel - Login Form (previously Right Panel) */}
        <div className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 sm:py-12 lg:py-0">
          <div className="w-full max-w-md">
            <LoginForm onLoginSuccess={handleLoginSuccess} />

            {/* Mobile features */}
            <div className="lg:hidden mt-8 space-y-4">
              {FEATURES.map((feature, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center shrink-0 text-white">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">{feature.title}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Branding (previously Left Panel) */}
        <div className="lg:flex-1 lg:flex lg:items-center lg:justify-center bg-stone-900 text-white px-6 py-8 sm:py-12 lg:py-0">
          <div className="max-w-md mx-auto lg:max-w-lg">
            {/* Logo + tagline */}
            <div className="flex items-center gap-3 lg:mb-12 mb-0">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <SunIcon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
              </div>
              <span className="text-lg lg:text-xl font-bold">SuperHuman</span>
            </div>

            {/* Hero text */}
            <div className="hidden lg:block">
              <h2 className="text-4xl xl:text-5xl font-bold leading-tight mt-0">
                Feel like a<br />
                <span className="text-stone-400">SuperHuman</span>
              </h2>
              <p className="text-lg text-stone-400 mt-4 max-w-sm">
                AI handles the details. You handle the strategy.
              </p>

              {/* Features */}
              <div className="mt-12 space-y-6">
                {FEATURES.map((feature, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-stone-300">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-stone-400 mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
