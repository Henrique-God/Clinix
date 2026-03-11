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
            AppointmentOwnershipResponse? response = await httpClient.GetFromJsonAsync<AppointmentOwnershipResponse>(
                $"internal/appointments/{appointmentId}/ownership?patientId={patientId}&doctorId={doctorId}",
                cancellationToken);

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
            AppointmentRelationshipResponse? response = await httpClient.GetFromJsonAsync<AppointmentRelationshipResponse>(
                $"internal/appointments/relationship-check?patientId={patientId}&doctorId={doctorId}&mode={mode}",
                cancellationToken);

            return response?.HasRelationship ?? false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not validate appointment relationship for patient {PatientId} and doctor {DoctorId}.", patientId, doctorId);
            return false;
        }
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
