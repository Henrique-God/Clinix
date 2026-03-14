namespace AppointmentsAPI.Infrastructure.Integrations;

public class ClinicalRecordsOptions
{
    public const string SectionName = "ClinicalRecords";

    public string BaseUrl { get; set; } = string.Empty;

    public string InternalApiKey { get; set; } = string.Empty;
}
