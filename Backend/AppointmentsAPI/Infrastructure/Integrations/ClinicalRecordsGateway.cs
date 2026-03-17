using System.Net.Http.Json;
using AppointmentsAPI.Application;
using AppointmentsAPI.Domain;
using Microsoft.Extensions.Options;

namespace AppointmentsAPI.Infrastructure.Integrations;

public class ClinicalRecordsGateway : IClinicalRecordsGateway
{
    private readonly HttpClient httpClient;
    private readonly ClinicalRecordsOptions options;

    public ClinicalRecordsGateway(HttpClient httpClient, IOptions<ClinicalRecordsOptions> options)
    {
        this.httpClient = httpClient;
        this.options = options.Value;
    }

    public async Task GrantDoctorAccessAsync(
        Guid appointmentId,
        Guid patientId,
        Guid doctorId,
        DateTime appointmentEndTimeUtc,
        CancellationToken cancellationToken = default)
    {
        EnsureConfiguration();

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"internal/patients/{patientId}/clinical-record/access-grants/from-appointment");
        request.Headers.Add("X-Internal-Api-Key", options.InternalApiKey);
        request.Content = JsonContent.Create(new
        {
            appointmentId,
            doctorId,
            appointmentEndTimeUtc
        });

        await SendAsync(request, cancellationToken);
    }

    public async Task CreateAppointmentCompletionEntryAsync(
        Guid appointmentId,
        Guid patientId,
        Guid doctorId,
        DateTime appointmentOccurredAtUtc,
        string? title,
        string? description,
        CancellationToken cancellationToken = default)
    {
        EnsureConfiguration();

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"internal/patients/{patientId}/clinical-record/entries/from-appointment");
        request.Headers.Add("X-Internal-Api-Key", options.InternalApiKey);
        request.Content = JsonContent.Create(new
        {
            appointmentId,
            doctorId,
            appointmentOccurredAtUtc,
            title,
            description
        });

        await SendAsync(request, cancellationToken);
    }

    private async Task SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                throw DomainRuleException.ServiceUnavailable("clinical_records_unavailable", "Clinical records integration request failed.");
        }
        catch (DomainRuleException)
        {
            throw;
        }
        catch (Exception)
        {
            throw DomainRuleException.ServiceUnavailable("clinical_records_unavailable", "Clinical records integration is unavailable.");
        }
    }

    private void EnsureConfiguration()
    {
        if (string.IsNullOrWhiteSpace(options.BaseUrl))
            throw DomainRuleException.ServiceUnavailable("integration_not_configured", "Clinical records base URL is not configured.");

        if (string.IsNullOrWhiteSpace(options.InternalApiKey))
            throw DomainRuleException.ServiceUnavailable("integration_not_configured", "Clinical records internal API key is not configured.");
    }
}
