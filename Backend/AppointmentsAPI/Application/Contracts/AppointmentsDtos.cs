using System.ComponentModel.DataAnnotations;
using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Application.Contracts;

public sealed class CreateAppointmentInviteRequestDto
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    [Required]
    public DateTime InvitationExpiresAt { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(200)]
    public string? Location { get; set; }

    [MaxLength(1000)]
    public string? InvitationMessage { get; set; }
}

public sealed class RespondToInvitationRequestDto
{
    [MaxLength(1000)]
    public string? Note { get; set; }
}

public sealed class CancelAppointmentRequestDto
{
    [MaxLength(1000)]
    public string? Reason { get; set; }
}

public sealed class CompleteAppointmentRequestDto
{
    public bool CreateClinicalRecordEntry { get; set; } = true;

    [MaxLength(200)]
    public string? ClinicalSummaryTitle { get; set; }

    [MaxLength(2000)]
    public string? ClinicalSummaryDescription { get; set; }
}

public sealed class AppointmentListQueryDto
{
    public DateTime? FromUtc { get; set; }

    public DateTime? ToUtc { get; set; }

    public AppointmentStatus? Status { get; set; }
}

public sealed class AppointmentResponseDto
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

    public bool IsInvitationExpired { get; set; }

    public AppointmentStatus Status { get; set; }

    public string? InvitationMessage { get; set; }

    public string? PatientResponseNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? AcceptedAt { get; set; }

    public DateTime? RejectedAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public List<AppointmentStatusHistoryResponseDto> History { get; set; } = new();
}

public sealed class AppointmentStatusHistoryResponseDto
{
    public AppointmentStatus? FromStatus { get; set; }

    public AppointmentStatus ToStatus { get; set; }

    public Guid ChangedByUserId { get; set; }

    public DateTime ChangedAt { get; set; }

    public string? Reason { get; set; }
}
