using UsersAPI.Models;

namespace UsersAPI.Services;

public interface ISubscriptionService
{
    Task<Subscription> StartFreeTrialAsync(Guid userId);
    Task<Subscription?> GetSubscriptionAsync(Guid userId);
    Task<bool> HasActivePremiumAsync(Guid userId);
    Task<string> CreateCheckoutSessionAsync(Guid userId, string successUrl, string cancelUrl);
    Task CancelAsync(Guid userId);
    Task HandleWebhookEventAsync(Stripe.Event stripeEvent);
}
