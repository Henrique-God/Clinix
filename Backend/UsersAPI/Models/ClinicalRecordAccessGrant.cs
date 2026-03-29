namespace UsersAPI.Models;

public class ClinicalRecordAccessGrant
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public Guid GrantedByPatientId { get; set; }
    public ClinicalRecordAccessGrantStatus Status { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}
