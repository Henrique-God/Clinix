using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Infrastructure;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Controllers;

[ApiController]
[Route("strava")]
[Authorize(Roles = "User")]
[ServiceFilter(typeof(PremiumAuthorizationFilter))]
public class StravaController : ControllerBase
{
    private readonly IStravaService stravaService;

    public StravaController(IStravaService stravaService)
    {
        this.stravaService = stravaService;
    }

    [HttpGet("auth-url")]
    public IActionResult GetAuthUrl()
    {
        Guid userId = GetUserId();
        string url = stravaService.GetAuthorizationUrl(userId);
        return Ok(new StravaAuthUrlResponseDTO { AuthorizationUrl = url });
    }

    [HttpPost("callback")]
    public async Task<IActionResult> Callback([FromBody] StravaCallbackRequestDTO request)
    {
        Guid userId = GetUserId();

        try
        {
            StravaConnection connection = await stravaService.ExchangeCodeAsync(request.Code, userId);
            return Ok(MapConnection(connection));
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to connect Strava: {ex.Message}");
        }
    }

    [HttpGet("connection")]
    public async Task<IActionResult> GetConnection()
    {
        Guid userId = GetUserId();
        StravaConnection? connection = await stravaService.GetConnectionAsync(userId);

        if (connection == null)
            return Ok(new { connected = false });

        return Ok(new { connected = true, connection = MapConnection(connection) });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync()
    {
        Guid userId = GetUserId();

        try
        {
            int synced = await stravaService.SyncActivitiesAsync(userId);
            return Ok(new StravaSyncResponseDTO { ActivitiesSynced = synced });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("connection")]
    public async Task<IActionResult> Disconnect()
    {
        Guid userId = GetUserId();

        try
        {
            await stravaService.DisconnectAsync(userId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("activities")]
    public async Task<IActionResult> ListActivities([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        Guid userId = GetUserId();
        List<StravaActivity> activities = await stravaService.GetActivitiesAsync(userId, page, pageSize);
        return Ok(activities.Select(MapActivity));
    }

    private Guid GetUserId()
    {
        string? userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdValue, out Guid userId))
            throw new UnauthorizedAccessException();
        return userId;
    }

    private static StravaConnectionResponseDTO MapConnection(StravaConnection connection) => new()
    {
        Id = connection.Id,
        StravaAthleteId = connection.StravaAthleteId,
        IsActive = connection.IsActive,
        ConnectedAt = connection.ConnectedAt
    };

    private static StravaActivityResponseDTO MapActivity(StravaActivity activity) => new()
    {
        Id = activity.Id,
        StravaActivityId = activity.StravaActivityId,
        Name = activity.Name,
        Type = activity.Type,
        StartDate = activity.StartDate,
        DistanceMeters = activity.DistanceMeters,
        MovingTimeSeconds = activity.MovingTimeSeconds,
        ElapsedTimeSeconds = activity.ElapsedTimeSeconds,
        TotalElevationGain = activity.TotalElevationGain,
        AverageHeartRate = activity.AverageHeartRate,
        MaxHeartRate = activity.MaxHeartRate,
        Calories = activity.Calories,
        SyncedAt = activity.SyncedAt
    };
}

[ApiController]
[Route("patients/{patientId:guid}/strava")]
[Authorize(Roles = "Doctor")]
public class PatientStravaController : ControllerBase
{
    private readonly IStravaService stravaService;
    private readonly IUsersDbContext context;

    public PatientStravaController(IStravaService stravaService, IUsersDbContext context)
    {
        this.stravaService = stravaService;
        this.context = context;
    }

    [HttpGet("activities")]
    public async Task<IActionResult> ListPatientActivities(
        Guid patientId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        Guid doctorId = GetUserId();

        bool hasGrant = await context.ClinicalRecordAccessGrants
            .AnyAsync(g => g.PatientId == patientId
                        && g.DoctorId == doctorId
                        && g.Status == ClinicalRecordAccessGrantStatus.Active);

        if (!hasGrant)
            return Forbid();

        List<StravaActivity> activities = await stravaService.GetPatientActivitiesAsync(patientId, page, pageSize);
        return Ok(activities.Select(MapActivity));
    }

    private Guid GetUserId()
    {
        string? userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdValue, out Guid userId))
            throw new UnauthorizedAccessException();
        return userId;
    }

    private static StravaActivityResponseDTO MapActivity(StravaActivity activity) => new()
    {
        Id = activity.Id,
        StravaActivityId = activity.StravaActivityId,
        Name = activity.Name,
        Type = activity.Type,
        StartDate = activity.StartDate,
        DistanceMeters = activity.DistanceMeters,
        MovingTimeSeconds = activity.MovingTimeSeconds,
        ElapsedTimeSeconds = activity.ElapsedTimeSeconds,
        TotalElevationGain = activity.TotalElevationGain,
        AverageHeartRate = activity.AverageHeartRate,
        MaxHeartRate = activity.MaxHeartRate,
        Calories = activity.Calories,
        SyncedAt = activity.SyncedAt
    };
}
