namespace UsersAPI.Models;

public class DoctorProfile
{
    public Guid UserId { get; set; }
    public string ProfessionalRegister { get; set; } = string.Empty;
    public string NormalizedProfessionalRegister { get; set; } = string.Empty;
    public string Specialties { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int? ConsultationPriceCents { get; set; }
    public string? AcceptedInsurancePlans { get; set; }
}
