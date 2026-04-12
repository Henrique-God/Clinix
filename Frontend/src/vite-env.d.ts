/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USERS_API_URL?: string;
  readonly VITE_APPOINTMENTS_API_URL?: string;
  readonly VITE_CHATBOT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
