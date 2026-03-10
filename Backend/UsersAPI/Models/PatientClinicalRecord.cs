namespace UsersAPI.Models;

public class PatientClinicalRecord
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<ClinicalRecordEntry> Entries { get; set; } = [];
}
