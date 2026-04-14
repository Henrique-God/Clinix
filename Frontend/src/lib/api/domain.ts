import {
  AppUserType,
  CurrentUserProfile,
  ResolvedCurrentUserProfile,
  normalizeUserType,
  resolveCurrentUserProfile,
} from "./contracts";

export type AppointmentStatus =
  | "PendingAcceptance"
  | "Accepted"
  | "Rejected"
  | "CancelledByPatient"
  | "CancelledByDoctor"
  | "Completed";

export type AppointmentParticipantRole = "Patient" | "Doctor";
export type ScheduleVisibility = "Public" | "Private";
export type AgendaEventType =
  | "Appointment"
  | "ExternalEvent"
  | "BlockedSlot"
  | "PersonalEvent";
export type ClinicalRecordEntryType = "Anamnesis" | "Document";
export type ClinicalRecordEntryAuthorType = "Patient" | "Doctor";
export type ClinicalRecordAccessGrantStatus = "Active" | "Revoked" | "Expired";
export type ChatIntent =
  | "check_appointments"
  | "schedule_appointment"
  | "modify_appointment"
  | "delete_appointment"
  | "clinical_evolution"
  | "rag_question"
  | "general";

export interface AppointmentStatusHistory {
  fromStatus?: AppointmentStatus | number | null;
  toStatus: AppointmentStatus | number;
  changedByUserId: string;
  changedAt: string;
  reason?: string | null;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  invitationExpiresAt: string;
  isInvitationExpired: boolean;
  status: AppointmentStatus | number;
  invitedByUserId: string;
  invitedByRole: AppointmentParticipantRole | number;
  invitationMessage?: string | null;
  responseNote?: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  history: AppointmentStatusHistory[];
}

export interface Availability {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  visibility: ScheduleVisibility | number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  doctorId: string;
  availabilityId: string;
  startTime: string;
  endTime: string;
}

export interface AgendaEvent {
  id: string;
  doctorId: string;
  type: AgendaEventType | number;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  blocksScheduling: boolean;
  appointmentId?: string | null;
  appointmentStatus?: AppointmentStatus | number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalDocument {
  id: string;
  fileName: string;
  contentType: string;
  sizeInBytes: number;
  createdAt: string;
}

export interface ClinicalRecordSummary {
  clinicalRecordId: string;
  patientId: string;
  activeEntriesCount: number;
  activeDocumentsCount: number;
  activeAccessGrantsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalRecordEntry {
  id: string;
  patientId: string;
  authorUserId: string;
  authorType: ClinicalRecordEntryAuthorType | number;
  entryType: ClinicalRecordEntryType | number;
  title: string;
  description: string;
  appointmentId?: string | null;
  appointmentOccurredAt?: string | null;
  isVisibleToPatient: boolean;
  createdAt: string;
  updatedAt: string;
  documents: ClinicalDocument[];
}

export interface ClinicalRecordAccessGrant {
  id: string;
  doctorId: string;
  reason: string;
  status: ClinicalRecordAccessGrantStatus | number;
  startAt: string;
  endAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface ChatMessageResponse {
  reply: string;
  intent: ChatIntent;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DocumentIngestResponse {
  ingestion_id: string;
  status: string;
  message: string;
}

export interface IngestionStatusResponse {
  ingestion_id: string;
  status: string;
  detail?: string | null;
  result?: Record<string, unknown> | null;
}

export interface ClinicalRecordEntryCreateRequest {
  entryType: ClinicalRecordEntryType;
  title: string;
  description: string;
  appointmentId?: string;
  appointmentOccurredAt?: string;
  isVisibleToPatient?: boolean;
}

export interface ClinicalRecordEntryUpdateRequest {
  title: string;
  description: string;
  isVisibleToPatient?: boolean;
}

export interface ClinicalRecordAccessGrantCreateRequest {
  doctorId: string;
  reason: string;
  startAt?: string;
  endAt?: string;
}

const appointmentStatusByNumber: Record<number, AppointmentStatus> = {
  1: "PendingAcceptance",
  2: "Accepted",
  3: "Rejected",
  4: "CancelledByPatient",
  5: "CancelledByDoctor",
  6: "Completed",
};

const appointmentParticipantRoleByNumber: Record<number, AppointmentParticipantRole> = {
  1: "Patient",
  2: "Doctor",
};

const scheduleVisibilityByNumber: Record<number, ScheduleVisibility> = {
  1: "Public",
  2: "Private",
};

const agendaEventTypeByNumber: Record<number, AgendaEventType> = {
  1: "Appointment",
  2: "ExternalEvent",
  3: "BlockedSlot",
  4: "PersonalEvent",
};

const clinicalEntryTypeByNumber: Record<number, ClinicalRecordEntryType> = {
  1: "Anamnesis",
  2: "Document",
};

const clinicalEntryAuthorTypeByNumber: Record<number, ClinicalRecordEntryAuthorType> = {
  1: "Patient",
  2: "Doctor",
};

const clinicalAccessGrantStatusByNumber: Record<number, ClinicalRecordAccessGrantStatus> = {
  1: "Active",
  2: "Revoked",
  3: "Expired",
};

function normalizeEnumValue<T extends string>(
  value: T | number | null | undefined,
  byNumber: Record<number, T>,
): T | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return byNumber[value] ?? null;
  }

