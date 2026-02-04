namespace Clinix.Models;

public interface IUser
{
    Guid Id { get; }
    string Email { get; }
    string PasswordHash { get; }
    string Name { get; }
    UserType UserType { get; }
    DateTime CreatedAt { get; }
}
