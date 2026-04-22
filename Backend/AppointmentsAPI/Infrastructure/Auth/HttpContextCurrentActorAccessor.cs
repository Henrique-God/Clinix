using AppointmentsAPI.Application;
using AppointmentsAPI.Domain;

namespace AppointmentsAPI.Infrastructure.Auth;

public class HttpContextCurrentActorAccessor : ICurrentActorAccessor
{
    private readonly IHttpContextAccessor httpContextAccessor;

    public HttpContextCurrentActorAccessor(IHttpContextAccessor httpContextAccessor)
    {
        this.httpContextAccessor = httpContextAccessor;
    }

    public CurrentActor GetRequiredActor()
    {
        if (httpContextAccessor.HttpContext?.User is null)
            throw DomainRuleException.Forbidden("missing_http_context", "Could not resolve the current authenticated user.");

        return CurrentActor.FromClaims(httpContextAccessor.HttpContext.User);
    }
}
