using Clinix.Models;
using Clinix.Models.DTOs;

namespace Clinix.Services;

public class UserService : IUserService
{
    private static readonly Dictionary<string, User> Users = new();
    private static readonly object Lock = new();

    public Task<User?> RegisterAsync(RegisterRequest request)
    {
        lock (Lock)
        {
            string emailLower = request.Email.Trim().ToLowerInvariant();
            if (Users.ContainsKey(emailLower))
                return Task.FromResult<User?>(null);

            User user = new User
            {
                Id = Guid.NewGuid(),
                Email = emailLower,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Nome = request.Nome.Trim(),
                UserType = request.UserType,
                CreatedAt = DateTime.UtcNow
            };

            Users[emailLower] = user;
            return Task.FromResult<User?>(user);
        }
    }

    public Task<User?> ValidateCredentialsAsync(string email, string password)
    {
        string emailLower = email.Trim().ToLowerInvariant();

        lock (Lock)
        {
            if (!Users.TryGetValue(emailLower, out User? user))
                return Task.FromResult<User?>(null);

            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return Task.FromResult<User?>(null);

            return Task.FromResult<User?>(user);
        }
    }
}
