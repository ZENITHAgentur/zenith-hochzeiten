import { useState, useCallback } from 'react'
import { Dashboard } from '@/pages/Dashboard'
import { Bookings } from '@/pages/Bookings'
import { Availability } from '@/pages/Availability'
import { Customers } from '@/pages/Customers'
import { Layout } from '@/components/layout/Layout'
import type { Page } from '@/components/layout/Sidebar'
import { Toast } from '@/components/ui/Toast'
import type { ToastData } from '@/components/ui/Toast'
import type { BookingWithRefs } from '@/lib/database.types'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [toast, setToast] = useState<ToastData | null>(null)
  const [openBooking, setOpenBooking] = useState<BookingWithRefs | null>(null)

  const showToast = useCallback((t: ToastData) => setToast(t), [])

  const handleOpenBooking = (b: BookingWithRefs) => {
    setOpenBooking(b)
    setPage('bookings')
  }

  return (
    <>
      <Layout page={page} onNavigate={setPage} onSignOut={() => {}}>
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
