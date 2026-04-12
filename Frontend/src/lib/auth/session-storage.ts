import { AuthSession } from "../api/contracts";

const storageKey = "clinix.auth.session";

export function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const session = JSON.parse(rawValue) as AuthSession;

    if (!session.token || !session.expiresAt || !session.userType) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function persistSession(session: AuthSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(storageKey);
}
