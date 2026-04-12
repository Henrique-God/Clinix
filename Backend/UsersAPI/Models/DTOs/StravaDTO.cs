namespace UsersAPI.Models.DTOs;

public class StravaAuthUrlResponseDTO
{
    public string AuthorizationUrl { get; set; } = string.Empty;
}

public class StravaCallbackRequestDTO
{
    public string Code { get; set; } = string.Empty;
}

public class StravaConnectionResponseDTO
{
    public Guid Id { get; set; }
    public long StravaAthleteId { get; set; }
    public bool IsActive { get; set; }
    public DateTime ConnectedAt { get; set; }
}

public class StravaActivityResponseDTO
{
    public Guid Id { get; set; }
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

public class StravaSyncResponseDTO
{
    public int ActivitiesSynced { get; set; }
}
