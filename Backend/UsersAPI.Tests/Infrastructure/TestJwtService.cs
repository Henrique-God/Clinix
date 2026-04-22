using UsersAPI.Models;
using UsersAPI.Services;

namespace UsersAPI.Tests.Infrastructure;

public class TestJwtService : IJwtService
{
    public string GenerateToken(IUser user) => $"test-token-{user.Id}";
}
