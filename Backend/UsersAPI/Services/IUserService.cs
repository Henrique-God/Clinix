using UsersAPI.Models;
using UsersAPI.Models.DTOs;

namespace UsersAPI.Services;

public interface IUserService
{
    Task<IUser?> RegisterAsync(RegisterRequestDTO request);
    Task<IUser?> ValidateCredentialsAsync(string email, string password);
}