  return null;
}

export function resolveAppointmentStatus(
  value: AppointmentStatus | number | null | undefined,
) {
  return normalizeEnumValue(value, appointmentStatusByNumber);
}

export function resolveAppointmentParticipantRole(
  value: AppointmentParticipantRole | number | null | undefined,
) {
  return normalizeEnumValue(value, appointmentParticipantRoleByNumber);
}

export function resolveScheduleVisibility(
  value: ScheduleVisibility | number | null | undefined,
) {
  return normalizeEnumValue(value, scheduleVisibilityByNumber);
}

export function resolveAgendaEventType(
  value: AgendaEventType | number | null | undefined,
) {
  return normalizeEnumValue(value, agendaEventTypeByNumber);
}

export function resolveClinicalEntryType(
  value: ClinicalRecordEntryType | number | null | undefined,
) {
  return normalizeEnumValue(value, clinicalEntryTypeByNumber);
}

export function resolveClinicalEntryAuthorType(
  value: ClinicalRecordEntryAuthorType | number | null | undefined,
) {
  return normalizeEnumValue(value, clinicalEntryAuthorTypeByNumber);
}

export function resolveClinicalAccessGrantStatus(
  value: ClinicalRecordAccessGrantStatus | number | null | undefined,
) {
  return normalizeEnumValue(value, clinicalAccessGrantStatusByNumber);
}

export function getUserLabel(profile: ResolvedCurrentUserProfile | null) {
  return profile?.name ?? profile?.email ?? "Usuario";
}

export function getUserType(profile: CurrentUserProfile | ResolvedCurrentUserProfile | null) {
  return normalizeUserType(profile?.userType);
}

export function isDoctorProfile(profile: CurrentUserProfile | ResolvedCurrentUserProfile | null) {
  return getUserType(profile) === "Doctor";
}

export function isPatientProfile(profile: CurrentUserProfile | ResolvedCurrentUserProfile | null) {
  return getUserType(profile) === "User";
}

export function resolveProfile(profile: CurrentUserProfile | null | undefined) {
  return profile ? resolveCurrentUserProfile(profile) : null;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getUserRoleLabel(userType: AppUserType | null) {
  if (userType === "Doctor") {
    return "Medico";
  }

  if (userType === "User") {
    return "Paciente";
  }

  if (userType === "Admin") {
    return "Administrador";
  }

  return "Usuario";
}

export function getAppointmentStatusLabel(status: AppointmentStatus | null) {
  switch (status) {
    case "PendingAcceptance":
      return "Aguardando resposta";
    case "Accepted":
      return "Confirmada";
    case "Rejected":
      return "Recusada";
    case "CancelledByPatient":
      return "Cancelada pelo paciente";
    case "CancelledByDoctor":
      return "Cancelada pelo médico";
    case "Completed":
      return "Concluída";
    default:
      return "Desconhecida";
  }
}

export function getClinicalEntryTypeLabel(type: ClinicalRecordEntryType | null) {
  switch (type) {
    case "Anamnesis":
      return "Evolucao clinica";
    case "Document":
      return "Documento";
    default:
      return "Registro";
  }
}

export type SubscriptionPlan = "Free" | "Premium";
export type SubscriptionStatus = "Trialing" | "Active" | "PastDue" | "Canceled" | "Expired";

export interface SubscriptionResponse {
  id: string;
  plan: SubscriptionPlan | number;
  status: SubscriptionStatus | number;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  trialDaysRemaining?: number | null;
  createdAt: string;
}

export interface CheckoutSessionResponse {
  sessionUrl: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  description?: string | null;
  dayOfWeek?: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  durationMinutes?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
  order: number;
}

export interface CreateWorkoutRoutineRequest {
  name: string;
  description?: string;
  dayOfWeek?: number;
}

export interface UpdateWorkoutRoutineRequest {
  name: string;
  description?: string;
  dayOfWeek?: number;
  isActive: boolean;
}

export interface CreateWorkoutExerciseRequest {
  name: string;
  sets: number;
  reps: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
}

export interface StravaConnectionResponse {
  id: string;
  stravaAthleteId: number;
  isActive: boolean;
  connectedAt: string;
}

export interface StravaConnectionStatus {
  connected: boolean;
  connection?: StravaConnectionResponse;
}

export interface StravaAuthUrlResponse {
  authorizationUrl: string;
}

export interface StravaActivityResponse {
  id: string;
  stravaActivityId: number;
  name: string;
  type: string;
  startDate: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  totalElevationGain: number;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  calories?: number | null;
  syncedAt: string;
}

export interface StravaSyncResponse {
  activitiesSynced: number;
}

const subscriptionStatusByNumber: Record<number, SubscriptionStatus> = {
  0: "Trialing",
  1: "Active",
  2: "PastDue",
  3: "Canceled",
  4: "Expired",
};

export function resolveSubscriptionStatus(
  value: SubscriptionStatus | number | null | undefined,
) {
  return normalizeEnumValue(value, subscriptionStatusByNumber);
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus | null) {
  switch (status) {
    case "Trialing":
      return "Periodo de teste";
    case "Active":
      return "Ativo";
    case "PastDue":
      return "Pagamento pendente";
    case "Canceled":
      return "Cancelado";
    case "Expired":
      return "Expirado";
    default:
      return "Sem assinatura";
  }
}

const dayOfWeekLabelsByNumber: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terca-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sabado",
};

const dayOfWeekLabelsByName: Record<string, string> = {
  Sunday: "Domingo",
  Monday: "Segunda-feira",
  Tuesday: "Terca-feira",
  Wednesday: "Quarta-feira",
  Thursday: "Quinta-feira",
  Friday: "Sexta-feira",
  Saturday: "Sabado",
};

const dayOfWeekNameToNumber: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function normalizeDayOfWeek(day: number | string | null | undefined): number | null {
  if (day == null) return null;
  if (typeof day === "number") return day;
  return dayOfWeekNameToNumber[day] ?? null;
}

export function getDayOfWeekLabel(day: number | string | null | undefined) {
  if (day == null) return "Qualquer dia";
  if (typeof day === "number") return dayOfWeekLabelsByNumber[day] ?? "Desconhecido";
  return dayOfWeekLabelsByName[day] ?? "Desconhecido";
}

export function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export function getClinicalAccessGrantStatusLabel(
  status: ClinicalRecordAccessGrantStatus | null,
) {
  switch (status) {
    case "Active":
      return "Ativo";
    case "Revoked":
      return "Revogado";
    case "Expired":
      return "Expirado";
    default:
      return "Desconhecido";
  }
}
