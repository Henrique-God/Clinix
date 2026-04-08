using UsersAPI.Models;

namespace UsersAPI.Models.DTOs;

public class CurrentUserProfileResponseDTO
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Name { get; set; }
    public UserType? UserType { get; set; }
    public bool? IsActive { get; set; }
    public string? ProfessionalRegister { get; set; }
    public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
}
