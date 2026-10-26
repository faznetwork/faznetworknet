-- Routers remain inactive until an administrator successfully tests and saves them in the UI.
-- Existing imported router records are preserved and default to not manually activated.
ALTER TABLE public.router_devices
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_router_devices_active_native
  ON public.router_devices(id)
  WHERE is_active=TRUE AND api_type='native_api';
