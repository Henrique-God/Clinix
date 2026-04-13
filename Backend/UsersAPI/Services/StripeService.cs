using Stripe;
using Stripe.Checkout;

namespace UsersAPI.Services;

public class StripeService : IStripeService
{
    private readonly IConfiguration configuration;

    public StripeService(IConfiguration configuration)
    {
        this.configuration = configuration;
        StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey is not configured.");
    }

    public async Task<Customer> CreateCustomerAsync(string email, string name)
    {
        var options = new CustomerCreateOptions
        {
            Email = email,
            Name = name
        };

        var service = new CustomerService();
        return await service.CreateAsync(options);
    }

    public async Task<Stripe.Subscription> CreateTrialSubscriptionAsync(string stripeCustomerId, int trialDays)
    {
        string priceId = configuration["Stripe:PriceId"]
            ?? throw new InvalidOperationException("Stripe:PriceId is not configured.");

        var options = new SubscriptionCreateOptions
        {
            Customer = stripeCustomerId,
            Items = new List<SubscriptionItemOptions>
            {
                new SubscriptionItemOptions { Price = priceId }
            },
            TrialPeriodDays = trialDays,
            PaymentSettings = new SubscriptionPaymentSettingsOptions
            {
                SaveDefaultPaymentMethod = "off_session"
            },
            TrialSettings = new SubscriptionTrialSettingsOptions
            {
                EndBehavior = new SubscriptionTrialSettingsEndBehaviorOptions
                {
                    MissingPaymentMethod = "cancel"
                }
            }
        };

        var service = new Stripe.SubscriptionService();
        return await service.CreateAsync(options);
    }

    public async Task<Session> CreateCheckoutSessionAsync(string stripeCustomerId, string successUrl, string cancelUrl)
    {
        string priceId = configuration["Stripe:PriceId"]
            ?? throw new InvalidOperationException("Stripe:PriceId is not configured.");

        var options = new SessionCreateOptions
        {
            Customer = stripeCustomerId,
            Mode = "subscription",
            LineItems = new List<SessionLineItemOptions>
            {
                new SessionLineItemOptions
                {
                    Price = priceId,
                    Quantity = 1
                }
            },
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl
        };

        var service = new SessionService();
        return await service.CreateAsync(options);
    }

    public async Task CancelSubscriptionAsync(string stripeSubscriptionId)
    {
        var service = new Stripe.SubscriptionService();
        await service.CancelAsync(stripeSubscriptionId);
    }
}
