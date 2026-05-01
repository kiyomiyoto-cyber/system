-- Adds the `comptable` (accountant) role to public.users.
-- Comptable has back-office access similar to dispatcher but oriented around
-- billing: invoices, clients, reports. UI access is enforced at the layout
-- layer; RLS continues to gate sensitive writes by role where needed.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'dispatcher', 'comptable', 'driver', 'client'));
