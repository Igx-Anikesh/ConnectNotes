import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

const ALLOWED_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'live.com',
  'msn.com'
]

function normalizeEmail(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase()
  if (!email.includes('@')) throw new Error('Invalid email format.')
  
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) throw new Error('Invalid email format.')
  
  if (!ALLOWED_DOMAINS.includes(domain)) {
    throw new Error('Please use a reputed email provider (e.g., Gmail, Outlook, Yahoo). Temp emails are not allowed.')
  }
  
  let normalizedLocal = localPart
  
  // Remove + aliases for all domains to prevent multi-accounting
  if (normalizedLocal.includes('+')) {
    normalizedLocal = normalizedLocal.split('+')[0]
  }
  
  // Gmail ignores dots in the local part, so strip them to get the canonical email
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    normalizedLocal = normalizedLocal.replace(/\./g, '')
  }
  
  return `${normalizedLocal}@${domain}`
}

export interface AppUser {
  id: string
  email?: string
  userId?: string // custom display name / username
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s?.user) setUser(mapUser(s.user))
      setLoading(false)
    })

    // Subscribe to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s)
        setUser(s?.user ? mapUser(s.user) : null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Send OTP to email
  const sendOtp = useCallback(async (contact: string) => {
    const canonicalEmail = normalizeEmail(contact)
    const { error } = await supabase.auth.signInWithOtp({ email: canonicalEmail })
    if (error) throw error
  }, [])

  // Verify OTP
  const verifyOtp = useCallback(async (contact: string, token: string) => {
    const canonicalEmail = normalizeEmail(contact)
    const { data, error } = await supabase.auth.verifyOtp({
      email: canonicalEmail,
      token,
      type: 'email',
    })
    if (error) throw error
    return data
  }, [])

  // Update user profile (username)
  const updateProfile = useCallback(async (name: string) => {
    // Update the user's metadata with their chosen name
    const { error: metaError } = await supabase.auth.updateUser({
      data: { display_name: name }
    })
    if (metaError) throw metaError

    // Also store in a profiles table for public access
    if (session?.user) {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        username: name,
        updated_at: new Date().toISOString(),
      })
    }

    setUser(prev => prev ? { ...prev, userId: name } : null)
  }, [session])

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  return { user, session, loading, sendOtp, verifyOtp, updateProfile, signOut }
}

function mapUser(u: User): AppUser {
  return {
    id: u.user_metadata?.display_name || u.email || u.id.slice(0, 8),
    email: u.email,
    userId: u.user_metadata?.display_name,
  }
}
