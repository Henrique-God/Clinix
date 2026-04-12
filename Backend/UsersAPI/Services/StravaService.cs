using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;

namespace UsersAPI.Services;

public class StravaService : IStravaService
{
    private readonly IUsersDbContext context;
    private readonly HttpClient httpClient;
    private readonly IConfiguration configuration;
    private readonly ILogger<StravaService> logger;

    public StravaService(
        IUsersDbContext context,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<StravaService> logger)
    {
        this.context = context;
        this.httpClient = httpClient;
        this.configuration = configuration;
        this.logger = logger;
    }

    public string GetAuthorizationUrl(Guid userId)
    {
        string clientId = configuration["Strava:ClientId"]
            ?? throw new InvalidOperationException("Strava:ClientId is not configured.");
        string redirectUri = configuration["Strava:RedirectUri"]
            ?? throw new InvalidOperationException("Strava:RedirectUri is not configured.");

        return $"https://www.strava.com/oauth/authorize" +
               $"?client_id={clientId}" +
               $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
               $"&response_type=code" +
               $"&scope=read,activity:read_all" +
               $"&state={userId}";
    }

    public async Task<StravaConnection> ExchangeCodeAsync(string code, Guid userId)
    {
        string clientId = configuration["Strava:ClientId"]!;
        string clientSecret = configuration["Strava:ClientSecret"]!;

        var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code"
        });

        HttpResponseMessage response = await httpClient.PostAsync(
            "https://www.strava.com/oauth/token", tokenRequest);
        response.EnsureSuccessStatusCode();

        string json = await response.Content.ReadAsStringAsync();
        StravaTokenResponse tokenResponse = JsonSerializer.Deserialize<StravaTokenResponse>(json)!;

        StravaConnection? existing = await context.StravaConnections
            .FirstOrDefaultAsync(c => c.UserId == userId);

        DateTime now = DateTime.UtcNow;

        if (existing != null)
        {
            existing.StravaAthleteId = tokenResponse.Athlete.Id;
            existing.AccessToken = tokenResponse.AccessToken;
            existing.RefreshToken = tokenResponse.RefreshToken;
            existing.TokenExpiresAt = DateTimeOffset.FromUnixTimeSeconds(tokenResponse.ExpiresAt).UtcDateTime;
            existing.Scope = "read,activity:read_all";
            existing.IsActive = true;
            existing.UpdatedAt = now;
            await context.SaveChangesAsync();
            return existing;
        }

        var connection = new StravaConnection
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            StravaAthleteId = tokenResponse.Athlete.Id,
            AccessToken = tokenResponse.AccessToken,
            RefreshToken = tokenResponse.RefreshToken,
            TokenExpiresAt = DateTimeOffset.FromUnixTimeSeconds(tokenResponse.ExpiresAt).UtcDateTime,
            Scope = "read,activity:read_all",
            IsActive = true,
            ConnectedAt = now,
            UpdatedAt = now
        };

        context.StravaConnections.Add(connection);
        await context.SaveChangesAsync();
        return connection;
    }

    public Task<StravaConnection?> GetConnectionAsync(Guid userId)
    {
        return context.StravaConnections
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId && c.IsActive);
    }

    public async Task<int> SyncActivitiesAsync(Guid userId, DateTime? after = null)
    {
        StravaConnection? connection = await context.StravaConnections
            .FirstOrDefaultAsync(c => c.UserId == userId && c.IsActive);

        if (connection == null)
            throw new InvalidOperationException("No active Strava connection.");

        await RefreshTokenIfNeeded(connection);

        long afterEpoch = after.HasValue
            ? new DateTimeOffset(after.Value).ToUnixTimeSeconds()
            : new DateTimeOffset(DateTime.UtcNow.AddMonths(-3)).ToUnixTimeSeconds();

        httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", connection.AccessToken);

        int page = 1;
        List<StravaApiActivity> allActivities = new();

        while (true)
        {
            HttpResponseMessage response = await httpClient.GetAsync(
                $"https://www.strava.com/api/v3/athlete/activities?after={afterEpoch}&per_page=100&page={page}");
            response.EnsureSuccessStatusCode();

            string json = await response.Content.ReadAsStringAsync();
            List<StravaApiActivity>? batch = JsonSerializer.Deserialize<List<StravaApiActivity>>(json);

            if (batch == null || batch.Count == 0)
                break;

            allActivities.AddRange(batch);

            if (batch.Count < 100)
                break;

            page++;
        }

        if (allActivities.Count == 0)
            return 0;

        HashSet<long> existingIds = (await context.StravaActivities
            .Where(a => a.StravaConnectionId == connection.Id)
            .Select(a => a.StravaActivityId)
            .ToListAsync())
            .ToHashSet();

        int synced = 0;
        DateTime now = DateTime.UtcNow;

        foreach (StravaApiActivity activity in allActivities)
        {
            if (existingIds.Contains(activity.Id))
                continue;

            context.StravaActivities.Add(new StravaActivity
            {
                Id = Guid.NewGuid(),
                StravaConnectionId = connection.Id,
                StravaActivityId = activity.Id,
                Name = activity.Name ?? "Untitled",
                Type = activity.Type ?? "Unknown",
                StartDate = activity.StartDate,
                DistanceMeters = activity.Distance,
                MovingTimeSeconds = activity.MovingTime,
                ElapsedTimeSeconds = activity.ElapsedTime,
                TotalElevationGain = activity.TotalElevationGain,
                AverageHeartRate = activity.AverageHeartRate,
                MaxHeartRate = activity.MaxHeartRate,
                Calories = activity.Calories,
                SyncedAt = now
            });
            synced++;
        }

        if (synced > 0)
            await context.SaveChangesAsync();

        return synced;
    }

    public async Task DisconnectAsync(Guid userId)
    {
        StravaConnection? connection = await context.StravaConnections
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (connection == null)
            throw new InvalidOperationException("No Strava connection found.");

        try
        {
            var deauthRequest = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["access_token"] = connection.AccessToken
            });
            await httpClient.PostAsync("https://www.strava.com/oauth/deauthorize", deauthRequest);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to deauthorize Strava token for user {UserId}.", userId);
        }

        connection.IsActive = false;
        connection.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
    }

    public Task<List<StravaActivity>> GetActivitiesAsync(Guid userId, int page = 1, int pageSize = 20)
    {
        return context.StravaActivities
            .AsNoTracking()
            .Where(a => a.StravaConnectionId ==
                context.StravaConnections
                    .Where(c => c.UserId == userId && c.IsActive)
                    .Select(c => c.Id)
                    .FirstOrDefault())
            .OrderByDescending(a => a.StartDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<List<StravaActivity>> GetPatientActivitiesAsync(Guid patientId, int page = 1, int pageSize = 20)
    {
        return GetActivitiesAsync(patientId, page, pageSize);
    }

    private async Task RefreshTokenIfNeeded(StravaConnection connection)
    {
        if (connection.TokenExpiresAt > DateTime.UtcNow.AddMinutes(5))
            return;

        string clientId = configuration["Strava:ClientId"]!;
        string clientSecret = configuration["Strava:ClientSecret"]!;

        var refreshRequest = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["refresh_token"] = connection.RefreshToken,
            ["grant_type"] = "refresh_token"
        });

        HttpResponseMessage response = await httpClient.PostAsync(
            "https://www.strava.com/oauth/token", refreshRequest);
        response.EnsureSuccessStatusCode();

        string json = await response.Content.ReadAsStringAsync();
        StravaRefreshResponse refreshResponse = JsonSerializer.Deserialize<StravaRefreshResponse>(json)!;

        connection.AccessToken = refreshResponse.AccessToken;
        connection.RefreshToken = refreshResponse.RefreshToken;
        connection.TokenExpiresAt = DateTimeOffset.FromUnixTimeSeconds(refreshResponse.ExpiresAt).UtcDateTime;
        connection.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
    }

    private class StravaTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("refresh_token")]
        public string RefreshToken { get; set; } = string.Empty;

        [JsonPropertyName("expires_at")]
        public long ExpiresAt { get; set; }

        [JsonPropertyName("athlete")]
        public StravaAthlete Athlete { get; set; } = new();
    }

    private class StravaAthlete
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }
    }

    private class StravaRefreshResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonPropertyName("refresh_token")]
        public string RefreshToken { get; set; } = string.Empty;

        [JsonPropertyName("expires_at")]
        public long ExpiresAt { get; set; }
    }

    private class StravaApiActivity
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("start_date")]
        public DateTime StartDate { get; set; }

        [JsonPropertyName("distance")]
        public double Distance { get; set; }

        [JsonPropertyName("moving_time")]
        public int MovingTime { get; set; }

        [JsonPropertyName("elapsed_time")]
        public int ElapsedTime { get; set; }

        [JsonPropertyName("total_elevation_gain")]
        public double TotalElevationGain { get; set; }

        [JsonPropertyName("average_heartrate")]
        public double? AverageHeartRate { get; set; }

        [JsonPropertyName("max_heartrate")]
        public double? MaxHeartRate { get; set; }

        [JsonPropertyName("calories")]
        public double? Calories { get; set; }
    }
}
