using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace UsersAPI.Services;

public class UserService : IUserService
{
    private readonly IUsersDbContext context;

    public UserService(IUsersDbContext context)
    {
        this.context = context;
    }

    public async Task<IUser?> RegisterAsync(RegisterRequestDTO request)
    {
        string emailLower = request.Email.Trim().ToLowerInvariant();

        bool exists = await context.Users.AnyAsync(u => u.Email == emailLower);
        if (exists)
            return null;

        User user = new User
        {
            Id = Guid.NewGuid(),
            Email = emailLower,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Name = request.Name.Trim(),
            UserType = UserType.User,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    public async Task<IUser?> ValidateCredentialsAsync(string email, string password)
    {
        string emailLower = email.Trim().ToLowerInvariant();

        User? user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == emailLower);

        if (user == null)
            return null;

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        return user;
    }
}
