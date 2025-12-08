import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Sparkles,
  ArrowRight,
  Clock,
  Check,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ days: 5, hours: 18, minutes: 42, seconds: 23 })

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, minutes, seconds } = prev
        seconds--
        if (seconds < 0) {
          seconds = 59
          minutes--
          if (minutes < 0) {
            minutes = 59
            hours--
            if (hours < 0) {
              hours = 23
              days--
              if (days < 0) {
                days = 5
              }
            }
          }
        }
        return { days, hours, minutes, seconds }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLaunchChat = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateEmail(email)) {
      alert('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    // Simulate validation
    setTimeout(() => {
      setIsLoading(false)
      // Navigate to chat route with email
      navigate({ to: '/chat', search: { email } })
    }, 800)
  }

  // Landing Page
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Background Decorative Elements - Minimal */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gray-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-50/40 rounded-full blur-3xl"></div>
      </div>

      {/* Main Card Container */}
      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center">
          
          {/* Left Section - Access Card */}
          <div className="flex justify-center lg:justify-start">
            <div className="w-full max-w-md">
              {/* Card with gradient border effect */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-black rounded-3xl blur-lg opacity-0 group-hover:opacity-5 transition duration-300"></div>
                
                <div className="relative bg-white rounded-2xl p-6 lg:p-10 shadow-sm border border-gray-200 space-y-5">
                  {/* Limited Spots Badge */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    Only 200 Spots Left
                  </div>

                  {/* Header Icon */}
                  <div className="flex justify-center pt-4">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <Sparkles className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl lg:text-3xl font-bold text-black">Get Early Access</h2>
                    <p className="text-sm lg:text-base text-gray-600">Secure your spot in the SuperHuman revolution</p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleLaunchChat} className="space-y-4">
                    <div>
                      <label className="block text-xs lg:text-sm font-medium text-gray-900 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-4 lg:px-5 py-2.5 lg:py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-sm"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !validateEmail(email)}
                      className="w-full px-4 lg:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm lg:text-base rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                      {isLoading ? 'Launching...' : (
                        <>
                          <MessageSquare className="w-4 h-4 lg:w-5 lg:h-5" />
                          Access Console
                          <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" />
                        </>
                      )}
                    </button>
                  </form>



                  {/* Footer Text */}
                  <p className="text-center text-gray-500 text-xs">
                    By accessing, you agree to our{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                      Terms
                    </a>
                    {' '}and{' '}
                    <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                      Privacy
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Content */}
          <div className="space-y-2.5 lg:space-y-4">
            {/* Powered by Badge */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-blue-600">Powered by AI</span>
            </div>

            {/* Headline */}
            <div className="space-y-1.5 lg:space-y-2">
              <h1 className="text-3xl lg:text-5xl xl:text-6xl font-black text-black leading-tight">
                Feel like a <span className="text-blue-600">SuperHuman</span>
              </h1>
              <p className="text-xs lg:text-sm xl:text-base text-gray-600 leading-relaxed">
                Experience the future of productivity with elegance, grace, and revolutionary AI-powered sophistication.
              </p>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col gap-1">
              <div className="text-xs lg:text-sm font-medium text-gray-700">
                <span className="text-blue-600">★</span> Join 10,000+ professionals
              </div>
              <div className="text-xs lg:text-sm font-medium text-gray-700">
                <span className="text-blue-600">★</span> Trusted by leading global companies
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="bg-white rounded-lg lg:rounded-xl p-2 lg:p-3 text-black space-y-1 lg:space-y-2 shadow-sm border border-gray-200">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" />
                <span className="font-bold text-xs lg:text-sm text-gray-900">Limited Time Offer</span>
              </div>
              
              <div className="grid grid-cols-4 gap-1">
                {/* Days */}
                <div className="bg-blue-600 backdrop-blur-sm rounded p-1.5 lg:p-2 text-center border border-blue-700">
                  <div className="text-sm lg:text-lg xl:text-xl font-bold text-white">{String(timeLeft.days).padStart(2, '0')}</div>
                  <div className="text-xs mt-0.5 text-blue-100 font-medium">Days</div>
                </div>

                {/* Hours */}
                <div className="bg-blue-600 backdrop-blur-sm rounded p-1.5 lg:p-2 text-center border border-blue-700">
                  <div className="text-sm lg:text-lg xl:text-xl font-bold text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
                  <div className="text-xs mt-0.5 text-blue-100 font-medium">Hours</div>
                </div>

                {/* Minutes */}
                <div className="bg-blue-600 backdrop-blur-sm rounded p-1.5 lg:p-2 text-center border border-blue-700">
                  <div className="text-sm lg:text-lg xl:text-xl font-bold text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
                  <div className="text-xs mt-0.5 text-blue-100 font-medium">Mins</div>
                </div>

                {/* Seconds */}
                <div className="bg-blue-600 backdrop-blur-sm rounded p-1.5 lg:p-2 text-center border border-blue-700">
                  <div className="text-sm lg:text-lg xl:text-xl font-bold text-white">{String(timeLeft.seconds).padStart(2, '0')}</div>
                  <div className="text-xs mt-0.5 text-blue-100 font-medium">Secs</div>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="bg-white rounded-lg lg:rounded-xl p-2.5 lg:p-4 space-y-1.5 border border-gray-200">
              <div className="flex items-center gap-2 lg:gap-2.5 text-gray-800">
                <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-white" />
                </div>
                <span className="text-xs lg:text-sm font-medium">Intelligent automation</span>
              </div>
              <div className="flex items-center gap-2 lg:gap-2.5 text-gray-800">
                <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-white" />
                </div>
                <span className="text-xs lg:text-sm font-medium">Seamless collaboration</span>
              </div>
              <div className="flex items-center gap-2 lg:gap-2.5 text-gray-800">
                <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-white" />
                </div>
                <span className="text-xs lg:text-sm font-medium">Premium security</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}