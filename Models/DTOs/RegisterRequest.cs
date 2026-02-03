using Clinix.Models;

namespace Clinix.Models.DTOs;

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public UserType UserType { get; set; }
}
