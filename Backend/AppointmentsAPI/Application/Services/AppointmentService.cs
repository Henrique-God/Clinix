using System.Data;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Data;
using AppointmentsAPI.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace AppointmentsAPI.Application.Services;

public class AppointmentService
{
    private readonly AppointmentsDbContext context;
    private readonly ICurrentActorAccessor currentActorAccessor;
    private readonly IClock clock;
    private readonly IUserDirectoryService userDirectoryService;
    private readonly IClinicalRecordsGateway clinicalRecordsGateway;
    private readonly IIntegrationEventPublisher integrationEventPublisher;

    public AppointmentService(
        AppointmentsDbContext context,
        ICurrentActorAccessor currentActorAccessor,
        IClock clock,
        IUserDirectoryService userDirectoryService,
        IClinicalRecordsGateway clinicalRecordsGateway,
        IIntegrationEventPublisher integrationEventPublisher)
    {
        this.context = context;
        this.currentActorAccessor = currentActorAccessor;
        this.clock = clock;
        this.userDirectoryService = userDirectoryService;
        this.clinicalRecordsGateway = clinicalRecordsGateway;
        this.integrationEventPublisher = integrationEventPublisher;
    }

    public async Task<Appointment> InviteAsync(CreateAppointmentInviteRequestDto request, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        DateTime utcNow = clock.UtcNow;
        DateTime startTime = NormalizeUtc(request.StartTime);
        DateTime endTime = NormalizeUtc(request.EndTime);
        DateTime invitationExpiresAt = NormalizeUtc(request.InvitationExpiresAt);
        AppointmentParticipantRole invitedByRole;

        if (actor.IsDoctor)
        {
            if (request.DoctorId != actor.UserId)
                throw DomainRuleException.Forbidden("doctor_not_authorized", "Doctors can only create invitations for themselves.");

            invitedByRole = AppointmentParticipantRole.Doctor;
            await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);
            await EnsureActivePatientAsync(request.PatientId, cancellationToken);
        }
        else if (actor.IsPatient)
        {
            if (request.PatientId != actor.UserId)
                throw DomainRuleException.Forbidden("patient_not_authorized", "Patients can only create invitations for themselves.");

            invitedByRole = AppointmentParticipantRole.Patient;
            await EnsureActivePatientAsync(actor.UserId, cancellationToken);
            await EnsureActiveDoctorAsync(request.DoctorId, cancellationToken);
            await EnsureDoctorHasPublicAvailabilityAsync(request.DoctorId, startTime, endTime, cancellationToken);
        }
        else
        {
            throw DomainRuleException.Forbidden("unsupported_role", "Only doctors or patients can create appointment invitations.");
        }

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);
        await EnsureDoctorScheduleIsFreeAsync(request.DoctorId, startTime, endTime, null, utcNow, cancellationToken);

        Appointment appointment = Appointment.CreateInvitation(
            request.DoctorId,
            request.PatientId,
            actor.UserId,
            invitedByRole,
            request.Title,
            request.Description,
            request.Location,
            request.InvitationMessage,
            startTime,
            endTime,
            invitationExpiresAt,
            utcNow);

        AgendaEvent agendaEvent = AgendaEvent.CreateForAppointment(appointment, utcNow);
        appointment.AgendaEvent = agendaEvent;

        context.Appointments.Add(appointment);
        context.AgendaEvents.Add(agendaEvent);
        await context.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("AppointmentInvited", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId,
            invitedByUserId = appointment.InvitationMetadata.InvitedByUserId,
            invitedByRole = appointment.InvitationMetadata.InvitedByRole.ToString(),
            startTime = appointment.StartTime,
            endTime = appointment.EndTime
        }, cancellationToken);

        return appointment;
    }

    public async Task<Appointment> AcceptAsync(Guid appointmentId, RespondToInvitationRequestDto? request, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        if (!actor.IsDoctor && !actor.IsPatient)
            throw DomainRuleException.Forbidden("unsupported_role", "Only doctors or patients can accept appointment invitations.");

        Appointment appointment = await GetAppointmentForUpdateAsync(appointmentId, cancellationToken);
        await EnsureActiveDoctorAsync(appointment.DoctorId, cancellationToken);

        if (actor.IsDoctor)
            await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);

        appointment.Accept(actor.UserId, actor.IsDoctor ? AppointmentParticipantRole.Doctor : AppointmentParticipantRole.Patient, utcNow, request?.Note);
        MarkLatestStatusHistoryAsAdded(appointment);
        EnsureAppointmentAgendaEvent(appointment, utcNow);

        await context.SaveChangesAsync(cancellationToken);
        await clinicalRecordsGateway.GrantDoctorAccessAsync(
            appointment.Id,
            appointment.PatientId,
            appointment.DoctorId,
            appointment.EndTime,
            cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("AppointmentAccepted", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId,
            acceptedAt = appointment.AcceptedAt
        }, cancellationToken);

        await integrationEventPublisher.PublishAsync("ClinicalRecordAccessGranted", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId
        }, cancellationToken);

        return appointment;
    }

    public async Task<Appointment> RejectAsync(Guid appointmentId, RespondToInvitationRequestDto? request, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        if (!actor.IsDoctor && !actor.IsPatient)
            throw DomainRuleException.Forbidden("unsupported_role", "Only doctors or patients can reject appointment invitations.");

        Appointment appointment = await GetAppointmentForUpdateAsync(appointmentId, cancellationToken);
        if (actor.IsDoctor)
            await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);

        DateTime utcNow = clock.UtcNow;

        appointment.Reject(actor.UserId, actor.IsDoctor ? AppointmentParticipantRole.Doctor : AppointmentParticipantRole.Patient, utcNow, request?.Note);
        MarkLatestStatusHistoryAsAdded(appointment);
        EnsureAppointmentAgendaEvent(appointment, utcNow);

        await context.SaveChangesAsync(cancellationToken);
        await integrationEventPublisher.PublishAsync("AppointmentRejected", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId,
            rejectedAt = appointment.RejectedAt
        }, cancellationToken);

        return appointment;
    }

    public async Task<Appointment> CancelAsync(Guid appointmentId, CancelAppointmentRequestDto? request, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        Appointment appointment = await GetAppointmentForUpdateAsync(appointmentId, cancellationToken);
        DateTime utcNow = clock.UtcNow;

        if (actor.IsDoctor)
        {
            await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);
            appointment.CancelByDoctor(actor.UserId, utcNow, request?.Reason);
        }
        else if (actor.IsPatient)
        {
            appointment.CancelByPatient(actor.UserId, utcNow, request?.Reason);
        }
        else
        {
            throw DomainRuleException.Forbidden("unsupported_role", "Only doctors or patients can cancel appointments.");
        }

        MarkLatestStatusHistoryAsAdded(appointment);
        EnsureAppointmentAgendaEvent(appointment, utcNow);
        await context.SaveChangesAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("AppointmentCancelled", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId,
            cancelledAt = appointment.CancelledAt,
            status = appointment.Status.ToString()
        }, cancellationToken);

        return appointment;
    }

    public async Task<Appointment> CompleteAsync(Guid appointmentId, CompleteAppointmentRequestDto? request, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        if (!actor.IsDoctor)
            throw DomainRuleException.Forbidden("doctor_role_required", "Only doctors can complete appointments.");

        Appointment appointment = await GetAppointmentForUpdateAsync(appointmentId, cancellationToken);
        await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);

        appointment.Complete(actor.UserId, utcNow);
        MarkLatestStatusHistoryAsAdded(appointment);
        EnsureAppointmentAgendaEvent(appointment, utcNow);

        await context.SaveChangesAsync(cancellationToken);

        if (request?.CreateClinicalRecordEntry ?? true)
        {
            await clinicalRecordsGateway.CreateAppointmentCompletionEntryAsync(
                appointment.Id,
                appointment.PatientId,
                appointment.DoctorId,
                appointment.EndTime,
                request?.ClinicalSummaryTitle ?? appointment.Title,
                request?.ClinicalSummaryDescription ?? appointment.Description,
                cancellationToken);

            await integrationEventPublisher.PublishAsync("ClinicalRecordEntryCreated", new
            {
                appointmentId = appointment.Id,
                doctorId = appointment.DoctorId,
                patientId = appointment.PatientId
            }, cancellationToken);
        }

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("AppointmentCompleted", new
        {
            appointmentId = appointment.Id,
            doctorId = appointment.DoctorId,
            patientId = appointment.PatientId,
            completedAt = appointment.CompletedAt
        }, cancellationToken);

        return appointment;
    }

    public async Task<Appointment> GetByIdForCurrentActorAsync(Guid appointmentId, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();

        Appointment appointment = await context.Appointments
            .AsNoTracking()
            .Include(item => item.InvitationMetadata)
            .Include(item => item.StatusHistory)
            .FirstOrDefaultAsync(item => item.Id == appointmentId, cancellationToken)
            ?? throw DomainRuleException.NotFound("appointment_not_found", "Appointment not found.");

        bool isDoctorOwner = actor.IsDoctor && appointment.DoctorId == actor.UserId;
        bool isPatientOwner = actor.IsPatient && appointment.PatientId == actor.UserId;

        if (!isDoctorOwner && !isPatientOwner)
            throw DomainRuleException.Forbidden("appointment_not_accessible", "The current user cannot access this appointment.");

        return appointment;
    }

    public async Task<IReadOnlyCollection<Appointment>> GetPatientAppointmentsAsync(AppointmentListQueryDto query, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        if (!actor.IsPatient)
            throw DomainRuleException.Forbidden("patient_role_required", "Only patients can list patient appointments.");

        IQueryable<Appointment> appointments = context.Appointments
            .AsNoTracking()
            .Include(item => item.InvitationMetadata)
            .Include(item => item.StatusHistory)
            .Where(item => item.PatientId == actor.UserId);

        appointments = ApplyAppointmentFilters(appointments, query);

        return await appointments
            .OrderBy(item => item.StartTime)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<Appointment>> GetDoctorAppointmentsAsync(AppointmentListQueryDto query, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();
        if (!actor.IsDoctor)
            throw DomainRuleException.Forbidden("doctor_role_required", "Only doctors can list doctor appointments.");

        await EnsureActiveDoctorAsync(actor.UserId, cancellationToken);

        IQueryable<Appointment> appointments = context.Appointments
            .AsNoTracking()
            .Include(item => item.InvitationMetadata)
            .Include(item => item.StatusHistory)
            .Where(item => item.DoctorId == actor.UserId);

        appointments = ApplyAppointmentFilters(appointments, query);

        return await appointments
            .OrderBy(item => item.StartTime)
            .ToListAsync(cancellationToken);
    }

    public Task<bool> HasRelationshipAsync(Guid patientId, Guid doctorId, bool completedOnly, CancellationToken cancellationToken)
    {
        AppointmentStatus[] qualifyingStatuses = completedOnly
            ? [AppointmentStatus.Completed]
            : [AppointmentStatus.Accepted, AppointmentStatus.Completed];

        return context.Appointments.AnyAsync(item =>
                item.PatientId == patientId
                && item.DoctorId == doctorId
                && qualifyingStatuses.Contains(item.Status),
            cancellationToken);
    }

    public Task<bool> IsOwnedCompletedAppointmentAsync(Guid appointmentId, Guid patientId, Guid doctorId, CancellationToken cancellationToken) =>
        context.Appointments.AnyAsync(item =>
                item.Id == appointmentId
                && item.PatientId == patientId
                && item.DoctorId == doctorId
                && item.Status == AppointmentStatus.Completed,
            cancellationToken);

    private IQueryable<Appointment> ApplyAppointmentFilters(IQueryable<Appointment> appointments, AppointmentListQueryDto query)
    {
        if (query.FromUtc.HasValue)
        {
            DateTime fromUtc = NormalizeUtc(query.FromUtc.Value);
            appointments = appointments.Where(item => item.EndTime >= fromUtc);
        }

        if (query.ToUtc.HasValue)
        {
            DateTime toUtc = NormalizeUtc(query.ToUtc.Value);
            appointments = appointments.Where(item => item.StartTime <= toUtc);
        }

        if (query.Status.HasValue)
            appointments = appointments.Where(item => item.Status == query.Status.Value);

        return appointments;
    }

    private async Task EnsureDoctorScheduleIsFreeAsync(
        Guid doctorId,
        DateTime startTime,
        DateTime endTime,
        Guid? excludeAppointmentId,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        bool hasAppointmentConflict = await context.Appointments.AnyAsync(item =>
            item.DoctorId == doctorId
            && (!excludeAppointmentId.HasValue || item.Id != excludeAppointmentId.Value)
            && startTime < item.EndTime
            && endTime > item.StartTime
            && (item.Status == AppointmentStatus.Accepted
                || (item.Status == AppointmentStatus.PendingAcceptance
                    && item.InvitationExpiresAt > utcNow
                    && item.StartTime > utcNow)),
            cancellationToken);

        if (hasAppointmentConflict)
            throw DomainRuleException.Conflict("doctor_schedule_conflict", "The doctor already has an appointment or pending invitation in this time range.");

        bool hasManualEventConflict = await context.AgendaEvents.AnyAsync(item =>
                item.DoctorId == doctorId
                && item.AppointmentId == null
                && !item.DeletedAt.HasValue
                && item.BlocksScheduling
                && startTime < item.EndTime
                && endTime > item.StartTime,
            cancellationToken);

        if (hasManualEventConflict)
            throw DomainRuleException.Conflict("doctor_schedule_conflict", "The doctor already has a blocking calendar event in this time range.");
    }

    private async Task EnsureDoctorHasPublicAvailabilityAsync(
        Guid doctorId,
        DateTime startTime,
        DateTime endTime,
        CancellationToken cancellationToken)
    {
        bool isCoveredByPublicAvailability = await context.DoctorAvailabilities.AnyAsync(item =>
            item.DoctorId == doctorId
            && !item.DeletedAt.HasValue
            && item.Visibility == ScheduleVisibility.Public
            && item.StartTime <= startTime
            && item.EndTime >= endTime,
            cancellationToken);

        if (!isCoveredByPublicAvailability)
            throw DomainRuleException.Conflict("doctor_public_availability_required", "Patients can only invite doctors within a public availability slot.");
    }

    private async Task<UserDirectoryEntry> EnsureActiveDoctorAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        UserDirectoryEntry? doctor = await userDirectoryService.GetUserAsync(doctorId, cancellationToken);
        if (doctor is null || !string.Equals(doctor.UserType, "Doctor", StringComparison.OrdinalIgnoreCase))
            throw DomainRuleException.Validation("doctor_not_found", "Doctor profile was not found in UsersAPI.");

        if (!doctor.IsActive)
            throw DomainRuleException.Conflict("doctor_inactive", "Inactive doctors cannot manage or receive appointments.");

        return doctor;
    }

    private async Task<UserDirectoryEntry> EnsureActivePatientAsync(Guid patientId, CancellationToken cancellationToken)
    {
        UserDirectoryEntry? patient = await userDirectoryService.GetUserAsync(patientId, cancellationToken);
        if (patient is null || !string.Equals(patient.UserType, "User", StringComparison.OrdinalIgnoreCase))
            throw DomainRuleException.Validation("patient_not_found", "Patient profile was not found in UsersAPI.");

        if (!patient.IsActive)
            throw DomainRuleException.Conflict("patient_inactive", "Inactive patients cannot receive appointments.");

        return patient;
    }

    private async Task<Appointment> GetAppointmentForUpdateAsync(Guid appointmentId, CancellationToken cancellationToken) =>
        await context.Appointments
            .Include(item => item.InvitationMetadata)
            .Include(item => item.StatusHistory)
            .Include(item => item.AgendaEvent)
            .FirstOrDefaultAsync(item => item.Id == appointmentId, cancellationToken)
        ?? throw DomainRuleException.NotFound("appointment_not_found", "Appointment not found.");

    private void EnsureAppointmentAgendaEvent(Appointment appointment, DateTime utcNow)
    {
        if (appointment.AgendaEvent is null)
        {
            appointment.AgendaEvent = AgendaEvent.CreateForAppointment(appointment, utcNow);
            context.AgendaEvents.Add(appointment.AgendaEvent);
            return;
        }

        appointment.AgendaEvent.SyncWithAppointment(appointment, utcNow);
    }

    private void MarkLatestStatusHistoryAsAdded(Appointment appointment)
    {
        AppointmentStatusHistory latestStatusHistory = appointment.StatusHistory
            .OrderBy(item => item.ChangedAt)
            .Last();

        context.Entry(latestStatusHistory).State = EntityState.Added;
    }

    private Task<IDbContextTransaction?> BeginTransactionIfNeededAsync(CancellationToken cancellationToken)
    {
        if (!context.Database.IsRelational())
            return Task.FromResult<IDbContextTransaction?>(null);

        return context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)!;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        TimePrecision.NormalizeSchedulingUtc(value);
}
