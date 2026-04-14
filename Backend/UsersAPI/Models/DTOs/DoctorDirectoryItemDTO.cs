namespace UsersAPI.Models.DTOs;

public class DoctorDirectoryItemDTO
{
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ProfessionalRegister { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
    public int? ConsultationPriceCents { get; set; }
    public IReadOnlyCollection<string> AcceptedInsurancePlans { get; set; } = Array.Empty<string>();
}
