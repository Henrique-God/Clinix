namespace UsersAPI.Models.DTOs;

public class RegisterRequestDTO
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.EmailAddress]
    public string Email { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MinLength(8)]
    public string Password { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.MaxLength(256)]
    public string Name { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.MaxLength(14)]
    [System.ComponentModel.DataAnnotations.RegularExpression(
        @"^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$",
        ErrorMessage = "CPF must be 11 digits or formatted as 000.000.000-00.")]
    public string? Cpf { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(32)]
    public string? Phone { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(128)]
    public string? HealthInsurance { get; set; }
}
