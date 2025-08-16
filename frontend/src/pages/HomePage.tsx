import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { 
  Play, 
  Bot, 
  Zap, 
  Users, 
  CheckCircle, 
  ArrowRight,
  Star,
  Clock,
  BookOpen
} from 'lucide-react'

export const HomePage: React.FC = () => {
  const clerkConfigured = !!(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const { isSignedIn, isLoaded } = useAuth()
  
  // Debug logging
  console.log('🔍 HomePage Debug:')
  console.log('📧 CLERK_PUBLISHABLE_KEY:', (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ? 'SET' : 'NOT SET')
  console.log('🔧 clerkConfigured:', clerkConfigured)
  console.log('🔐 isSignedIn:', isSignedIn)
  console.log('📦 isLoaded:', isLoaded)
  console.log('🌐 Current URL:', window.location.href)
  console.log('🔗 Current domain:', window.location.hostname)

  const features = [
    {
      icon: <Play className="h-6 w-6" />,
      title: "Video Learning",
      description: "Upload your training videos and let AI automatically extract key learning points and create structured modules."
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: "AI Assistance", 
      description: "Get real-time help from our AI tutor that understands your training content and answers questions instantly."
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Interactive Training",
      description: "Step-by-step guidance with timestamped videos, progress tracking, and hands-on learning experiences."
    }
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Training Manager",
      company: "TechCorp",
      content: "Adapt transformed how we onboard new employees. The AI assistance makes complex procedures easy to understand.",
      rating: 5
    },
    {
      name: "Michael Chen", 
      role: "Operations Director",
      company: "Healthcare Plus",
      content: "Our training completion rates increased by 40% after switching to Adapt. The interactive format keeps people engaged.",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "Learning Specialist", 
      company: "RetailMax",
      content: "The ability to chat with an AI that knows our training content is game-changing. Questions get answered immediately.",
      rating: 5
    }
  ]

  const stats = [
    { label: "Training Modules", value: "10,000+", icon: <BookOpen className="h-5 w-5" /> },
    { label: "Active Learners", value: "50,000+", icon: <Users className="h-5 w-5" /> },
    { label: "Completion Rate", value: "94%", icon: <CheckCircle className="h-5 w-5" /> },
    { label: "Avg. Time Saved", value: "3 hours", icon: <Clock className="h-5 w-5" /> }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <span className="text-xl" role="img" aria-label="Rocket">🚀</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">Adapt</span>
            </div>
                          <div className="flex items-center space-x-4">
                {isLoaded && isSignedIn ? (
                  // Signed in user - show app navigation
                  <>
                    <Link
                      to="/dashboard"
                      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/upload"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Upload Video
                    </Link>
                  </>
                ) : clerkConfigured ? (
                  // Not signed in, Clerk configured - show auth buttons
                  <>
                    <Link
                      to="/sign-in"
                      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/sign-up"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Get Started
                    </Link>
                  </>
                ) : (
                  // Development mode - show test buttons
                  <>
                    <Link
                      to="/dashboard"
                      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
                    >
                      Sign In (Dev)
                    </Link>
                    <Link
                      to="/upload"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Get Started (Dev)
                    </Link>
                    <button
                      onClick={() => {
                        console.log('🔧 Testing direct navigation...')
                        window.location.href = '/dashboard'
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium ml-2"
                    >
                      Test Direct
                    </button>
                    <button
                      onClick={() => {
                        console.log('🔧 Testing upload page...')
                        window.location.href = '/upload'
                      }}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium ml-2"
                    >
                      Test Upload
                    </button>
                  </>
                )}
              </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Adapt
              </span>
          </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              AI-powered interactive training platform where you learn real-world tasks through videos, 
              step-by-step guidance, and intelligent assistance.
          </p>
          
          {!clerkConfigured && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 mb-8 max-w-md mx-auto">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                ⚠️ Authentication not configured. Set VITE_CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable sign-in.
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isLoaded && isSignedIn ? (
              // Signed in user - show app actions
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Upload Video
                </Link>
              </>
            ) : clerkConfigured ? (
              // Not signed in, Clerk configured - show auth buttons
              <>
                <Link
                  to="/sign-up"
                    className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                  >
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Sign In
                  </Link>
                </>
              ) : (
                // Development mode - show test button
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything you need to train effectively
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powerful features designed to make learning engaging, interactive, and results-driven.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="relative group">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700 h-full">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-lg mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <span aria-hidden="true">{feature.icon}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-lg mb-4">
                  <span aria-hidden="true">{stat.icon}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-blue-100 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Loved by training professionals
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              See how organizations are transforming their training with Adapt.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white dark:bg-gray-700 p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-600">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role} at {testimonial.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to transform your training?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of organizations already using Adapt to create engaging, effective training experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {clerkConfigured ? (
              <>
                <Link
                  to="/sign-up"
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/sign-in"
                  className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Sign In
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/upload"
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                >
                  Start Free Trial (Dev)
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Sign In (Dev)
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
