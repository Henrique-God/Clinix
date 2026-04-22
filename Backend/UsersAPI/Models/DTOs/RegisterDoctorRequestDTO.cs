using System.ComponentModel.DataAnnotations;

namespace UsersAPI.Models.DTOs;

public class RegisterDoctorRequestDTO
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
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(32)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;

    public int? ConsultationPriceCents { get; set; }

    public List<string>? AcceptedInsurancePlans { get; set; }
}
