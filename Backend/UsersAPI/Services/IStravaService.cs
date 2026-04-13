using UsersAPI.Models;

namespace UsersAPI.Services;

public interface IStravaService
{
    string GetAuthorizationUrl(Guid userId);
    Task<StravaConnection> ExchangeCodeAsync(string code, Guid userId);
    Task<StravaConnection?> GetConnectionAsync(Guid userId);
    Task<int> SyncActivitiesAsync(Guid userId, DateTime? after = null);
    Task DisconnectAsync(Guid userId);
    Task<List<StravaActivity>> GetActivitiesAsync(Guid userId, int page = 1, int pageSize = 20);
    Task<List<StravaActivity>> GetPatientActivitiesAsync(Guid patientId, int page = 1, int pageSize = 20);
}
