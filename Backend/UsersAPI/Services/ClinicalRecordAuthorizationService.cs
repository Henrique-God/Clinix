using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;

namespace UsersAPI.Services;

public class ClinicalRecordAuthorizationService : IClinicalRecordAuthorizationService
{
    private readonly IUsersDbContext context;
    private readonly IAppointmentRelationshipService appointmentRelationshipService;

    public ClinicalRecordAuthorizationService(
        IUsersDbContext context,
        IAppointmentRelationshipService appointmentRelationshipService)
    {
        this.context = context;
        this.appointmentRelationshipService = appointmentRelationshipService;
    }

    public async Task<ClinicalRecordAuthorizationResult> AuthorizeReadAsync(
        ClinicalRecordActor actor,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        if (actor.UserType == UserType.Admin)
            return ClinicalRecordAuthorizationResult.Success();

        if (actor.UserType == UserType.User && actor.UserId == patientId)
            return ClinicalRecordAuthorizationResult.Success();

        if (actor.UserType != UserType.Doctor)
            return ClinicalRecordAuthorizationResult.Fail("Only the patient or an authorized doctor can view this clinical record.");

        if (!await HasActiveGrantAsync(patientId, actor.UserId, cancellationToken))
            return ClinicalRecordAuthorizationResult.Fail("The patient has not granted access to this doctor.");

        bool hasRelationship = await appointmentRelationshipService
            .HasScheduledOrCompletedAppointmentAsync(patientId, actor.UserId, cancellationToken);

        return hasRelationship
            ? ClinicalRecordAuthorizationResult.Success()
            : ClinicalRecordAuthorizationResult.Fail("Doctor must have a scheduled or completed appointment with the patient.");
    }

    public async Task<ClinicalRecordAuthorizationResult> AuthorizeWriteAsync(
        ClinicalRecordActor actor,
        Guid patientId,
        Guid? appointmentId = null,
        CancellationToken cancellationToken = default)
    {
        if (actor.UserType == UserType.Admin)
            return ClinicalRecordAuthorizationResult.Success();

        if (actor.UserType == UserType.User && actor.UserId == patientId)
            return ClinicalRecordAuthorizationResult.Success();

        if (actor.UserType != UserType.Doctor)
            return ClinicalRecordAuthorizationResult.Fail("Only the patient or an authorized doctor can modify this clinical record.");

        if (!await HasActiveGrantAsync(patientId, actor.UserId, cancellationToken))
            return ClinicalRecordAuthorizationResult.Fail("The patient has not granted write access to this doctor.");

        bool hasCompletedAppointment = await appointmentRelationshipService
            .HasCompletedAppointmentAsync(patientId, actor.UserId, cancellationToken);

        if (!hasCompletedAppointment)
            return ClinicalRecordAuthorizationResult.Fail("Doctor must have a completed appointment with the patient.");

        if (appointmentId.HasValue)
        {
            bool appointmentMatches = await appointmentRelationshipService
                .IsAppointmentOwnedByDoctorAndPatientAsync(appointmentId.Value, patientId, actor.UserId, cancellationToken);

            if (!appointmentMatches)
                return ClinicalRecordAuthorizationResult.Fail("The provided appointment does not belong to this doctor/patient relationship.");
        }

        return ClinicalRecordAuthorizationResult.Success();
    }

    public Task<ClinicalRecordAuthorizationResult> AuthorizeGrantManagementAsync(
        ClinicalRecordActor actor,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        if (actor.UserType == UserType.Admin)
            return Task.FromResult(ClinicalRecordAuthorizationResult.Success());

        if (actor.UserType == UserType.User && actor.UserId == patientId)
            return Task.FromResult(ClinicalRecordAuthorizationResult.Success());

        return Task.FromResult(ClinicalRecordAuthorizationResult.Fail("Only the patient can manage access grants."));
    }

    private Task<bool> HasActiveGrantAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken)
    {
        DateTime utcNow = DateTime.UtcNow;

        return context.ClinicalRecordAccessGrants.AnyAsync(g =>
                g.PatientId == patientId
                && g.DoctorId == doctorId
                && g.Status == ClinicalRecordAccessGrantStatus.Active
                && g.StartAt <= utcNow
                && (!g.EndAt.HasValue || g.EndAt >= utcNow)
                && !g.RevokedAt.HasValue,
            cancellationToken);
    }
}
