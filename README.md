# School Lost and Found

Initial Next.js App Router + Supabase implementation for a school lost and found system.

## Setup

1. Copy `.env.example` to `.env.local` and add your Supabase URL and publishable key.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

## Included

- `supabase/schema.sql`: tables, enums, indexes, RLS policies, storage bucket policies, approval and claim notification triggers, and realtime publication setup.
- `app/hooks/useAuth.ts`: Supabase Auth session/profile hook with role helpers.
- `app/components/ItemCard.tsx`: feed card with image, status, and claim action.
- `app/components/AdminDashboard.tsx`: admin moderation dashboard with approve, reject, returned actions and realtime item refresh.
- `app/components/NotificationBell.tsx`: realtime unread notification count.
- `app/components/ProtectedRoute.tsx`: client-side route guard for `/admin`.

Admin roles should be assigned from a trusted context, such as the Supabase dashboard or a server/service-role admin tool, by setting `profiles.role = 'admin'` or `auth.users.raw_app_meta_data.role = 'admin'`.
