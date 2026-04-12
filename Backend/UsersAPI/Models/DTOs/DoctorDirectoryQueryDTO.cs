using System.ComponentModel.DataAnnotations;

namespace UsersAPI.Models.DTOs;

public class DoctorDirectoryQueryDTO
{
    [MaxLength(128)]
    public string? Search { get; set; }

    [MaxLength(128)]
    public string? Specialty { get; set; }

    [Range(1, 100)]
    public int Limit { get; set; } = 25;
}
