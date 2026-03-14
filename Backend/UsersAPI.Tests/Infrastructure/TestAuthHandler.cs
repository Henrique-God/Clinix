using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

namespace UsersAPI.Tests.Infrastructure;

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Test-UserId", out StringValues userIdValues))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing X-Test-UserId header."));
        }

        string userId = userIdValues.ToString();
        string email = Request.Headers.TryGetValue("X-Test-Email", out StringValues emailValues)
            ? emailValues.ToString()
            : "test@clinix.local";
        string role = Request.Headers.TryGetValue("X-Test-Role", out StringValues roleValues)
            ? roleValues.ToString()
            : "User";

        List<Claim> claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role)
        };

        ClaimsIdentity identity = new ClaimsIdentity(claims, SchemeName);
        ClaimsPrincipal principal = new ClaimsPrincipal(identity);
        AuthenticationTicket ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
