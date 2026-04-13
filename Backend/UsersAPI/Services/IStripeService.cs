using Stripe;

namespace UsersAPI.Services;

public interface IStripeService
{
    Task<Customer> CreateCustomerAsync(string email, string name);
    Task<Stripe.Subscription> CreateTrialSubscriptionAsync(string stripeCustomerId, int trialDays);
    Task<Stripe.Checkout.Session> CreateCheckoutSessionAsync(string stripeCustomerId, string successUrl, string cancelUrl);
    Task CancelSubscriptionAsync(string stripeSubscriptionId);
}
