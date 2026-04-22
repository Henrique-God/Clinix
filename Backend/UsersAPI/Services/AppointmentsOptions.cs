namespace UsersAPI.Services;

public class AppointmentsOptions
{
    public const string SectionName = "Appointments";

    public string BaseUrl { get; set; } = string.Empty;

    public string InternalApiKey { get; set; } = string.Empty;
}
