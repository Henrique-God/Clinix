using Clinix.Models;

namespace Clinix.Services;

public interface IJwtService
{
    string GenerateToken(User user);
}
