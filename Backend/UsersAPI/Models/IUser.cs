namespace UsersAPI.Models;

public interface IUser
{
    Guid Id { get; }
    string Email { get; }
    string PasswordHash { get; }
    string Name { get; }
    UserType UserType { get; }
    bool IsActive { get; }
    DateTime CreatedAt { get; }
}
