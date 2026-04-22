using AppointmentsAPI.Application;

namespace AppointmentsAPI.Tests.Infrastructure;

public class FakeUserDirectoryService : IUserDirectoryService
{
    private readonly Dictionary<Guid, UserDirectoryEntry> users = new();

    public Task<UserDirectoryEntry?> GetUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        users.TryGetValue(userId, out UserDirectoryEntry? user);
        return Task.FromResult(user);
    }

    public void Upsert(Guid userId, string userType, bool isActive = true, string? name = null)
    {
        users[userId] = new UserDirectoryEntry
        {
            UserId = userId,
            UserType = userType,
            IsActive = isActive,
            Name = name ?? $"{userType}-{userId:N}"
        };
    }

    public void Reset() => users.Clear();
}
