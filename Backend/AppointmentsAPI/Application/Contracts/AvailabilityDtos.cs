using System.ComponentModel.DataAnnotations;
using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Application.Contracts;

public sealed class CreateAvailabilityRequestDto
{
    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    [Required]
    public ScheduleVisibility Visibility { get; set; }

    public bool AcceptsPrivate { get; set; } = true;

    public bool AcceptsInsurance { get; set; }

    public List<string>? InsurancePlans { get; set; }
}

public sealed class UpdateAvailabilityRequestDto
{
    [Required]
    public DateTime StartTime { get; set; }

    [Required]
    public DateTime EndTime { get; set; }

    [Required]
    public ScheduleVisibility Visibility { get; set; }

    public bool AcceptsPrivate { get; set; } = true;

    public bool AcceptsInsurance { get; set; }

    public List<string>? InsurancePlans { get; set; }
}

public sealed class AvailabilityQueryDto
{
    public DateTime? FromUtc { get; set; }

    public DateTime? ToUtc { get; set; }

    public ScheduleVisibility? Visibility { get; set; }
}

public sealed class AvailableSlotsQueryDto
{
    [Required]
    public DateTime FromUtc { get; set; }

    [Required]
    public DateTime ToUtc { get; set; }

    [Range(15, 240)]
    public int DurationMinutes { get; set; } = 30;

    public string? InsurancePlan { get; set; }
}

public sealed class AvailabilityResponseDto
{
    public Guid Id { get; set; }

    public Guid DoctorId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public ScheduleVisibility Visibility { get; set; }

    public bool AcceptsPrivate { get; set; }

    public bool AcceptsInsurance { get; set; }

    public IReadOnlyCollection<string> InsurancePlans { get; set; } = Array.Empty<string>();

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public sealed class AvailableSlotResponseDto
{
    public Guid DoctorId { get; set; }

    public Guid AvailabilityId { get; set; }

    public DateTime StartTime { get; set; }

    public DateTime EndTime { get; set; }

    public bool AcceptsPrivate { get; set; }

    public bool AcceptsInsurance { get; set; }

    public IReadOnlyCollection<string> InsurancePlans { get; set; } = Array.Empty<string>();

    public int? ConsultationPriceCents { get; set; }
}
