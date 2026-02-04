namespace Clinix.Models;

public class User : IUser
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public UserType UserType { get; set; }
    public DateTime CreatedAt { get; set; }
}
