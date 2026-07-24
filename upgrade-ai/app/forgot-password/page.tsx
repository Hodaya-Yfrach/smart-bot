
'use client'

import { useState } from 'react'
import { supabase } from '@/services/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')    
    // שליחת המייל דרך סופאבייס
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('מייל לאיפוס סיסמה נשלח בהצלחה! בדוק את תיבת הדואר שלך.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md text-center">
        <h1 className="text-2xl font-bold mb-6">איפוס סיסמה</h1>
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4 text-right" dir="rtl">
          <label className="text-sm font-medium text-gray-700">אימייל:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="הכנס את האימייל שלך"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
          </button>
        </form>

        {message && <p className="mt-4 text-green-600 font-medium">{message}</p>}
        {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}

        <div className="mt-6">
          <Link href="/" className="text-blue-500 hover:underline text-sm">
            חזרה להתחברות
          </Link>
        </div>
      </div>
    </div>
  )
}