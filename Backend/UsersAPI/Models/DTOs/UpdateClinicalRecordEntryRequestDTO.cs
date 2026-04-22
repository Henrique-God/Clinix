using System.ComponentModel.DataAnnotations;

namespace UsersAPI.Models.DTOs;

public class UpdateClinicalRecordEntryRequestDTO
{
    [Required]
    [MaxLength(256)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;

    public bool IsVisibleToPatient { get; set; } = true;
}
