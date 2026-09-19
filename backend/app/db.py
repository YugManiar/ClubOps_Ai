from supabase import create_client, Client

from app.config import settings

# Service-role key: bypasses RLS. This is the backend's only DB entrypoint.
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
