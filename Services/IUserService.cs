using Clinix.Models;
using Clinix.Models.DTOs;

namespace Clinix.Services;

public interface IUserService
{
    Task<User?> RegisterAsync(RegisterRequest request);
    Task<User?> ValidateCredentialsAsync(string email, string password);
}
