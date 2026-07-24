'use client'

import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    // עדכון הסיסמה של המשתמש המחובר (הוא מחובר זמנית דרך הקישור מהמייל)
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      setError('שגיאה בעדכון הסיסמה: ' + error.message)
    } else {
      setMessage('הסיסמה עודכנה בהצלחה! מעביר אותך לעמוד הראשי...')
      // המתנה קלה והעברה לעמוד הראשי
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md text-center">
        <h1 className="text-2xl font-bold mb-6">הגדרת סיסמה חדשה</h1>
        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 text-right" dir="rtl">
          <label className="text-sm font-medium text-gray-700">סיסמה חדשה:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border p-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="לפחות 6 תווים"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'מעדכן...' : 'עדכן סיסמה'}
          </button>
        </form>

        {message && <p className="mt-4 text-green-600 font-medium">{message}</p>}
        {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}
      </div>
    </div>
  )
}