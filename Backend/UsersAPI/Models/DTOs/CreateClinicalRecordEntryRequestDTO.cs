using System.ComponentModel.DataAnnotations;
using UsersAPI.Models;

namespace UsersAPI.Models.DTOs;

public class CreateClinicalRecordEntryRequestDTO
{
    [Required]
    public ClinicalRecordEntryType EntryType { get; set; }

    [Required]
    [MaxLength(256)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    public Guid? AppointmentId { get; set; }

    public DateTime? AppointmentOccurredAt { get; set; }

    public bool IsVisibleToPatient { get; set; } = true;
}
