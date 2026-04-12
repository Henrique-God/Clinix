import { describe, expect, it } from "vitest";
import {
  buildAvailabilityPayloads,
  buildWeeklyCalendarItems,
  getDoctorWeekStart,
} from "@/lib/doctor-schedule";

describe("doctor schedule helpers", () => {
  it("uses the next monday when the reference date is sunday", () => {
    const result = getDoctorWeekStart(new Date("2026-04-12T10:00:00.000Z"));

    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(13);
    expect(result.getMonth()).toBe(3);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("builds one availability payload per unique selected date", () => {
    const payloads = buildAvailabilityPayloads(
      [
        new Date("2026-04-14T12:00:00.000Z"),
        new Date("2026-04-16T09:00:00.000Z"),
        new Date("2026-04-14T18:30:00.000Z"),
      ],
      "09:00",
      "11:00",
      "Public",
    );

    expect(payloads).toHaveLength(2);
    expect(payloads[0].visibility).toBe("Public");
    expect(new Date(payloads[0].startTime).getDate()).toBe(14);
    expect(new Date(payloads[0].startTime).getHours()).toBe(9);
    expect(new Date(payloads[0].endTime).getHours()).toBe(11);

    expect(payloads[1].visibility).toBe("Public");
    expect(new Date(payloads[1].startTime).getDate()).toBe(16);
    expect(new Date(payloads[1].startTime).getHours()).toBe(9);
    expect(new Date(payloads[1].endTime).getHours()).toBe(11);
  });

  it("merges availability and calendar events into weekly calendar blocks", () => {
    const items = buildWeeklyCalendarItems(
      [
        {
          id: "availability-1",
          doctorId: "doctor-1",
          startTime: "2026-04-14T09:00:00.000Z",
          endTime: "2026-04-14T12:00:00.000Z",
          visibility: "Public",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      [
        {
          id: "event-1",
          doctorId: "doctor-1",
          type: "Appointment",
          title: "Consulta de retorno",
          startTime: "2026-04-14T10:00:00.000Z",
          endTime: "2026-04-14T10:30:00.000Z",
          blocksScheduling: true,
          appointmentId: "appointment-1",
          appointmentStatus: "Accepted",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
        {
          id: "event-2",
          doctorId: "doctor-1",
          type: "BlockedSlot",
          title: "Reuniao interna",
          startTime: "2026-04-14T15:00:00.000Z",
          endTime: "2026-04-14T16:00:00.000Z",
          blocksScheduling: true,
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
    );

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      source: "availability",
      variant: "availability-public",
    });
    expect(items[1]).toMatchObject({
      source: "calendar-event",
      variant: "appointment-active",
    });
    expect(items[2]).toMatchObject({
      source: "calendar-event",
      variant: "blocked",
    });
  });
});
