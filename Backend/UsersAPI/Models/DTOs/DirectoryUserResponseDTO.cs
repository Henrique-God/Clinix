using UsersAPI.Models;

namespace UsersAPI.Models.DTOs;

public class DirectoryUserResponseDTO
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public UserType UserType { get; set; }
    public bool IsActive { get; set; }
    public string? ProfessionalRegister { get; set; }
    public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
}
