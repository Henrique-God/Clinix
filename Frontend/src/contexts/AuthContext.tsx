import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { usersApi } from "@/lib/api/clinix-api";
import {
  AppUserType,
  AuthSession,
  LoginResponse,
  RegisterDoctorRequest,
  RegisterPatientRequest,
  ResolvedCurrentUserProfile,
  normalizeUserType,
  resolveCurrentUserProfile,
} from "@/lib/api/contracts";
import {
  clearStoredSession,
  persistSession,
  readStoredSession,
} from "@/lib/auth/session-storage";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  profile: ResolvedCurrentUserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  registerPatient: (payload: RegisterPatientRequest) => Promise<AuthSession>;
  registerDoctor: (payload: RegisterDoctorRequest) => Promise<AuthSession>;
  refreshProfile: () => Promise<ResolvedCurrentUserProfile | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSession(
  authResponse: LoginResponse,
  profile: ResolvedCurrentUserProfile | null,
): AuthSession {
  const userType = normalizeUserType(authResponse.userType);

  if (!userType) {
    throw new Error("Tipo de usuario retornado pelo backend e invalido.");
  }

  return {
    token: authResponse.token,
    expiresAt: authResponse.expiresAt,
    userType,
    profile,
  };
}

export function resolveHomePath(userType: AppUserType) {
  if (userType === "Doctor") {
    return "/medico/painel";
  }

  return "/paciente/consultas";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const storedSession = readStoredSession();

    if (!storedSession) {
      setStatus("anonymous");
      return;
    }

    hydrateSession(storedSession).catch(() => {
      clearStoredSession();
      setSession(null);
      setStatus("anonymous");
    });
  }, []);

  async function hydrateSession(currentSession: AuthSession) {
    const profileResponse = await usersApi.getCurrentUser(currentSession.token);
    const resolvedProfile = resolveCurrentUserProfile(profileResponse);
    const nextSession: AuthSession = {
      ...currentSession,
      profile: resolvedProfile ?? currentSession.profile,
    };

    persistSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");

    return nextSession;
  }

  async function finalizeAuthentication(authResponse: LoginResponse) {
    const profileResponse = await usersApi.getCurrentUser(authResponse.token);
    const resolvedProfile = resolveCurrentUserProfile(profileResponse);
    const nextSession = buildSession(authResponse, resolvedProfile);

    persistSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");

    return nextSession;
  }

  async function login(email: string, password: string) {
    const authResponse = await usersApi.login({ email, password });
    return finalizeAuthentication(authResponse);
  }

  async function registerPatient(payload: RegisterPatientRequest) {
    const authResponse = await usersApi.registerPatient(payload);
    return finalizeAuthentication(authResponse);
  }

  async function registerDoctor(payload: RegisterDoctorRequest) {
    const authResponse = await usersApi.registerDoctor(payload);
    return finalizeAuthentication(authResponse);
  }

  async function refreshProfile() {
    if (!session) {
      return null;
    }

    const refreshedSession = await hydrateSession(session);
    return refreshedSession.profile;
  }

  function logout() {
    clearStoredSession();
    setSession(null);
    setStatus("anonymous");
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        profile: session?.profile ?? null,
        isAuthenticated: status === "authenticated",
        login,
        registerPatient,
        registerDoctor,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
