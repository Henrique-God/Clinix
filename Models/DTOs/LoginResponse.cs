using Clinix.Models;

namespace Clinix.Models.DTOs;

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserType UserType { get; set; }
}
