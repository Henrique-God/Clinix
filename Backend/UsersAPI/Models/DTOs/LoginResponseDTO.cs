namespace UsersAPI.Models.DTOs;

public class LoginResponseDTO
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public Models.UserType UserType { get; set; }
}
