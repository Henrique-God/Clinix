namespace AppointmentsAPI.Infrastructure.Integrations;

public class UsersApiOptions
{
    public const string SectionName = "UsersApi";

    public string BaseUrl { get; set; } = string.Empty;

    public string InternalApiKey { get; set; } = string.Empty;
}
