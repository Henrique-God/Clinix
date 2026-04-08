import { apiConfig } from "./config";
import {
  CurrentUserProfile,
  DirectoryUser,
  DoctorDirectoryItem,
  DoctorDirectoryQuery,
  LoginRequest,
  LoginResponse,
  RegisterDoctorRequest,
  RegisterPatientRequest,
} from "./contracts";
import {
  AgendaEvent,
  Appointment,
  AvailableSlot,
  Availability,
  ChatMessageResponse,
  ClinicalRecordAccessGrant,
  ClinicalRecordAccessGrantCreateRequest,
  ClinicalRecordEntry,
  ClinicalRecordEntryCreateRequest,
  ClinicalRecordEntryUpdateRequest,
  ClinicalRecordSummary,
  ScheduleVisibility,
} from "./domain";
import { requestBlob, requestJson } from "./http";

function buildQueryString(query: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

interface AppointmentInviteRequest {
  doctorId: string;
  patientId: string;
  startTime: string;
  endTime: string;
  invitationExpiresAt: string;
  title: string;
  description?: string;
  location?: string;
  invitationMessage?: string;
}

interface AppointmentActionRequest {
  note?: string;
}

interface AppointmentCancelRequest {
  reason?: string;
}

interface AvailabilityCreateRequest {
  startTime: string;
  endTime: string;
  visibility: ScheduleVisibility;
}

interface AvailabilityQuery {
  fromUtc?: string;
  toUtc?: string;
  visibility?: ScheduleVisibility;
}

interface AvailableSlotQuery {
  fromUtc: string;
  toUtc: string;
  durationMinutes?: number;
}

interface CalendarQuery {
  view?: string;
  referenceDateUtc?: string;
  fromUtc?: string;
  toUtc?: string;
}

interface CalendarEventCreateRequest {
  type: "ExternalEvent" | "BlockedSlot" | "PersonalEvent";
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
}

interface ChatMessageRequest {
  message: string;
  patient_id?: string;
  conversation_id?: string;
  conversation_context?: string;
}

interface RagQueryRequest {
  query: string;
  patient_id: string;
  top_k?: number;
}

interface RagQueryResponse {
  answer: string;
  sources: Array<Record<string, unknown>>;
  timestamp: string;
}

export const usersApi = {
  login(payload: LoginRequest) {
    return requestJson<LoginResponse>(apiConfig.usersApiUrl, "/auth/login", {
      method: "POST",
      body: payload,
    });
  },

  registerPatient(payload: RegisterPatientRequest) {
    return requestJson<LoginResponse>(
      apiConfig.usersApiUrl,
      "/auth/patients/register",
      {
        method: "POST",
        body: payload,
      },
    );
  },

  registerDoctor(payload: RegisterDoctorRequest) {
    return requestJson<LoginResponse>(
      apiConfig.usersApiUrl,
      "/auth/doctors/register",
      {
        method: "POST",
        body: payload,
      },
    );
  },

  getCurrentUser(token: string) {
    return requestJson<CurrentUserProfile>(apiConfig.usersApiUrl, "/auth/me", {
      method: "GET",
      token,
    });
  },

  getDoctors(token: string, query: DoctorDirectoryQuery = {}) {
    return requestJson<DoctorDirectoryItem[]>(
      apiConfig.usersApiUrl,
      `/directory/doctors${buildQueryString({
        search: query.search,
        specialty: query.specialty,
        limit: query.limit,
      })}`,
      {
        method: "GET",
        token,
      },
    );
  },

  getDirectoryUser(token: string, userId: string) {
    return requestJson<DirectoryUser>(
      apiConfig.usersApiUrl,
      `/directory/users/${userId}`,
      {
        method: "GET",
        token,
      },
    );
  },
};

export const appointmentsApi = {
  listPatientAppointments(token: string, query: Record<string, string | number | undefined> = {}) {
    return requestJson<Appointment[]>(
      apiConfig.appointmentsApiUrl,
      `/appointments/patient${buildQueryString(query)}`,
      {
        method: "GET",
        token,
      },
    );
  },

  listDoctorAppointments(token: string, query: Record<string, string | number | undefined> = {}) {
    return requestJson<Appointment[]>(
      apiConfig.appointmentsApiUrl,
      `/appointments/doctor${buildQueryString(query)}`,
      {
        method: "GET",
        token,
      },
    );
  },

  getAppointment(token: string, appointmentId: string) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      `/appointments/${appointmentId}`,
      {
        method: "GET",
        token,
      },
    );
  },

  inviteAppointment(token: string, payload: AppointmentInviteRequest) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      "/appointments/invite",
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  acceptAppointment(token: string, appointmentId: string, payload: AppointmentActionRequest = {}) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      `/appointments/${appointmentId}/accept`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  rejectAppointment(token: string, appointmentId: string, payload: AppointmentActionRequest = {}) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      `/appointments/${appointmentId}/reject`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  cancelAppointment(token: string, appointmentId: string, payload: AppointmentCancelRequest = {}) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      `/appointments/${appointmentId}/cancel`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  completeAppointment(token: string, appointmentId: string, payload: Record<string, unknown> = {}) {
    return requestJson<Appointment>(
      apiConfig.appointmentsApiUrl,
      `/appointments/${appointmentId}/complete`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  getAvailability(token: string, doctorId: string, query: AvailabilityQuery = {}) {
    return requestJson<Availability[]>(
      apiConfig.appointmentsApiUrl,
      `/doctors/${doctorId}/availability${buildQueryString(query)}`,
      {
        method: "GET",
        token,
      },
    );
  },

  createAvailability(token: string, doctorId: string, payload: AvailabilityCreateRequest) {
    return requestJson<Availability>(
      apiConfig.appointmentsApiUrl,
      `/doctors/${doctorId}/availability`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  updateAvailability(token: string, availabilityId: string, payload: AvailabilityCreateRequest) {
    return requestJson<Availability>(
      apiConfig.appointmentsApiUrl,
      `/availability/${availabilityId}`,
      {
        method: "PUT",
        token,
        body: payload,
      },
    );
  },

  deleteAvailability(token: string, availabilityId: string) {
    return requestJson<void>(
      apiConfig.appointmentsApiUrl,
      `/availability/${availabilityId}`,
      {
        method: "DELETE",
        token,
      },
    );
  },

  getAvailableSlots(token: string, doctorId: string, query: AvailableSlotQuery) {
    return requestJson<AvailableSlot[]>(
      apiConfig.appointmentsApiUrl,
      `/doctors/${doctorId}/available-slots${buildQueryString(query)}`,
      {
        method: "GET",
        token,
      },
    );
  },

  getCalendar(token: string, doctorId: string, query: CalendarQuery = {}) {
    return requestJson<AgendaEvent[]>(
      apiConfig.appointmentsApiUrl,
      `/doctors/${doctorId}/calendar${buildQueryString(query)}`,
      {
        method: "GET",
        token,
      },
    );
  },

  createCalendarEvent(token: string, doctorId: string, payload: CalendarEventCreateRequest) {
    return requestJson<AgendaEvent>(
      apiConfig.appointmentsApiUrl,
      `/doctors/${doctorId}/calendar-events`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  updateCalendarEvent(token: string, eventId: string, payload: CalendarEventCreateRequest) {
    return requestJson<AgendaEvent>(
      apiConfig.appointmentsApiUrl,
      `/calendar-events/${eventId}`,
      {
        method: "PUT",
        token,
        body: payload,
      },
    );
  },

  deleteCalendarEvent(token: string, eventId: string) {
    return requestJson<void>(
      apiConfig.appointmentsApiUrl,
      `/calendar-events/${eventId}`,
      {
        method: "DELETE",
        token,
      },
    );
  },
};

export const chatbotApi = {
  sendMessage(token: string, payload: ChatMessageRequest) {
    return requestJson<ChatMessageResponse>(apiConfig.chatbotApiUrl, "/chatbot/message", {
      method: "POST",
      token,
      body: payload,
    });
  },

  queryClinicalHistory(token: string, payload: RagQueryRequest) {
    return requestJson<RagQueryResponse>(apiConfig.chatbotApiUrl, "/rag/query", {
      method: "POST",
      token,
      body: payload,
    });
  },
};

export const clinicalRecordsApi = {
  getSummary(token: string, patientId: string) {
    return requestJson<ClinicalRecordSummary>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record`,
      {
        method: "GET",
        token,
      },
    );
  },

  getEntries(token: string, patientId: string) {
    return requestJson<ClinicalRecordEntry[]>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/entries`,
      {
        method: "GET",
        token,
      },
    );
  },

  createEntry(token: string, patientId: string, payload: ClinicalRecordEntryCreateRequest) {
    return requestJson<ClinicalRecordEntry>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/entries`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  updateEntry(
    token: string,
    patientId: string,
    entryId: string,
    payload: ClinicalRecordEntryUpdateRequest,
  ) {
    return requestJson<ClinicalRecordEntry>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/entries/${entryId}`,
      {
        method: "PUT",
        token,
        body: payload,
      },
    );
  },

  deleteEntry(token: string, patientId: string, entryId: string) {
    return requestJson<void>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/entries/${entryId}`,
      {
        method: "DELETE",
        token,
      },
    );
  },

  downloadDocument(token: string, patientId: string, documentId: string) {
    return requestBlob(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/documents/${documentId}`,
      {
        method: "GET",
        token,
      },
    );
  },

  getAccessGrants(token: string, patientId: string) {
    return requestJson<ClinicalRecordAccessGrant[]>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/access-grants`,
      {
        method: "GET",
        token,
      },
    );
  },

  createAccessGrant(
    token: string,
    patientId: string,
    payload: ClinicalRecordAccessGrantCreateRequest,
  ) {
    return requestJson<ClinicalRecordAccessGrant>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/access-grants`,
      {
        method: "POST",
        token,
        body: payload,
      },
    );
  },

  revokeAccessGrant(token: string, patientId: string, grantId: string) {
    return requestJson<ClinicalRecordAccessGrant>(
      apiConfig.usersApiUrl,
      `/patients/${patientId}/clinical-record/access-grants/${grantId}/revoke`,
      {
        method: "PATCH",
        token,
      },
    );
  },
};
