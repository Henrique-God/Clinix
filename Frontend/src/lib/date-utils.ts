import { format, isAfter, isBefore, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDateTime(value: string | Date, pattern = "d 'de' MMMM 'as' HH:mm") {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}

export function formatDateLabel(value: string | Date, pattern = "d 'de' MMMM 'de' yyyy") {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}

export function formatTimeLabel(value: string | Date, pattern = "HH:mm") {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}

export function formatWeekdayLabel(value: string | Date, pattern = "EEEE") {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: ptBR });
}

export function toUtcIsoFromLocalDateTime(date: Date) {
  return date.toISOString();
}

export function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

export function getAppointmentTimeRange(startTime: string, endTime: string) {
  return `${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}`;
}

export function isUpcoming(startTime: string) {
  return isAfter(parseISO(startTime), new Date());
}

export function isPastDate(value: Date) {
  const currentDay = new Date();
  currentDay.setHours(0, 0, 0, 0);
  return isBefore(value, currentDay) && !isToday(value);
}
