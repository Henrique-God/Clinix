using System.ComponentModel.DataAnnotations;
using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Application.Contracts;

public sealed class CreateCalendarEventRequestDto
{
    [Required]
    public AgendaEventType Type { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }
}

public sealed class UpdateCalendarEventRequestDto
{
    [Required]
    public AgendaEventType Type { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }
}

public sealed class CalendarQueryDto
{
    public string? View { get; set; }

    public DateTime? ReferenceDateUtc { get; set; }

    public DateTime? FromUtc { get; set; }

    public DateTime? ToUtc { get; set; }
}

public sealed class AgendaEventResponseDto
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

    public AppointmentStatus? AppointmentStatus { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
