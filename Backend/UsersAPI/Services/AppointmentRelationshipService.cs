using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace UsersAPI.Services;

public class AppointmentRelationshipService : IAppointmentRelationshipService
{
    private readonly HttpClient httpClient;
    private readonly ILogger<AppointmentRelationshipService> logger;
    private readonly AppointmentsOptions options;

    public AppointmentRelationshipService(
        HttpClient httpClient,
        IOptions<AppointmentsOptions> options,
        ILogger<AppointmentRelationshipService> logger)
    {
        this.httpClient = httpClient;
        this.logger = logger;
        this.options = options.Value;
    }

    public Task<bool> HasScheduledOrCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default) =>
        QueryRelationshipAsync("scheduled-or-completed", patientId, doctorId, cancellationToken);

    public Task<bool> HasCompletedAppointmentAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken = default) =>
        QueryRelationshipAsync("completed", patientId, doctorId, cancellationToken);

    public async Task<bool> IsAppointmentOwnedByDoctorAndPatientAsync(Guid appointmentId, Guid patientId, Guid doctorId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            logger.LogWarning("Appointments base URL is not configured. Appointment ownership validation will fail closed.");
            return false;
        }

        try
        {
            using var request = CreateInternalRequest(
                $"internal/appointments/{appointmentId}/ownership?patientId={patientId}&doctorId={doctorId}");
            using var httpResponse = await httpClient.SendAsync(request, cancellationToken);
            if (!httpResponse.IsSuccessStatusCode)
                return false;

            var response = await httpResponse.Content.ReadFromJsonAsync<AppointmentOwnershipResponse>(cancellationToken: cancellationToken);

            return response?.Matches ?? false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not validate appointment ownership for {AppointmentId}.", appointmentId);
            return false;
        }
    }

    private async Task<bool> QueryRelationshipAsync(string mode, Guid patientId, Guid doctorId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.BaseUrl))
        {
            logger.LogWarning("Appointments base URL is not configured. Relationship validation will fail closed.");
            return false;
        }

        try
        {
            using var request = CreateInternalRequest(
                $"internal/appointments/relationship-check?patientId={patientId}&doctorId={doctorId}&mode={mode}");
            using var httpResponse = await httpClient.SendAsync(request, cancellationToken);
            if (!httpResponse.IsSuccessStatusCode)
                return false;

            var response = await httpResponse.Content.ReadFromJsonAsync<AppointmentRelationshipResponse>(cancellationToken: cancellationToken);

            return response?.HasRelationship ?? false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not validate appointment relationship for patient {PatientId} and doctor {DoctorId}.", patientId, doctorId);
            return false;
        }
    }

    private HttpRequestMessage CreateInternalRequest(string relativeUrl)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, relativeUrl);
        if (!string.IsNullOrWhiteSpace(options.InternalApiKey))
            request.Headers.Add("X-Internal-Api-Key", options.InternalApiKey);

        return request;
    }

    private sealed class AppointmentRelationshipResponse
    {
        public bool HasRelationship { get; set; }
    }

    private sealed class AppointmentOwnershipResponse
    {
        public bool Matches { get; set; }
    }
}
