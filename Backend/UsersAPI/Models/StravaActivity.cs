namespace UsersAPI.Models;

public class StravaActivity
{
    public Guid Id { get; set; }
    public Guid StravaConnectionId { get; set; }
    public long StravaActivityId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public double DistanceMeters { get; set; }
    public int MovingTimeSeconds { get; set; }
    public int ElapsedTimeSeconds { get; set; }
    public double TotalElevationGain { get; set; }
    public double? AverageHeartRate { get; set; }
    public double? MaxHeartRate { get; set; }
    public double? Calories { get; set; }
    public DateTime SyncedAt { get; set; }
}
