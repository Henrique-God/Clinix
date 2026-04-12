using System.ComponentModel.DataAnnotations;

namespace UsersAPI.Models.DTOs;

public class UpdateDoctorProfileRequestDTO
{
    [Required]
    [MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(64)]
    public string ProfessionalRegister { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    public List<string> Specialties { get; set; } = [];

    [Required]
    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;
}
