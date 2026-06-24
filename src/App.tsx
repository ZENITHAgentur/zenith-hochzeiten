import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Bookings } from '@/pages/Bookings'
import { Availability } from '@/pages/Availability'
import { Customers } from '@/pages/Customers'
import { Layout } from '@/components/layout/Layout'
import type { Page } from '@/components/layout/Sidebar'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import type { ToastData } from '@/components/ui/Toast'
import type { BookingWithRefs } from '@/lib/database.types'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [page, setPage] = useState<Page>('dashboard')
  const [toast, setToast] = useState<ToastData | null>(null)
  const [openBooking, setOpenBooking] = useState<BookingWithRefs | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const showToast = useCallback((t: ToastData) => {
    setToast(t)
  }, [])

  const handleOpenBooking = (b: BookingWithRefs) => {
    setOpenBooking(b)
    setPage('bookings')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Still determining auth state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-muted text-sm">Laden…</div>
      </div>
    )
  }

  if (!session) return <Login />

  const headerRight = (
    <Button variant="ghost" size="sm" onClick={handleSignOut}>
      {session.user.email}
    </Button>
  )

  return (
    <>
      <Layout page={page} onNavigate={setPage} onSignOut={handleSignOut} headerRight={headerRight}>
        {page === 'dashboard' && (
          <Dashboard onOpenBooking={handleOpenBooking} />
        )}
        {page === 'bookings' && (
          <Bookings
            openBooking={openBooking}
            onClearOpen={() => setOpenBooking(null)}
            onToast={showToast}
          />
        )}
        {page === 'availability' && (
          <Availability onToast={showToast} />
        )}
        {page === 'customers' && (
          <Customers onToast={showToast} />
        )}
      </Layout>

      {toast && (
        <Toast toast={toast} onClose={() => setToast(null)} />
      )}
    </>
  )
}
