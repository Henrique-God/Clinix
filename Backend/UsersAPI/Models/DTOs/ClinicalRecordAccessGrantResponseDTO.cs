using UsersAPI.Models;

namespace UsersAPI.Models.DTOs;

public class ClinicalRecordAccessGrantResponseDTO
{
    public Guid Id { get; set; }
    public Guid DoctorId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public ClinicalRecordAccessGrantStatus Status { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}
