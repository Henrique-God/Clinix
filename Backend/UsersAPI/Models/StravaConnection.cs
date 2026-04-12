namespace UsersAPI.Models;

public class StravaConnection
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public long StravaAthleteId { get; set; }
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime TokenExpiresAt { get; set; }
    public string Scope { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime ConnectedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<StravaActivity> Activities { get; set; } = new();
}
