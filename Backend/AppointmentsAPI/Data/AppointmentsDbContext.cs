using AppointmentsAPI.Domain;
using Microsoft.EntityFrameworkCore;

namespace AppointmentsAPI.Data;

public class AppointmentsDbContext : DbContext
{
    public AppointmentsDbContext(DbContextOptions<AppointmentsDbContext> options)
        : base(options)
    {
    }

    public DbSet<Appointment> Appointments => Set<Appointment>();

    public DbSet<DoctorAvailability> DoctorAvailabilities => Set<DoctorAvailability>();

    public DbSet<AgendaEvent> AgendaEvents => Set<AgendaEvent>();

    public DbSet<AppointmentStatusHistory> AppointmentStatusHistory => Set<AppointmentStatusHistory>();

    public DbSet<AppointmentInvitationMetadata> AppointmentInvitationMetadata => Set<AppointmentInvitationMetadata>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("appointments");

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.ToTable("appointments");
            entity.HasKey(item => item.Id);

            entity.Property(item => item.Status).HasConversion<int>();
            entity.Property(item => item.Title).HasMaxLength(200);
            entity.Property(item => item.Description).HasMaxLength(2000);
            entity.Property(item => item.Location).HasMaxLength(200);

            entity.HasIndex(item => new { item.DoctorId, item.StartTime });
            entity.HasIndex(item => new { item.PatientId, item.StartTime });
            entity.HasIndex(item => new { item.DoctorId, item.Status, item.StartTime });

            entity.HasOne(item => item.InvitationMetadata)
                .WithOne(item => item.Appointment)
                .HasForeignKey<AppointmentInvitationMetadata>(item => item.AppointmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(item => item.StatusHistory)
                .WithOne(item => item.Appointment)
                .HasForeignKey(item => item.AppointmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(item => item.AgendaEvent)
                .WithOne(item => item.Appointment)
                .HasForeignKey<AgendaEvent>(item => item.AppointmentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppointmentInvitationMetadata>(entity =>
        {
            entity.ToTable("appointment_invitation_metadata");
            entity.HasKey(item => item.AppointmentId);
            entity.Property(item => item.InvitedByRole).HasConversion<int>();
            entity.Property(item => item.InvitationMessage).HasMaxLength(1000);
            entity.Property(item => item.ResponseNote).HasMaxLength(1000);
        });

        modelBuilder.Entity<AppointmentStatusHistory>(entity =>
        {
            entity.ToTable("appointment_status_history");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.FromStatus).HasConversion<int?>();
            entity.Property(item => item.ToStatus).HasConversion<int>();
            entity.Property(item => item.Reason).HasMaxLength(1000);
            entity.HasIndex(item => new { item.AppointmentId, item.ChangedAt });
        });

        modelBuilder.Entity<DoctorAvailability>(entity =>
        {
            entity.ToTable("doctor_availability");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Visibility).HasConversion<int>();
            entity.Property(item => item.InsurancePlans).HasMaxLength(2000);
            entity.HasIndex(item => new { item.DoctorId, item.StartTime, item.EndTime });
        });

        modelBuilder.Entity<AgendaEvent>(entity =>
        {
            entity.ToTable("agenda_events");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Type).HasConversion<int>();
            entity.Property(item => item.Title).HasMaxLength(200);
            entity.Property(item => item.Description).HasMaxLength(2000);
            entity.HasIndex(item => new { item.DoctorId, item.StartTime, item.EndTime });
            entity.HasIndex(item => item.AppointmentId).IsUnique();
        });
    }
}
