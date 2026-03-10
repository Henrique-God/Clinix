namespace UsersAPI.Models;

public class ClinicalRecordEntry
{
    public Guid Id { get; set; }
    public Guid ClinicalRecordId { get; set; }
    public Guid PatientId { get; set; }
    public Guid AuthorUserId { get; set; }
    public ClinicalRecordEntryAuthorType AuthorType { get; set; }
    public ClinicalRecordEntryType EntryType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid? AppointmentId { get; set; }
    public DateTime? AppointmentOccurredAt { get; set; }
    public bool IsVisibleToPatient { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public PatientClinicalRecord? ClinicalRecord { get; set; }
    public ICollection<ClinicalDocument> Documents { get; set; } = [];
}
