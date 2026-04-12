using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using UsersAPI.Services;

namespace UsersAPI.Infrastructure;

public class PremiumAuthorizationFilter : IAsyncAuthorizationFilter
{
    private readonly ISubscriptionService subscriptionService;

    public PremiumAuthorizationFilter(ISubscriptionService subscriptionService)
    {
        this.subscriptionService = subscriptionService;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        string? userIdValue = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!Guid.TryParse(userIdValue, out Guid userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        bool hasPremium = await subscriptionService.HasActivePremiumAsync(userId);

        if (!hasPremium)
        {
            context.Result = new ObjectResult(new { error = "Premium subscription required." })
            {
                StatusCode = 403
            };
        }
    }
}
