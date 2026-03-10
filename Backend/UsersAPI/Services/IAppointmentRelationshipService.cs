namespace UsersAPI.Services;

public interface IAppointmentRelationshipService
{
    Task<bool> HasScheduledOrCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default);
    Task<bool> HasCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default);
    Task<bool> IsAppointmentOwnedByDoctorAndPatientAsync(Guid appointmentId, Guid patientId, Guid doctorId, CancellationToken cancellationToken = default);
}
