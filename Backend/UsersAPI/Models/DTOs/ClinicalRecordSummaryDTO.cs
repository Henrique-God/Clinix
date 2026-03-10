namespace UsersAPI.Models.DTOs;

public class ClinicalRecordSummaryDTO
{
    public Guid ClinicalRecordId { get; set; }
    public Guid PatientId { get; set; }
    public int ActiveEntriesCount { get; set; }
    public int ActiveDocumentsCount { get; set; }
    public int ActiveAccessGrantsCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
