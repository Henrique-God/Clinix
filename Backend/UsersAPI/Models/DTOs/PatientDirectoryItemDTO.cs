namespace UsersAPI.Models.DTOs;

public class PatientDirectoryItemDTO
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
