namespace UsersAPI.Models;

public class ClinicalRecord
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
