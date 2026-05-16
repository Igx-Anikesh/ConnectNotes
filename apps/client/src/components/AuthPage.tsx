import { useState } from 'react'

interface AuthPageProps {
  onComplete: (user: { id: string }) => void
  onClose: () => void
  sendOtp: (contact: string) => Promise<void>
  verifyOtp: (contact: string, token: string) => Promise<unknown>
  updateProfile: (name: string) => Promise<void>
}

type AuthStep = 'contact' | 'otp' | 'setup'

export function AuthPage({ onComplete, onClose, sendOtp, verifyOtp, updateProfile }: AuthPageProps) {
  const [step, setStep] = useState<AuthStep>('contact')
  
  // Form states
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contact) return
    setIsLoading(true)
    setError('')
    try {
      await sendOtp(contact.trim())
      setStep('otp')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1]
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto focus next
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.some(digit => !digit)) return
    setIsLoading(true)
    setError('')
    try {
      const token = otp.join('')
      const data: any = await verifyOtp(contact.trim(), token)
      const existingName = data?.user?.user_metadata?.display_name
      if (existingName) {
        onComplete({ id: existingName })
      } else {
        setStep('setup')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.length < 2) return
    setIsLoading(true)
    setError('')
    try {
      await updateProfile(name)
      onComplete({ id: name })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create profile. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-overlay fade-in">
      <div className="auth-card">
        <button className="auth-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="auth-header">
          <div className="auth-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2>{step === 'contact' ? 'Welcome to DraftBoard' : step === 'otp' ? 'Verify your identity' : 'Create your Profile'}</h2>
          <p>
            {step === 'contact' && 'Enter your email address to sign in or create an account.'}
            {step === 'otp' && `We've sent a 6-digit code to ${contact}`}
            {step === 'setup' && 'Enter your name to complete your profile.'}
          </p>
        </div>

        <div className="auth-body">
          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {step === 'contact' && (
            <form onSubmit={handleContactSubmit} className="auth-form">
              <div className="auth-input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={!contact || isLoading}>
                {isLoading ? <span className="auth-spinner" /> : 'Continue'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="auth-form">
              <div className="auth-input-group">
                <label>One-Time Password</label>
                <div className="otp-container">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="otp-input"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" className="auth-submit-btn" disabled={otp.some(d => !d) || isLoading}>
                {isLoading ? <span className="auth-spinner" /> : 'Verify Code'}
              </button>
              <button type="button" className="auth-text-btn" onClick={() => { setStep('contact'); setError('') }}>
                Use a different method
              </button>
            </form>
          )}

          {step === 'setup' && (
            <form onSubmit={handleSetupSubmit} className="auth-form">
              <div className="auth-input-group">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={name.length < 2 || isLoading}>
                {isLoading ? <span className="auth-spinner" /> : 'Complete Setup'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
