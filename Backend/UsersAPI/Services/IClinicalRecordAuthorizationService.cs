namespace UsersAPI.Services;

public interface IClinicalRecordAuthorizationService
{
    Task<ClinicalRecordAuthorizationResult> AuthorizeReadAsync(ClinicalRecordActor actor, Guid patientId, CancellationToken cancellationToken = default);
    Task<ClinicalRecordAuthorizationResult> AuthorizeWriteAsync(ClinicalRecordActor actor, Guid patientId, Guid? appointmentId = null, CancellationToken cancellationToken = default);
    Task<ClinicalRecordAuthorizationResult> AuthorizeGrantManagementAsync(ClinicalRecordActor actor, Guid patientId, CancellationToken cancellationToken = default);
}
