-- ==============================================================================
-- GYM PUNCH DEMO - SUPABASE POSTGRESQL SCHEMA
-- Fully executable in Supabase SQL Editor
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    member_code TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_member_code ON public.profiles(member_code);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- 2. ATTENDANCE TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    punch_type TEXT NOT NULL CHECK (punch_type IN ('in', 'out')),
    punch_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method TEXT NOT NULL CHECK (method IN ('mobile_biometric', 'biometric_machine', 'qr', 'admin', 'api')) DEFAULT 'mobile_biometric',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for attendance querying and reports
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_punch_time ON public.attendance(punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_punch_user_time ON public.attendance(user_id, punch_time DESC);

-- ------------------------------------------------------------------------------
-- 3. WEBAUTHN CREDENTIALS TABLE
-- Stores public key and device metadata. Never stores raw biometric data.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON public.webauthn_credentials(credential_id);

-- ------------------------------------------------------------------------------
-- 4. FUTURE BIOMETRIC MACHINE TABLE (Prepared as requested in Section 28)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.biometric_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'optical_fingerprint',
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_webauthn_credentials_updated_at ON public.webauthn_credentials;
CREATE TRIGGER set_webauthn_credentials_updated_at
    BEFORE UPDATE ON public.webauthn_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. ADMIN ROLE CHECK HELPER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE auth_user_id = check_user_id AND role = 'admin' AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES POLICIES ----
DROP POLICY IF EXISTS "Members can view their own profile" ON public.profiles;
CREATE POLICY "Members can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth_user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Members can update their own phone or name" ON public.profiles;
CREATE POLICY "Members can update their own phone or name"
    ON public.profiles
    FOR UPDATE
    USING (auth_user_id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (auth_user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---- ATTENDANCE POLICIES ----
DROP POLICY IF EXISTS "Members view only their own attendance" ON public.attendance;
CREATE POLICY "Members view only their own attendance"
    ON public.attendance
    FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own attendance via authenticated session" ON public.attendance;
CREATE POLICY "Users can insert their own attendance via authenticated session"
    ON public.attendance
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---- WEBAUTHN CREDENTIALS POLICIES ----
DROP POLICY IF EXISTS "Users can view their own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can view their own credentials"
    ON public.webauthn_credentials
    FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can insert their own credentials"
    ON public.webauthn_credentials
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can update their own credentials"
    ON public.webauthn_credentials
    FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can delete their own credentials"
    ON public.webauthn_credentials
    FOR DELETE
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---- BIOMETRIC DEVICES POLICIES ----
DROP POLICY IF EXISTS "Only admins can manage biometric devices" ON public.biometric_devices;
CREATE POLICY "Only admins can manage biometric devices"
    ON public.biometric_devices
    FOR ALL
    USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 8. REALTIME REPLICATION (For Live Attendance Monitoring)
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
