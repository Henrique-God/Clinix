using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Controllers;

[ApiController]
[Route("subscriptions")]
public class SubscriptionController : ControllerBase
{
    private readonly ISubscriptionService subscriptionService;
    private readonly IConfiguration configuration;
    private readonly ILogger<SubscriptionController> logger;

    public SubscriptionController(
        ISubscriptionService subscriptionService,
        IConfiguration configuration,
        ILogger<SubscriptionController> logger)
    {
        this.subscriptionService = subscriptionService;
        this.configuration = configuration;
        this.logger = logger;
    }

    [Authorize(Roles = "User")]
    [HttpPost("trial")]
    public async Task<IActionResult> StartTrial()
    {
        Guid userId = GetUserId();

        try
        {
            Models.Subscription subscription = await subscriptionService.StartFreeTrialAsync(userId);
            return StatusCode(201, MapToResponse(subscription));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMySubscription()
    {
        Guid userId = GetUserId();

        Models.Subscription? subscription = await subscriptionService.GetSubscriptionAsync(userId);
        if (subscription == null)
            return Ok(new { status = "none" });

        return Ok(MapToResponse(subscription));
    }

    [Authorize]
    [HttpPost("checkout")]
    public async Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutRequestDTO request)
    {
        Guid userId = GetUserId();

        try
        {
            string sessionUrl = await subscriptionService.CreateCheckoutSessionAsync(
                userId, request.SuccessUrl, request.CancelUrl);

            return Ok(new CheckoutSessionResponseDTO { SessionUrl = sessionUrl });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [Authorize]
    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel()
    {
        Guid userId = GetUserId();

        try
        {
            await subscriptionService.CancelAsync(userId);
            return Ok(new { message = "Subscription canceled." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [AllowAnonymous]
    [HttpPost("/webhooks/stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        string json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        string webhookSecret = configuration["Stripe:WebhookSecret"] ?? string.Empty;

        try
        {
            Event stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret);

            await subscriptionService.HandleWebhookEventAsync(stripeEvent);
            return Ok();
        }
        catch (StripeException ex)
        {
            logger.LogWarning(ex, "Stripe webhook signature verification failed.");
            return BadRequest("Webhook signature verification failed.");
        }
    }

    private Guid GetUserId()
    {
        string? userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdValue, out Guid userId))
            throw new UnauthorizedAccessException();
        return userId;
    }

    private static SubscriptionResponseDTO MapToResponse(Models.Subscription subscription)
    {
        int? trialDaysRemaining = null;
        if (subscription.Status == SubscriptionStatus.Trialing && subscription.TrialEndsAt.HasValue)
        {
            trialDaysRemaining = Math.Max(0, (int)(subscription.TrialEndsAt.Value - DateTime.UtcNow).TotalDays);
        }

        return new SubscriptionResponseDTO
        {
            Id = subscription.Id,
            Plan = subscription.Plan,
            Status = subscription.Status,
            TrialStartedAt = subscription.TrialStartedAt,
            TrialEndsAt = subscription.TrialEndsAt,
            CurrentPeriodEnd = subscription.CurrentPeriodEnd,
            TrialDaysRemaining = trialDaysRemaining,
            CreatedAt = subscription.CreatedAt
        };
    }
}
