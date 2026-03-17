using AppointmentsAPI.Application;

namespace AppointmentsAPI.Tests.Infrastructure;

public class FakeClinicalRecordsGateway : IClinicalRecordsGateway
{
    public List<(Guid AppointmentId, Guid PatientId, Guid DoctorId)> AccessGrants { get; } = new();

    public List<(Guid AppointmentId, Guid PatientId, Guid DoctorId, string? Title)> CompletionEntries { get; } = new();

    public Task GrantDoctorAccessAsync(
        Guid appointmentId,
        Guid patientId,
        Guid doctorId,
        DateTime appointmentEndTimeUtc,
        CancellationToken cancellationToken = default)
    {
        AccessGrants.Add((appointmentId, patientId, doctorId));
        return Task.CompletedTask;
    }

    public Task CreateAppointmentCompletionEntryAsync(
        Guid appointmentId,
        Guid patientId,
        Guid doctorId,
        DateTime appointmentOccurredAtUtc,
        string? title,
        string? description,
        CancellationToken cancellationToken = default)
    {
        CompletionEntries.Add((appointmentId, patientId, doctorId, title));
        return Task.CompletedTask;
    }

    public void Reset()
    {
        AccessGrants.Clear();
        CompletionEntries.Clear();
    }
}
