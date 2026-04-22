namespace UsersAPI.Models.DTOs;

public class SubscriptionResponseDTO
{
    public Guid Id { get; set; }
    public SubscriptionPlan Plan { get; set; }
    public SubscriptionStatus Status { get; set; }
    public DateTime? TrialStartedAt { get; set; }
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public int? TrialDaysRemaining { get; set; }
    public DateTime CreatedAt { get; set; }
}
