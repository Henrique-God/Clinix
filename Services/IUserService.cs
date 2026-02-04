using Clinix.Models;
using Clinix.Models.DTOs;

namespace Clinix.Services;

public interface IUserService
{
    Task<IUser?> RegisterAsync(RegisterRequestDTO request);
    Task<IUser?> ValidateCredentialsAsync(string email, string password);
}
