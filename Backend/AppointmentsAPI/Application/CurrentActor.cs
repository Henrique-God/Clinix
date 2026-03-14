using System.Security.Claims;
using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Application;

public enum ActorRole
{
    Patient = 1,
    Doctor = 2,
    Admin = 3
}

public sealed class CurrentActor
{
    public Guid UserId { get; init; }

    public ActorRole Role { get; init; }

    public bool IsDoctor => Role == ActorRole.Doctor;

    public bool IsPatient => Role == ActorRole.Patient;

    public bool IsAdmin => Role == ActorRole.Admin;

    public static CurrentActor FromClaims(ClaimsPrincipal principal)
    {
        string? userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue(ClaimTypes.Name);
        string? roleValue = principal.FindFirstValue(ClaimTypes.Role);

        if (string.IsNullOrWhiteSpace(userIdValue) || string.IsNullOrWhiteSpace(roleValue))
            throw DomainRuleException.Forbidden("missing_claims", "Authenticated user is missing required claims.");

        return new CurrentActor
        {
            UserId = Guid.Parse(userIdValue),
            Role = roleValue.ToLowerInvariant() switch
            {
                "doctor" => ActorRole.Doctor,
                "admin" => ActorRole.Admin,
                "user" => ActorRole.Patient,
                _ => throw DomainRuleException.Forbidden("invalid_role", "Authenticated user role is not supported.")
            }
        };
    }
}
