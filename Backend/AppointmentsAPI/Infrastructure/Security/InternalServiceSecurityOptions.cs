namespace AppointmentsAPI.Infrastructure.Security;

public class InternalServiceSecurityOptions
{
    public const string SectionName = "InternalServices";

    public string ApiKey { get; set; } = string.Empty;
}
