-- ==============================================================================
-- GYM PUNCH DEMO - SEED DATA
-- Instructions:
-- 1. Create users first in the Supabase Dashboard -> Authentication -> Users:
--    - admin@gympunch.local (Password: admin123456)
--    - member@gympunch.local (Password: member123456)
--    - rahul@gympunch.local (Password: member123456)
--
-- 2. Once the auth users are created, copy their User IDs (UUID) and replace
--    the placeholder UUIDs below, then run this script in SQL Editor.
-- ==============================================================================

-- Example Seed Profiles (Adjust auth_user_id with your actual Supabase auth.users IDs)

/*
-- Demo Admin Profile
INSERT INTO public.profiles (auth_user_id, full_name, member_code, phone, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000001', -- Replace with your Admin Auth User ID
    'Gym Manager',
    'ADM-001',
    '+91 9876543210',
    'admin',
    'active'
) ON CONFLICT (member_code) DO NOTHING;

-- Demo Member 1 Profile (Kishan Yadav)
INSERT INTO public.profiles (auth_user_id, full_name, member_code, phone, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000002', -- Replace with your Member Auth User ID
    'Kishan Yadav',
    'GYM-0001',
    '+91 9811122233',
    'member',
    'active'
) ON CONFLICT (member_code) DO NOTHING;

-- Demo Member 2 Profile (Rahul Sharma)
INSERT INTO public.profiles (auth_user_id, full_name, member_code, phone, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000003', -- Replace with your Member Auth User ID
    'Rahul Sharma',
    'GYM-0002',
    '+91 9822233344',
    'member',
    'active'
) ON CONFLICT (member_code) DO NOTHING;
*/

-- Future Biometric Machine Demo Registration (Section 28)
INSERT INTO public.biometric_devices (device_name, serial_number, device_type, status)
VALUES 
    ('Main Entrance Turnstile Scanner', 'ZKT-E9-994821', 'optical_fingerprint', 'active'),
    ('Weight Room Access Terminal', 'SUPR-BIO-11029', 'facial_biometric', 'active')
ON CONFLICT (serial_number) DO NOTHING;
