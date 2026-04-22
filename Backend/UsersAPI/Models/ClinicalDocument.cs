namespace UsersAPI.Models;

public class ClinicalDocument
{
    public Guid Id { get; set; }
    public Guid ClinicalRecordEntryId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeInBytes { get; set; }
    public string S3Key { get; set; } = string.Empty;
    public Guid UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public ClinicalRecordEntry? ClinicalRecordEntry { get; set; }
}
