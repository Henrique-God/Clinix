namespace AppointmentsAPI.Domain;

public enum AppointmentStatus
{
    PendingAcceptance = 1,
    Accepted = 2,
    Rejected = 3,
    CancelledByPatient = 4,
    CancelledByDoctor = 5,
    Completed = 6
}

public enum AgendaEventType
{
    Appointment = 1,
    ExternalEvent = 2,
    BlockedSlot = 3,
    PersonalEvent = 4
}

public enum ScheduleVisibility
{
    Public = 1,
    Private = 2
}

public enum AppointmentParticipantRole
{
    Patient = 1,
    Doctor = 2
}

public class Appointment
{
    public Guid Id { get; set; }

    public Guid DoctorId { get; set; }

    public Guid PatientId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Location { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public DateTime InvitationExpiresAt { get; set; }

    public AppointmentStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? AcceptedAt { get; set; }

    public DateTime? RejectedAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public AppointmentInvitationMetadata InvitationMetadata { get; set; } = null!;

    public ICollection<AppointmentStatusHistory> StatusHistory { get; set; } = new List<AppointmentStatusHistory>();

    public AgendaEvent? AgendaEvent { get; set; }

    public static Appointment CreateInvitation(
        Guid doctorId,
        Guid patientId,
        Guid invitedByUserId,
        AppointmentParticipantRole invitedByRole,
        string? title,
        string? description,
        string? location,
        string? invitationMessage,
        DateTime startTime,
        DateTime endTime,
        DateTime invitationExpiresAt,
        DateTime utcNow)
    {
        SchedulingRules.ValidateRange(startTime, endTime, "Appointment");

        if (startTime <= utcNow)
            throw DomainRuleException.Validation("appointment_in_past", "Appointments must be scheduled in the future.");

        if (invitationExpiresAt <= utcNow)
            throw DomainRuleException.Validation("invitation_already_expired", "Invitation expiration must be in the future.");

        if (invitationExpiresAt > startTime)
            throw DomainRuleException.Validation("invitation_expires_after_start", "Invitation expiration must be on or before the appointment start time.");

        if (doctorId == patientId)
            throw DomainRuleException.Validation("invalid_participants", "Doctor and patient must be different users.");

        ValidateInvitationInitiator(doctorId, patientId, invitedByUserId, invitedByRole);

        Appointment appointment = new()
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            PatientId = patientId,
            Title = SchedulingRules.RequiredTrimmed(title, "Title", 200),
            Description = SchedulingRules.OptionalTrimmed(description, 2000),
            Location = SchedulingRules.OptionalTrimmed(location, 200),
            StartTime = startTime,
            EndTime = endTime,
            InvitationExpiresAt = invitationExpiresAt,
            Status = AppointmentStatus.PendingAcceptance,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        appointment.InvitationMetadata = new AppointmentInvitationMetadata
        {
            AppointmentId = appointment.Id,
            InvitedByUserId = invitedByUserId,
            InvitedByRole = invitedByRole,
            InvitationMessage = SchedulingRules.OptionalTrimmed(invitationMessage, 1000),
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        appointment.RegisterStatusChange(
            null,
            appointment.Status,
            invitedByUserId,
            utcNow,
            invitedByRole == AppointmentParticipantRole.Doctor
                ? "Invitation created by doctor."
                : "Invitation created by patient.");
        return appointment;
    }

    public bool IsInvitationExpired(DateTime utcNow) =>
        Status == AppointmentStatus.PendingAcceptance && (InvitationExpiresAt <= utcNow || StartTime <= utcNow);

    public bool BlocksScheduling(DateTime utcNow) =>
        Status == AppointmentStatus.Accepted
        || (Status == AppointmentStatus.PendingAcceptance && !IsInvitationExpired(utcNow));

    public void Accept(Guid actingUserId, AppointmentParticipantRole actingRole, DateTime utcNow, string? responseNote)
    {
        EnsureCanRespondToInvitation(actingUserId, actingRole);
        EnsurePendingAndActionable(utcNow);

        AppointmentStatus previousStatus = Status;
        Status = AppointmentStatus.Accepted;
        AcceptedAt = utcNow;
        UpdatedAt = utcNow;
        InvitationMetadata.ResponseNote = SchedulingRules.OptionalTrimmed(responseNote, 1000);
        InvitationMetadata.UpdatedAt = utcNow;
        RegisterStatusChange(
            previousStatus,
            Status,
            actingUserId,
            utcNow,
            actingRole == AppointmentParticipantRole.Doctor
                ? "Invitation accepted by doctor."
                : "Invitation accepted by patient.");
    }

    public void Reject(Guid actingUserId, AppointmentParticipantRole actingRole, DateTime utcNow, string? responseNote)
    {
        EnsureCanRespondToInvitation(actingUserId, actingRole);
        EnsurePendingAndActionable(utcNow);

        AppointmentStatus previousStatus = Status;
        Status = AppointmentStatus.Rejected;
        RejectedAt = utcNow;
        UpdatedAt = utcNow;
        InvitationMetadata.ResponseNote = SchedulingRules.OptionalTrimmed(responseNote, 1000);
        InvitationMetadata.UpdatedAt = utcNow;
        RegisterStatusChange(
            previousStatus,
            Status,
            actingUserId,
            utcNow,
            actingRole == AppointmentParticipantRole.Doctor
                ? "Invitation rejected by doctor."
                : "Invitation rejected by patient.");
    }

    public void CancelByPatient(Guid actingPatientId, DateTime utcNow, string? reason)
    {
        EnsureOwnedByPatient(actingPatientId);

        if (Status == AppointmentStatus.PendingAcceptance)
        {
            if (InvitationMetadata.InvitedByRole != AppointmentParticipantRole.Patient)
                throw DomainRuleException.Conflict("appointment_not_cancellable", "Patients can only cancel pending invitations that they created.");

            AppointmentStatus pendingPreviousStatus = Status;
            Status = AppointmentStatus.CancelledByPatient;
            CancelledAt = utcNow;
            UpdatedAt = utcNow;
            RegisterStatusChange(
                pendingPreviousStatus,
                Status,
                actingPatientId,
                utcNow,
                SchedulingRules.OptionalTrimmed(reason, 1000) ?? "Pending invitation cancelled by patient.");
            return;
        }

        if (Status != AppointmentStatus.Accepted)
            throw DomainRuleException.Conflict("appointment_not_cancellable", "Only accepted appointments can be cancelled by the patient.");

        if (utcNow >= StartTime)
            throw DomainRuleException.Conflict("appointment_already_started", "Patients cannot cancel appointments after the consultation start time.");

        AppointmentStatus previousStatus = Status;
        Status = AppointmentStatus.CancelledByPatient;
        CancelledAt = utcNow;
        UpdatedAt = utcNow;
        RegisterStatusChange(previousStatus, Status, actingPatientId, utcNow, SchedulingRules.OptionalTrimmed(reason, 1000) ?? "Appointment cancelled by patient.");
    }

    public void CancelByDoctor(Guid actingDoctorId, DateTime utcNow, string? reason)
    {
        EnsureOwnedByDoctor(actingDoctorId);

        if (Status is not AppointmentStatus.PendingAcceptance and not AppointmentStatus.Accepted)
            throw DomainRuleException.Conflict("appointment_not_cancellable", "Only pending or accepted appointments can be cancelled by the doctor.");

        if (Status == AppointmentStatus.Accepted && utcNow >= StartTime)
            throw DomainRuleException.Conflict("appointment_already_started", "Doctors cannot cancel appointments after the consultation start time.");

        AppointmentStatus previousStatus = Status;
        Status = AppointmentStatus.CancelledByDoctor;
        CancelledAt = utcNow;
        UpdatedAt = utcNow;
        RegisterStatusChange(previousStatus, Status, actingDoctorId, utcNow, SchedulingRules.OptionalTrimmed(reason, 1000) ?? "Appointment cancelled by doctor.");
    }

    public void Complete(Guid actingDoctorId, DateTime utcNow)
    {
        EnsureOwnedByDoctor(actingDoctorId);

        if (Status != AppointmentStatus.Accepted)
            throw DomainRuleException.Conflict("appointment_not_completable", "Only accepted appointments can be completed.");

        if (utcNow < StartTime)
            throw DomainRuleException.Conflict("appointment_not_started", "Appointments can only be completed after the consultation start time.");

        AppointmentStatus previousStatus = Status;
        Status = AppointmentStatus.Completed;
        CompletedAt = utcNow;
        UpdatedAt = utcNow;
        RegisterStatusChange(previousStatus, Status, actingDoctorId, utcNow, "Appointment marked as completed.");
    }

    private void EnsureOwnedByPatient(Guid actingPatientId)
    {
        if (PatientId != actingPatientId)
            throw DomainRuleException.Forbidden("patient_not_authorized", "This appointment does not belong to the current patient.");
    }

    private void EnsureOwnedByDoctor(Guid actingDoctorId)
    {
        if (DoctorId != actingDoctorId)
            throw DomainRuleException.Forbidden("doctor_not_authorized", "This appointment does not belong to the current doctor.");
    }

    private void EnsureCanRespondToInvitation(Guid actingUserId, AppointmentParticipantRole actingRole)
    {
        if (InvitationMetadata.InvitedByRole == actingRole)
            throw DomainRuleException.Forbidden("invitation_self_response_forbidden", "The invitation creator cannot respond to their own invitation.");

        EnsureOwnedByRole(actingUserId, actingRole);
    }

    private void EnsureOwnedByRole(Guid actingUserId, AppointmentParticipantRole actingRole)
    {
        if (actingRole == AppointmentParticipantRole.Doctor)
        {
            EnsureOwnedByDoctor(actingUserId);
            return;
        }

        EnsureOwnedByPatient(actingUserId);
    }

    private static void ValidateInvitationInitiator(
        Guid doctorId,
        Guid patientId,
        Guid invitedByUserId,
        AppointmentParticipantRole invitedByRole)
    {
        if (invitedByRole == AppointmentParticipantRole.Doctor && invitedByUserId != doctorId)
            throw DomainRuleException.Validation("invalid_inviter", "Doctor invitations must be created by the appointment doctor.");

        if (invitedByRole == AppointmentParticipantRole.Patient && invitedByUserId != patientId)
            throw DomainRuleException.Validation("invalid_inviter", "Patient invitations must be created by the appointment patient.");
    }

    private void EnsurePendingAndActionable(DateTime utcNow)
    {
        if (Status != AppointmentStatus.PendingAcceptance)
            throw DomainRuleException.Conflict("appointment_not_pending", "Only pending invitations can be accepted or rejected.");

        if (IsInvitationExpired(utcNow))
            throw DomainRuleException.Conflict("invitation_expired", "This invitation has already expired.");
    }

    private void RegisterStatusChange(AppointmentStatus? fromStatus, AppointmentStatus toStatus, Guid changedByUserId, DateTime changedAt, string? reason)
    {
        StatusHistory.Add(new AppointmentStatusHistory
        {
            Id = Guid.NewGuid(),
            AppointmentId = Id,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ChangedByUserId = changedByUserId,
            ChangedAt = changedAt,
            Reason = SchedulingRules.OptionalTrimmed(reason, 1000)
        });
    }
}

public class AppointmentInvitationMetadata
{
    public Guid AppointmentId { get; set; }

    public Guid InvitedByUserId { get; set; }

    public AppointmentParticipantRole InvitedByRole { get; set; }

    public string? InvitationMessage { get; set; }

    public string? ResponseNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Appointment Appointment { get; set; } = null!;
}

public class AppointmentStatusHistory
{
    public Guid Id { get; set; }

    public Guid AppointmentId { get; set; }

    public AppointmentStatus? FromStatus { get; set; }

    public AppointmentStatus ToStatus { get; set; }

    public Guid ChangedByUserId { get; set; }

    public DateTime ChangedAt { get; set; }

    public string? Reason { get; set; }

    public Appointment Appointment { get; set; } = null!;
}

public class DoctorAvailability
{
    public Guid Id { get; set; }

    public Guid DoctorId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public ScheduleVisibility Visibility { get; set; }

    public bool AcceptsPrivate { get; set; } = true;

    public bool AcceptsInsurance { get; set; }

    public string? InsurancePlans { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public static DoctorAvailability Create(
        Guid doctorId,
        DateTime startTime,
        DateTime endTime,
        ScheduleVisibility visibility,
        bool acceptsPrivate,
        bool acceptsInsurance,
        string? insurancePlans,
        DateTime utcNow)
    {
        SchedulingRules.ValidateRange(startTime, endTime, "Availability");

        if (!acceptsPrivate && !acceptsInsurance)
            throw DomainRuleException.Validation("invalid_payment_type", "At least one payment type (private or insurance) must be accepted.");

        return new DoctorAvailability
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            StartTime = startTime,
            EndTime = endTime,
            Visibility = visibility,
            AcceptsPrivate = acceptsPrivate,
            AcceptsInsurance = acceptsInsurance,
            InsurancePlans = insurancePlans,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };
    }

    public void Update(
        DateTime startTime,
        DateTime endTime,
        ScheduleVisibility visibility,
        bool acceptsPrivate,
        bool acceptsInsurance,
        string? insurancePlans,
        DateTime utcNow)
    {
        SchedulingRules.ValidateRange(startTime, endTime, "Availability");

        if (!acceptsPrivate && !acceptsInsurance)
            throw DomainRuleException.Validation("invalid_payment_type", "At least one payment type (private or insurance) must be accepted.");

        StartTime = startTime;
        EndTime = endTime;
        Visibility = visibility;
        AcceptsPrivate = acceptsPrivate;
        AcceptsInsurance = acceptsInsurance;
        InsurancePlans = insurancePlans;
        UpdatedAt = utcNow;
    }

    public void Delete(DateTime utcNow)
    {
        DeletedAt = utcNow;
        UpdatedAt = utcNow;
    }
}

public class AgendaEvent
{
    public Guid Id { get; set; }

    public Guid DoctorId { get; set; }

    public AgendaEventType Type { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public bool BlocksScheduling { get; set; }

    public Guid? AppointmentId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public Appointment? Appointment { get; set; }

    public static AgendaEvent CreateForAppointment(Appointment appointment, DateTime utcNow) =>
        new()
        {
            Id = Guid.NewGuid(),
            DoctorId = appointment.DoctorId,
            Type = AgendaEventType.Appointment,
            Title = appointment.Title,
            Description = appointment.Description,
            StartTime = appointment.StartTime,
            EndTime = appointment.EndTime,
            BlocksScheduling = appointment.BlocksScheduling(utcNow),
            AppointmentId = appointment.Id,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

    public static AgendaEvent CreateManual(
        Guid doctorId,
        AgendaEventType type,
        string? title,
        string? description,
        DateTime startTime,
        DateTime endTime,
        DateTime utcNow)
    {
        if (type == AgendaEventType.Appointment)
            throw DomainRuleException.Validation("invalid_agenda_event_type", "Manual calendar events cannot use the Appointment type.");

        SchedulingRules.ValidateRange(startTime, endTime, "Calendar event");

        return new AgendaEvent
        {
            Id = Guid.NewGuid(),
            DoctorId = doctorId,
            Type = type,
            Title = SchedulingRules.RequiredTrimmed(title, "Title", 200),
            Description = SchedulingRules.OptionalTrimmed(description, 2000),
            StartTime = startTime,
            EndTime = endTime,
            BlocksScheduling = true,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };
    }

    public void UpdateManual(
        AgendaEventType type,
        string? title,
        string? description,
        DateTime startTime,
        DateTime endTime,
        DateTime utcNow)
    {
        if (AppointmentId.HasValue)
            throw DomainRuleException.Conflict("appointment_event_managed_by_system", "Appointment-backed events are managed by the appointment lifecycle.");

        if (type == AgendaEventType.Appointment)
            throw DomainRuleException.Validation("invalid_agenda_event_type", "Manual calendar events cannot use the Appointment type.");

        SchedulingRules.ValidateRange(startTime, endTime, "Calendar event");

        Type = type;
        Title = SchedulingRules.RequiredTrimmed(title, "Title", 200);
        Description = SchedulingRules.OptionalTrimmed(description, 2000);
        StartTime = startTime;
        EndTime = endTime;
        BlocksScheduling = true;
        UpdatedAt = utcNow;
    }

    public void Delete(DateTime utcNow)
    {
        if (AppointmentId.HasValue)
            throw DomainRuleException.Conflict("appointment_event_managed_by_system", "Appointment-backed events cannot be deleted from the calendar events endpoint.");

        DeletedAt = utcNow;
        BlocksScheduling = false;
        UpdatedAt = utcNow;
    }

    public void SyncWithAppointment(Appointment appointment, DateTime utcNow)
    {
        Type = AgendaEventType.Appointment;
        Title = appointment.Title;
        Description = appointment.Description;
        StartTime = appointment.StartTime;
        EndTime = appointment.EndTime;
        BlocksScheduling = appointment.BlocksScheduling(utcNow);
        UpdatedAt = utcNow;
    }
}
