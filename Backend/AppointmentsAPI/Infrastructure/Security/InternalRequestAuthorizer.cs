using System.Security.Cryptography;
using System.Text;
using AppointmentsAPI.Domain;
using Microsoft.Extensions.Options;

namespace AppointmentsAPI.Infrastructure.Security;

public interface IInternalRequestAuthorizer
{
    void EnsureAuthorized(HttpRequest request);
}

public class InternalRequestAuthorizer : IInternalRequestAuthorizer
{
    private readonly InternalServiceSecurityOptions options;

    public InternalRequestAuthorizer(IOptions<InternalServiceSecurityOptions> options)
    {
        this.options = options.Value;
    }

    public void EnsureAuthorized(HttpRequest request)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
            throw DomainRuleException.ServiceUnavailable("internal_security_not_configured", "Internal services API key is not configured.");

        if (!request.Headers.TryGetValue("X-Internal-Api-Key", out var providedValue))
            throw DomainRuleException.Forbidden("internal_unauthorized", "Missing internal API key.");

        byte[] expected = Encoding.UTF8.GetBytes(options.ApiKey);
        byte[] provided = Encoding.UTF8.GetBytes(providedValue.ToString());

        if (!CryptographicOperations.FixedTimeEquals(expected, provided))
            throw DomainRuleException.Forbidden("internal_unauthorized", "Invalid internal API key.");
    }
}
