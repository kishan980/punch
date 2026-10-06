export type UserRole = "admin" | "member";
export type MemberStatus = "active" | "inactive";
export type PunchType = "in" | "out";
export type PunchMethod =
  | "mobile_biometric"
  | "biometric_machine"
  | "qr"
  | "admin"
  | "api";

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
  role: UserRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  member_id: string;
  punch_type: PunchType;
  punch_time: string;
  method: PunchMethod;
  created_at: string;
  // Joined profile for admin / report views
  profiles?: {
    full_name: string;
    member_code: string;
    phone?: string;
  };
}

export interface WebAuthnCredentialRecord {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface BiometricDevice {
  id: string;
  device_name: string;
  serial_number: string;
  device_type: string;
  status: "active" | "inactive" | "maintenance";
  created_at: string;
}

export interface PunchApiResponse {
  success: boolean;
  message: string;
  punchType?: PunchType;
  punchTime?: string;
  error?: string;
}

export interface TodayPunchStatus {
  hasPunchedIn: boolean;
  hasPunchedOut: boolean;
  punchInTime: string | null;
  punchOutTime: string | null;
  records: AttendanceRecord[];
}
