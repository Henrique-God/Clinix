using UsersAPI.Services;

namespace UsersAPI.Tests.Infrastructure;

public class FakeAppointmentRelationshipService : IAppointmentRelationshipService
{
    public Func<Guid, Guid, CancellationToken, Task<bool>> HasScheduledOrCompletedAppointmentAsyncHandler { get; set; } =
        (_, _, _) => Task.FromResult(false);

    public Func<Guid, Guid, CancellationToken, Task<bool>> HasCompletedAppointmentAsyncHandler { get; set; } =
        (_, _, _) => Task.FromResult(false);

    public Func<Guid, Guid, Guid, CancellationToken, Task<bool>> IsAppointmentOwnedByDoctorAndPatientAsyncHandler { get; set; } =
        (_, _, _, _) => Task.FromResult(false);

    public void Reset()
    {
        HasScheduledOrCompletedAppointmentAsyncHandler = (_, _, _) => Task.FromResult(false);
        HasCompletedAppointmentAsyncHandler = (_, _, _) => Task.FromResult(false);
        IsAppointmentOwnedByDoctorAndPatientAsyncHandler = (_, _, _, _) => Task.FromResult(false);
    }

    public Task<bool> HasScheduledOrCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default) =>
        HasScheduledOrCompletedAppointmentAsyncHandler(patientId, doctorId, cancellationToken);

    public Task<bool> HasCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default) =>
        HasCompletedAppointmentAsyncHandler(patientId, doctorId, cancellationToken);

    public Task<bool> IsAppointmentOwnedByDoctorAndPatientAsync(Guid appointmentId, Guid patientId, Guid doctorId, CancellationToken cancellationToken = default) =>
        IsAppointmentOwnedByDoctorAndPatientAsyncHandler(appointmentId, patientId, doctorId, cancellationToken);
}
