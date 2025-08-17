import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Play, Bot, Zap, Users, CheckCircle, ArrowRight, Star, Clock, BookOpen } from 'lucide-react'
import { Navbar } from '@components/Navbar'

export const HomePage: React.FC = () => {
  const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const { isSignedIn, isLoaded } = useAuth()

  const features = [
    {
      icon: <Play className="h-6 w-6" />,
      title: 'Video Learning',
      description: 'Upload your training videos and let AI automatically extract key learning points and create structured modules.'
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: 'AI Assistance',
      description: 'Get real-time help from our AI tutor that understands your training content and answers questions instantly.'
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Interactive Training',
      description: 'Step-by-step guidance with timestamped videos, progress tracking, and hands-on learning experiences.'
    }
  ]

  const stats = [
    { label: 'Training Modules', value: '10,000+', icon: <BookOpen className="h-5 w-5" /> },
    { label: 'Active Learners', value: '50,000+', icon: <Users className="h-5 w-5" /> },
    { label: 'Completion Rate', value: '94%', icon: <CheckCircle className="h-5 w-5" /> },
    { label: 'Avg. Time Saved', value: '3 hours', icon: <Clock className="h-5 w-5" /> }
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Training Manager',
      company: 'TechCorp',
      content: 'Adapt transformed how we onboard new employees. The AI assistance makes complex procedures easy to understand.',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'Operations Director',
      company: 'Healthcare Plus',
      content: 'Our training completion rates increased by 40% after switching to Adapt. The interactive format keeps people engaged.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Learning Specialist',
      company: 'RetailMax',
      content: 'The ability to chat with an AI that knows our training content is game-changing. Questions get answered immediately.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />

      <section className="text-center py-24 px-4">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Adapt</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
          AI-powered interactive training platform where you learn real-world tasks through videos, step-by-step guidance, and intelligent assistance.
        </p>
        {!clerkConfigured && (
          <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 p-4 rounded mb-6 max-w-md mx-auto">
            ⚠️ Authentication not configured. Set VITE_CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable sign-in.
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isLoaded && isSignedIn ? (
            <>
              <Link to="/dashboard" className="btn-primary">Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" /></Link>
              <Link to="/upload" className="btn-secondary">Upload Video</Link>
            </>
          ) : clerkConfigured ? (
            <>
              <Link to="/sign-up" className="btn-primary">Get Started <ArrowRight className="ml-2 h-5 w-5" /></Link>
              <Link to="/sign-in" className="btn-secondary">Sign In</Link>
            </>
          ) : (
            <Link to="/dashboard" className="btn-primary">Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" /></Link>
          )}
        </div>
      </section>

      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">Everything you need to train effectively</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow">
                <div className="text-blue-600 dark:text-blue-400 mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <div key={i}>
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded mb-4">{stat.icon}</div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-blue-100">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">Loved by training professionals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow border dark:border-gray-600">
                <div className="flex items-center mb-4">
                  {Array.from({ length: t.rating }).map((_, idx) => <Star key={idx} className="h-5 w-5 text-yellow-400" />)}
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">"{t.content}"</p>
                <div className="text-gray-900 dark:text-white font-semibold">{t.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.role} at {t.company}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
