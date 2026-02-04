using Clinix.Models;

namespace Clinix.Services;

public interface IJwtService
{
    string GenerateToken(IUser user);
}
