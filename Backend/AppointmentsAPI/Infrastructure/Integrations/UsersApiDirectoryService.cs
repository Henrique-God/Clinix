using System.Net;
using System.Net.Http.Json;
using AppointmentsAPI.Application;
using AppointmentsAPI.Domain;
using Microsoft.Extensions.Options;

namespace AppointmentsAPI.Infrastructure.Integrations;

public class UsersApiDirectoryService : IUserDirectoryService
{
    private readonly HttpClient httpClient;
    private readonly UsersApiOptions options;

    public UsersApiDirectoryService(HttpClient httpClient, IOptions<UsersApiOptions> options)
    {
        this.httpClient = httpClient;
        this.options = options.Value;
    }

    public async Task<UserDirectoryEntry?> GetUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        EnsureConfiguration(options.BaseUrl, options.InternalApiKey, "UsersAPI");

        using var request = new HttpRequestMessage(HttpMethod.Get, $"internal/users/{userId}");
        request.Headers.Add("X-Internal-Api-Key", options.InternalApiKey);

        try
        {
            using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound)
                return null;

            if (!response.IsSuccessStatusCode)
                throw DomainRuleException.ServiceUnavailable("users_api_unavailable", "UsersAPI rejected the user directory request.");

            return await response.Content.ReadFromJsonAsync<UserDirectoryEntry>(cancellationToken: cancellationToken);
        }
        catch (DomainRuleException)
        {
            throw;
        }
        catch (Exception)
        {
            throw DomainRuleException.ServiceUnavailable("users_api_unavailable", "UsersAPI could not be reached for user validation.");
        }
    }

    private static void EnsureConfiguration(string baseUrl, string internalApiKey, string serviceName)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw DomainRuleException.ServiceUnavailable("integration_not_configured", $"{serviceName} base URL is not configured.");

        if (string.IsNullOrWhiteSpace(internalApiKey))
            throw DomainRuleException.ServiceUnavailable("integration_not_configured", $"{serviceName} internal API key is not configured.");
    }
}
