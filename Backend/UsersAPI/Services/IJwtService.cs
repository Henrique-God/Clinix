using UsersAPI.Models;

namespace UsersAPI.Services;

public interface IJwtService
{
    string GenerateToken(IUser user);
}
