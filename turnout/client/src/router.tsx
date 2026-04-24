import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminLoginPage } from '@/pages/auth/AdminLoginPage'
import { AttendeeLoginPage } from '@/pages/auth/AttendeeLoginPage'
import { AttendeeRegisterPage } from '@/pages/auth/AttendeeRegisterPage'
import { OrganizerLoginPage } from '@/pages/auth/OrganizerLoginPage'
import { OrganizerRegisterPage } from '@/pages/auth/OrganizerRegisterPage'
import { DiscoverPage } from '@/pages/attendee/DiscoverPage'
import { PaymentSuccessPage } from '@/pages/attendee/PaymentSuccessPage'
import { TicketsPage } from '@/pages/attendee/TicketsPage'
import { EventBuilderPage } from '@/pages/organizer/EventBuilderPage'
import { EventNewPage } from '@/pages/organizer/EventNewPage'
import { EventTiersPage } from '@/pages/organizer/EventTiersPage'
import { OrganizerDashboardPage } from '@/pages/organizer/OrganizerDashboardPage'
import { EventPublicPage } from '@/pages/public/EventPublicPage'
import { HomePage } from '@/pages/HomePage'
import { RequireAuth } from '@/routes/RequireAuth'
import { RequireRole } from '@/routes/RequireRole'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'e/:slug', element: <EventPublicPage /> },

      { path: 'attendee/login', element: <AttendeeLoginPage /> },
      { path: 'attendee/register', element: <AttendeeRegisterPage /> },
      { path: 'attendee/discover', element: <DiscoverPage /> },
      {
        path: 'attendee/tickets',
        element: (
          <RequireAuth redirectTo="/attendee/login">
            <TicketsPage />
          </RequireAuth>
        ),
      },
      { path: 'attendee/payment/success', element: <PaymentSuccessPage /> },

      { path: 'organizer/login', element: <OrganizerLoginPage /> },
      { path: 'organizer/register', element: <OrganizerRegisterPage /> },
      {
        path: 'organizer',
        element: (
          <RequireRole roles={['organizer', 'admin']} redirectTo="/organizer/login">
            <OrganizerDashboardPage />
          </RequireRole>
        ),
      },
      {
        path: 'organizer/events/new',
        element: (
          <RequireRole roles={['organizer', 'admin']} redirectTo="/organizer/login">
            <EventNewPage />
          </RequireRole>
        ),
      },
      {
        path: 'organizer/events/:id/builder',
        element: (
          <RequireRole roles={['organizer', 'admin']} redirectTo="/organizer/login">
            <EventBuilderPage />
          </RequireRole>
        ),
      },
      {
        path: 'organizer/events/:id/tiers',
        element: (
          <RequireRole roles={['organizer', 'admin']} redirectTo="/organizer/login">
            <EventTiersPage />
          </RequireRole>
        ),
      },

      { path: 'admin/login', element: <AdminLoginPage /> },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['admin']} redirectTo="/admin/login">
            <AdminDashboardPage />
          </RequireRole>
        ),
      },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
