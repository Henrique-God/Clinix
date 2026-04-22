using System.ComponentModel.DataAnnotations;

namespace UsersAPI.Models.DTOs;

public class CreateClinicalRecordAccessGrantRequestDTO
{
    [Required]
    public Guid DoctorId { get; set; }

    [MaxLength(512)]
    public string Reason { get; set; } = string.Empty;

    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
}
