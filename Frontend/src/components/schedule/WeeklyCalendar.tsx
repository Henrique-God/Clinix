import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WeeklyCalendarItem, buildHourSlots, buildWeeklyCalendarMetrics } from "@/lib/doctor-schedule";
import { cn } from "@/lib/utils";

interface WeeklyCalendarProps {
  days: Date[];
  items: WeeklyCalendarItem[];
  selectedItemId?: string | null;
  onSelectItem?: (item: WeeklyCalendarItem) => void;
  emptyLabel?: string;
  startHour?: number;
  endHour?: number;
}

function getItemClassName(variant: WeeklyCalendarItem["variant"], selected: boolean) {
  const baseClassName =
    "absolute inset-x-1 rounded-xl border px-2 py-1 text-left text-xs shadow-sm transition-all";

  const variantClassName =
    variant === "availability-public"
      ? "border-emerald-200 bg-emerald-100/80 text-emerald-900"
      : variant === "availability-private"
        ? "border-slate-300 bg-slate-200/80 text-slate-700"
        : variant === "appointment-pending"
          ? "border-amber-300 bg-amber-100 text-amber-900"
        : variant === "appointment-completed"
          ? "border-sky-200 bg-sky-100 text-sky-900"
          : variant === "appointment-active"
            ? "border-primary/30 bg-primary/15 text-primary"
            : "border-amber-200 bg-amber-100 text-amber-900";

  return cn(
    baseClassName,
    variantClassName,
    selected && "ring-2 ring-primary/40 border-primary/40",
  );
}

export function WeeklyCalendar({
  days,
  items,
  selectedItemId,
  onSelectItem,
  emptyLabel = "Nenhum bloco nesta semana.",
  startHour = 7,
  endHour = 21,
}: WeeklyCalendarProps) {
  const hourHeight = 64;
  const hours = buildHourSlots(startHour, endHour);
  const calendarHeight = hours.length * hourHeight;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border border-border rounded-2xl overflow-hidden">
          <div className="border-r border-border bg-card" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="border-l border-border bg-card/70 px-3 py-4 text-center"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <p className="text-lg font-semibold">{format(day, "d")}</p>
            </div>
          ))}

          <div className="border-r border-border bg-card">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-t border-border px-2 pt-1 text-right text-xs text-muted-foreground"
              >
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayItems = items.filter((item) => isSameDay(parseISO(item.startTime), day));

            return (
              <div
                key={`column-${day.toISOString()}`}
                className="relative border-l border-border bg-background/80"
                style={{ height: calendarHeight }}
              >
                {hours.map((hour, index) => (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "absolute inset-x-0 border-t border-border/70",
                      index === hours.length - 1 && "border-b",
                    )}
                    style={{ top: index * hourHeight }}
                  />
                ))}

                {dayItems.map((item) => {
                  const metrics = buildWeeklyCalendarMetrics(
                    item.startTime,
                    item.endTime,
                    startHour,
                    hourHeight,
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem?.(item)}
                      className={getItemClassName(item.variant, selectedItemId === item.id)}
                      style={{ top: metrics.top, height: metrics.height }}
                    >
                      <p className="truncate font-semibold">{item.title}</p>
                      <p className="truncate text-[11px] opacity-80">
                        {format(parseISO(item.startTime), "HH:mm")} - {format(parseISO(item.endTime), "HH:mm")}
                      </p>
                      {item.subtitle ? (
                        <p className="truncate text-[11px] opacity-80">{item.subtitle}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
