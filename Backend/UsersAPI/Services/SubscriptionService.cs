using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;

namespace UsersAPI.Services;

public class SubscriptionService : ISubscriptionService
{
    private readonly IUsersDbContext context;
    private readonly IStripeService stripeService;
    private readonly IConfiguration configuration;
    private readonly ILogger<SubscriptionService> logger;

    public SubscriptionService(
        IUsersDbContext context,
        IStripeService stripeService,
        IConfiguration configuration,
        ILogger<SubscriptionService> logger)
    {
        this.context = context;
        this.stripeService = stripeService;
        this.configuration = configuration;
        this.logger = logger;
    }

    public async Task<Subscription> StartFreeTrialAsync(Guid userId)
    {
        Subscription? existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId);

        int trialDays = int.Parse(configuration["Stripe:TrialDays"] ?? "14");
        DateTime now = DateTime.UtcNow;

        if (existing != null)
        {
            if (existing.Status is not (SubscriptionStatus.Canceled or SubscriptionStatus.Expired))
                throw new InvalidOperationException("User already has an active subscription.");

            existing.Status = SubscriptionStatus.Trialing;
            existing.TrialStartedAt = now;
            existing.TrialEndsAt = now.AddDays(trialDays);
            existing.CurrentPeriodEnd = now.AddDays(trialDays);
            existing.UpdatedAt = now;
            await context.SaveChangesAsync();
            return existing;
        }

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Plan = SubscriptionPlan.Premium,
            Status = SubscriptionStatus.Trialing,
            TrialStartedAt = now,
            TrialEndsAt = now.AddDays(trialDays),
            CurrentPeriodEnd = now.AddDays(trialDays),
            CreatedAt = now,
            UpdatedAt = now
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();

        return subscription;
    }

    public Task<Subscription?> GetSubscriptionAsync(Guid userId)
    {
        return context.Subscriptions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);
    }

    public async Task<bool> HasActivePremiumAsync(Guid userId)
    {
        Subscription? subscription = await context.Subscriptions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (subscription == null)
            return false;

        return subscription.Status is SubscriptionStatus.Trialing or SubscriptionStatus.Active;
    }

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string successUrl, string cancelUrl)
    {
        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (subscription == null)
            throw new InvalidOperationException("No subscription found for this user.");

        if (string.IsNullOrWhiteSpace(subscription.StripeCustomerId))
        {
            User user = await context.Users.FirstAsync(u => u.Id == userId);
            var customer = await stripeService.CreateCustomerAsync(user.Email, user.Name);
            subscription.StripeCustomerId = customer.Id;
            subscription.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
        }

        var session = await stripeService.CreateCheckoutSessionAsync(
            subscription.StripeCustomerId, successUrl, cancelUrl);

        return session.Url;
    }

    public async Task CancelAsync(Guid userId)
    {
        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId);

        if (subscription == null)
            throw new InvalidOperationException("No subscription found for this user.");

        if (!string.IsNullOrWhiteSpace(subscription.StripeSubscriptionId))
            await stripeService.CancelSubscriptionAsync(subscription.StripeSubscriptionId);

        subscription.Status = SubscriptionStatus.Canceled;
        subscription.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public async Task HandleWebhookEventAsync(Stripe.Event stripeEvent)
    {
        switch (stripeEvent.Type)
        {
            case "customer.subscription.updated":
                await HandleSubscriptionUpdated(stripeEvent);
                break;
            case "customer.subscription.deleted":
                await HandleSubscriptionDeleted(stripeEvent);
                break;
            case "invoice.payment_succeeded":
                await HandlePaymentSucceeded(stripeEvent);
                break;
            case "invoice.payment_failed":
                await HandlePaymentFailed(stripeEvent);
                break;
            default:
                logger.LogInformation("Unhandled Stripe event type: {EventType}", stripeEvent.Type);
                break;
        }
    }

    private async Task HandleSubscriptionUpdated(Stripe.Event stripeEvent)
    {
        var stripeSub = stripeEvent.Data.Object as Stripe.Subscription;
        if (stripeSub == null) return;

        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
        if (subscription == null) return;

        subscription.Status = MapStripeStatus(stripeSub.Status);
        subscription.CurrentPeriodEnd = stripeSub.CurrentPeriodEnd;
        subscription.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    private async Task HandleSubscriptionDeleted(Stripe.Event stripeEvent)
    {
        var stripeSub = stripeEvent.Data.Object as Stripe.Subscription;
        if (stripeSub == null) return;

        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == stripeSub.Id);
        if (subscription == null) return;

        subscription.Status = SubscriptionStatus.Canceled;
        subscription.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    private async Task HandlePaymentSucceeded(Stripe.Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Stripe.Invoice;
        if (invoice?.SubscriptionId == null) return;

        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == invoice.SubscriptionId);
        if (subscription == null) return;

        subscription.Status = SubscriptionStatus.Active;
        subscription.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    private async Task HandlePaymentFailed(Stripe.Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Stripe.Invoice;
        if (invoice?.SubscriptionId == null) return;

        Subscription? subscription = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.StripeSubscriptionId == invoice.SubscriptionId);
        if (subscription == null) return;

        subscription.Status = SubscriptionStatus.PastDue;
        subscription.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    private static SubscriptionStatus MapStripeStatus(string stripeStatus) => stripeStatus switch
    {
        "trialing" => SubscriptionStatus.Trialing,
        "active" => SubscriptionStatus.Active,
        "past_due" => SubscriptionStatus.PastDue,
        "canceled" => SubscriptionStatus.Canceled,
        "unpaid" => SubscriptionStatus.Expired,
        _ => SubscriptionStatus.Expired
    };
}
