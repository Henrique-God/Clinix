namespace AppointmentsAPI.Models;

public enum AppointmentStatus
{
    Scheduled,
    Confirmed,
    Cancelled,
    Completed
}

public class Appointment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public DateTime CreatedAt { get; set; }
}
