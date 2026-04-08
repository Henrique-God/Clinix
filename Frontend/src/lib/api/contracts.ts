export type AppUserType = "Admin" | "User" | "Doctor";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  userType: AppUserType | number;
}

export interface CurrentUserProfile {
  userId: string;
  email: string;
  name?: string;
  userType?: AppUserType | number | null;
  isActive?: boolean | null;
  professionalRegister?: string | null;
  specialties?: string[];
}

export interface RegisterPatientRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterDoctorRequest {
  name: string;
  professionalRegister: string;
  specialties: string[];
  email: string;
  phone: string;
  password: string;
}

export interface DirectoryUser {
  userId: string;
  name: string;
  userType: AppUserType | number;
  isActive: boolean;
  professionalRegister?: string | null;
  specialties: string[];
}

export interface DoctorDirectoryItem {
  userId: string;
  name: string;
  professionalRegister: string;
  phone: string;
  specialties: string[];
}

export interface DoctorDirectoryQuery {
  search?: string;
  specialty?: string;
  limit?: number;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  userType: AppUserType;
  profile: ResolvedCurrentUserProfile | null;
}

export interface ResolvedCurrentUserProfile {
  userId: string;
  email: string;
  name: string;
  userType: AppUserType;
  isActive: boolean;
  professionalRegister?: string | null;
  specialties: string[];
}

const userTypeByNumber: Record<number, AppUserType> = {
  0: "Admin",
  1: "User",
  2: "Doctor",
};

export function normalizeUserType(value: unknown): AppUserType | null {
  if (typeof value === "string") {
    if (value === "Admin" || value === "User" || value === "Doctor") {
      return value;
    }

    return null;
  }

  if (typeof value === "number") {
    return userTypeByNumber[value] ?? null;
  }

  return null;
}

export function resolveCurrentUserProfile(
  input: CurrentUserProfile,
): ResolvedCurrentUserProfile | null {
  const userType = normalizeUserType(input.userType);

  if (!input.userId || !input.email || !userType) {
    return null;
  }

  return {
    userId: input.userId,
    email: input.email,
    name: input.name ?? input.email,
    userType,
    isActive: input.isActive ?? true,
    professionalRegister: input.professionalRegister ?? null,
    specialties: input.specialties ?? [],
  };
}
