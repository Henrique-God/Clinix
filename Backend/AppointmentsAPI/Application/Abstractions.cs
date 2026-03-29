namespace AppointmentsAPI.Application;

public interface ICurrentActorAccessor
{
    CurrentActor GetRequiredActor();
}

public interface IClock
{
    DateTime UtcNow { get; }
}

public interface IUserDirectoryService
{
    Task<UserDirectoryEntry?> GetUserAsync(Guid userId, CancellationToken cancellationToken = default);
}

public interface IClinicalRecordsGateway
{
    Task GrantDoctorAccessAsync(Guid appointmentId, Guid patientId, Guid doctorId, DateTime appointmentEndTimeUtc, CancellationToken cancellationToken = default);

    Task CreateAppointmentCompletionEntryAsync(
        Guid appointmentId,
        Guid patientId,
        Guid doctorId,
        DateTime appointmentOccurredAtUtc,
        string? title,
        string? description,
        CancellationToken cancellationToken = default);
}

public interface IIntegrationEventPublisher
{
    Task PublishAsync(string eventName, object payload, CancellationToken cancellationToken = default);
}

public sealed class UserDirectoryEntry
{
    public Guid UserId { get; set; }

    public string UserType { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? ProfessionalRegister { get; set; }

    public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
}
