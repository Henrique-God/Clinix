using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Application.Contracts;

public static class ContractMappings
{
    public static AppointmentResponseDto ToResponse(this Appointment appointment, DateTime utcNow) =>
        new()
        {
            Id = appointment.Id,
            DoctorId = appointment.DoctorId,
            PatientId = appointment.PatientId,
            Title = appointment.Title,
            Description = appointment.Description,
            Location = appointment.Location,
            StartTime = appointment.StartTime,
            EndTime = appointment.EndTime,
            InvitationExpiresAt = appointment.InvitationExpiresAt,
            IsInvitationExpired = appointment.IsInvitationExpired(utcNow),
            Status = appointment.Status,
            InvitedByUserId = appointment.InvitationMetadata.InvitedByUserId,
            InvitedByRole = appointment.InvitationMetadata.InvitedByRole,
            InvitationMessage = appointment.InvitationMetadata?.InvitationMessage,
            ResponseNote = appointment.InvitationMetadata?.ResponseNote,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt,
            AcceptedAt = appointment.AcceptedAt,
            RejectedAt = appointment.RejectedAt,
            CancelledAt = appointment.CancelledAt,
            CompletedAt = appointment.CompletedAt,
            History = appointment.StatusHistory
                .OrderBy(item => item.ChangedAt)
                .Select(item => new AppointmentStatusHistoryResponseDto
                {
                    FromStatus = item.FromStatus,
                    ToStatus = item.ToStatus,
                    ChangedByUserId = item.ChangedByUserId,
                    ChangedAt = item.ChangedAt,
                    Reason = item.Reason
                })
                .ToList()
        };

    public static AvailabilityResponseDto ToResponse(this DoctorAvailability availability) =>
        new()
        {
            Id = availability.Id,
            DoctorId = availability.DoctorId,
            StartTime = availability.StartTime,
            EndTime = availability.EndTime,
            Visibility = availability.Visibility,
            AcceptsPrivate = availability.AcceptsPrivate,
            AcceptsInsurance = availability.AcceptsInsurance,
            InsurancePlans = DeserializeJsonList(availability.InsurancePlans),
            CreatedAt = availability.CreatedAt,
            UpdatedAt = availability.UpdatedAt
        };

    public static AgendaEventResponseDto ToResponse(this AgendaEvent agendaEvent) =>
        new()
        {
            Id = agendaEvent.Id,
            DoctorId = agendaEvent.DoctorId,
            Type = agendaEvent.Type,
            Title = agendaEvent.Title,
            Description = agendaEvent.Description,
            StartTime = agendaEvent.StartTime,
            EndTime = agendaEvent.EndTime,
            BlocksScheduling = agendaEvent.BlocksScheduling,
            AppointmentId = agendaEvent.AppointmentId,
            AppointmentStatus = agendaEvent.Appointment?.Status,
            CreatedAt = agendaEvent.CreatedAt,
            UpdatedAt = agendaEvent.UpdatedAt
        };

    public static AvailableSlotResponseDto ToResponse(this DoctorAvailability availability, DateTime startTime, DateTime endTime, int? consultationPriceCents = null) =>
        new()
        {
            DoctorId = availability.DoctorId,
            AvailabilityId = availability.Id,
            StartTime = startTime,
            EndTime = endTime,
            AcceptsPrivate = availability.AcceptsPrivate,
            AcceptsInsurance = availability.AcceptsInsurance,
            InsurancePlans = DeserializeJsonList(availability.InsurancePlans),
            ConsultationPriceCents = consultationPriceCents
        };

    private static IReadOnlyCollection<string> DeserializeJsonList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Array.Empty<string>();

        return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
    }
}
