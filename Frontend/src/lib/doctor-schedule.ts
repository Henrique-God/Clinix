import { addDays, compareAsc, format, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AgendaEvent,
  Availability,
  resolveAgendaEventType,
  resolveAppointmentStatus,
  resolveScheduleVisibility,
} from "./api/domain";

export type WeeklyCalendarItemVariant =
  | "availability-public"
  | "availability-private"
  | "appointment-pending"
  | "appointment-active"
  | "appointment-completed"
  | "blocked";

export interface WeeklyCalendarItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  variant: WeeklyCalendarItemVariant;
  source: "availability" | "calendar-event";
  referenceId: string;
  appointmentId?: string;
  appointmentStatus?: string | null;
  subtitle?: string;
}

export interface WeeklyCalendarMetrics {
  top: number;
  height: number;
}

export function buildIsoRangeForDate(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

export function getDoctorWeekStart(referenceDate: Date) {
  const normalizedDate = startOfDay(referenceDate);

  if (normalizedDate.getDay() === 0) {
    return addDays(normalizedDate, 1);
  }

  return startOfWeek(normalizedDate, { weekStartsOn: 1 });
}

export function buildDoctorWeekDays(weekStart: Date, totalDays = 7) {
  return Array.from({ length: totalDays }, (_, index) => addDays(weekStart, index));
}

export function formatDaySelectionLabel(date: Date) {
  return format(date, "EEE, d 'de' MMM", { locale: ptBR });
}

export function buildAvailabilityPayloads(
  selectedDates: Date[],
  startTime: string,
  endTime: string,
  visibility: "Public" | "Private",
) {
  const uniqueDates = new Map<string, Date>();

  selectedDates.forEach((date) => {
    uniqueDates.set(format(startOfDay(date), "yyyy-MM-dd"), startOfDay(date));
  });

  return Array.from(uniqueDates.values())
    .sort(compareAsc)
    .map((date) => ({
      startTime: buildIsoRangeForDate(date, startTime),
      endTime: buildIsoRangeForDate(date, endTime),
      visibility,
    }));
}

export function buildWeeklyCalendarItems(
  availabilities: Availability[],
  agendaEvents: AgendaEvent[],
): WeeklyCalendarItem[] {
  const availabilityItems = availabilities.map<WeeklyCalendarItem>((availability) => {
    const visibility = resolveScheduleVisibility(availability.visibility);

    return {
      id: `availability-${availability.id}`,
      title: visibility === "Private" ? "Disponibilidade privada" : "Disponivel para agendamento",
      startTime: availability.startTime,
      endTime: availability.endTime,
      variant: visibility === "Private" ? "availability-private" : "availability-public",
      source: "availability",
      referenceId: availability.id,
      subtitle: visibility === "Private" ? "Privada" : "Publica",
    };
  });

  const calendarItems = agendaEvents.map<WeeklyCalendarItem>((event) => {
    const eventType = resolveAgendaEventType(event.type);
    const appointmentStatus = resolveAppointmentStatus(event.appointmentStatus);

    if (eventType === "Appointment") {
      return {
        id: `event-${event.id}`,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        variant:
          appointmentStatus === "PendingAcceptance"
            ? "appointment-pending"
            : appointmentStatus === "Completed"
            ? "appointment-completed"
            : "appointment-active",
        source: "calendar-event",
        referenceId: event.id,
        appointmentId: event.appointmentId ?? undefined,
        appointmentStatus,
        subtitle:
          appointmentStatus === "PendingAcceptance"
            ? "Convite aguardando resposta"
            : appointmentStatus === "Completed"
              ? "Consulta concluida"
              : "Consulta agendada",
      };
    }

    return {
      id: `event-${event.id}`,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      variant: "blocked",
      source: "calendar-event",
      referenceId: event.id,
      subtitle: "Bloqueio da agenda",
    };
  });

  return [...availabilityItems, ...calendarItems].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
}

export function buildWeeklyCalendarMetrics(
  startTime: string,
  endTime: string,
  startHour = 7,
  hourHeight = 64,
): WeeklyCalendarMetrics {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  const rawTop = ((startMinutes - startHour * 60) / 60) * hourHeight;
  const rawHeight = ((endMinutes - startMinutes) / 60) * hourHeight;

  return {
    top: Math.max(rawTop, 0),
    height: Math.max(rawHeight, 28),
  };
}

export function buildHourSlots(startHour = 7, endHour = 21) {
  return Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
}
