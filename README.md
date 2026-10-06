# 🏋️ Gym Punch Demo — Mobile Biometric Attendance

A lightweight, production-ready **Mobile Biometric Gym Punching Demo** built with:
- **Next.js 16+ (App Router)**
- **TypeScript & Tailwind CSS**
- **Supabase PostgreSQL & Supabase Auth**
- **WebAuthn / Passkeys (`@simplewebauthn`)**
- **Mobile-first Responsive UI**

Gym members punch attendance using their mobile phone's native **fingerprint scanner, Face ID, or device biometric PIN**. No raw biometric images or templates are ever captured or stored. Attendance records are cryptographically verified using public-key cryptography and saved to Supabase.

The system is structured so that **future physical biometric hardware machines** can seamlessly plug into the same attendance engine.

---

## 📱 Architecture & Flow

```text
       MEMBER MOBILE PHONE
                │
                ▼
  Fingerprint / Face ID / Passkey
                │
                ▼
      WebAuthn Challenge & Assertion
                │
                ▼
      Next.js Server API
      (Cryptographic Signature Verification)
                │
                ▼
      Supabase PostgreSQL Database
      (RLS Protected Attendance Logs)
                │
                ▼
      Punch Success & Live Status
```

### Future Machine Compatibility
Attendance events are unified under the `attendance.method` column:
- `mobile_biometric` *(Implemented in this demo)*
- `biometric_machine` *(Physical scanners plug directly into `/api/attendance/punch` with an API token)*
- `qr`
- `admin`
- `api`

A future hardware table `biometric_devices` is already included in `supabase/schema.sql`.

---

## 🚀 Quick Setup Guide

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Go to **SQL Editor** in the Supabase dashboard.
3. Open `supabase/schema.sql` from this repository, paste its contents into the SQL Editor, and click **Run**.
   - This creates `profiles`, `attendance`, `webauthn_credentials`, and `biometric_devices` tables.
   - It sets up constraints, indexes, triggers, and Row Level Security (RLS) policies.

### 2. Configure Supabase Auth & Users
1. In your Supabase Dashboard, go to **Authentication -> Users**.
2. Create demo users:
   - **Member**: `member@gympunch.local` (Password: `member123456`)
   - **Admin**: `admin@gympunch.local` (Password: `admin123456`)
3. Copy the generated User UUIDs and configure their profiles:
   - Run the provided `supabase/seed.sql` script with the User IDs, or simply log in once — the app automatically links and provisions member profiles upon login!
   - To make an admin, run this query in SQL Editor:
     ```sql
     UPDATE public.profiles
     SET role = 'admin'
     WHERE auth_user_id = '<your-admin-user-uuid>';
     ```

### 3. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WebAuthn Relying Party Settings
RP_ID=localhost
RP_NAME=Gym Punch Demo
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Security Notice**: `SUPABASE_SERVICE_ROLE_KEY` is kept exclusively on the server and is never bundled into browser code.

### 4. Install Dependencies
```bash
npm install
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your desktop or mobile browser.

---

## 🔒 HTTPS & Mobile Testing Requirements

WebAuthn requires a **Secure Context**:
- **Localhost**: Supported on desktop via `http://localhost:3000` (Windows Hello, Touch ID, or security key will trigger).
- **Physical Mobile Phone Testing**: WebAuthn requires HTTPS when accessed from a smartphone over the local network or internet.
  - Recommended options for mobile testing:
    1. **Cloudflare Tunnel / ngrok**:
       ```bash
       ngrok http 3000
       ```
       Update `.env.local`:
       ```env
       RP_ID=abc123xyz.ngrok-free.app
       NEXT_PUBLIC_APP_URL=https://abc123xyz.ngrok-free.app
       ```
    2. **Production Deployment**: Deploy to Vercel or any hosting platform with an SSL certificate.

---

## 🧪 Verification & Test Cases

The application includes validation for all 7 key scenarios:

| # | Test Scenario | Steps | Expected Result |
|---|---------------|-------|-----------------|
| **1** | **Register Biometric** | Log in as member -> navigate to Biometric Setup -> Click `[ REGISTER THIS PHONE ]` -> Authenticate with Fingerprint / PIN | `Biometric registered successfully ✅` |
| **2** | **Punch IN** | Click `[ 🔐 PUNCH IN ]` -> Provide Fingerprint / Face ID | Native biometric prompt appears -> Server verifies signature -> `PUNCH IN SUCCESSFUL ✅` -> State changes to Punched In |
| **3** | **Duplicate Punch IN** | Attempt to trigger another Punch IN while already punched in | Rejected by server: `You have already punched in.` |
| **4** | **Punch OUT** | Click `[ 🔐 PUNCH OUT ]` -> Provide Fingerprint / Face ID | Native biometric prompt appears -> Server verifies -> `PUNCH OUT SUCCESSFUL ✅` -> Attendance marked complete |
| **5** | **Invalid Punch OUT** | Attempt to punch out without an active punch-in | Rejected by server: `Cannot punch out before punching in.` |
| **6** | **Cancelled Biometric** | Click Punch -> Cancel device fingerprint dialog | Gracefully caught: `Biometric authentication cancelled.` |
| **7** | **RLS Access Protection** | Log in as Member A and attempt to query Member B's records | Supabase RLS enforces row isolation: only own records are returned. |

---

## 📁 Project Structure

```text
gym-punch-demo/
├── .env.local.example
├── package.json
├── README.md
├── supabase/
│   ├── schema.sql              # Production database schema, tables & RLS
│   └── seed.sql                # Demo profiles & biometric device seed
├── src/
│   ├── app/
│   │   ├── login/page.tsx      # Member & Admin login
│   │   ├── member/
│   │   │   ├── page.tsx        # Member dashboard with status & punch button
│   │   │   ├── punch/page.tsx  # Direct punch view
│   │   │   ├── attendance/page.tsx # Attendance history logs
│   │   │   └── register-biometric/page.tsx # Passkey registration & test
│   │   ├── admin/
│   │   │   ├── page.tsx        # Admin KPI dashboard & live punches
│   │   │   ├── members/page.tsx # Member list with biometric status
│   │   │   └── attendance/page.tsx # Filterable attendance logs
│   │   └── api/
│   │       ├── webauthn/
│   │       │   ├── register/options/route.ts
│   │       │   ├── register/verify/route.ts
│   │       │   ├── authentication/options/route.ts
│   │       │   └── authentication/verify/route.ts
│   │       └── attendance/punch/route.ts # Strict state validation & punch
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── PunchButton.tsx     # Mobile-optimized biometric punch button
│   │   ├── BiometricRegister.tsx # Device registration & testing
│   │   └── AttendanceList.tsx  # Today and history attendance renderer
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client (Async cookies)
│   │   │   └── admin.ts        # Privileged server-only client
│   │   └── webauthn/
│   │       ├── config.ts       # RP ID & Origin configuration
│   │       └── helpers.ts      # Challenges & crypto encoding
│   ├── types/
│   │   └── attendance.ts       # TypeScript interfaces
│   └── middleware.ts           # Supabase session refresh & route protection
```
