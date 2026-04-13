using UsersAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace UsersAPI.Data;

public class UsersDbContext : DbContext, IUsersDbContext
{
    public UsersDbContext(DbContextOptions<UsersDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<DoctorProfile> DoctorProfiles { get; set; }
    public DbSet<PatientClinicalRecord> PatientClinicalRecords { get; set; }
    public DbSet<ClinicalRecordEntry> ClinicalRecordEntries { get; set; }
    public DbSet<ClinicalDocument> ClinicalDocuments { get; set; }
    public DbSet<ClinicalRecordAccessGrant> ClinicalRecordAccessGrants { get; set; }
    public DbSet<Subscription> Subscriptions { get; set; }
    public DbSet<WorkoutRoutine> WorkoutRoutines { get; set; }
    public DbSet<WorkoutExercise> WorkoutExercises { get; set; }
    public DbSet<StravaConnection> StravaConnections { get; set; }
    public DbSet<StravaActivity> StravaActivities { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("users");

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(256);
            entity.Property(e => e.PasswordHash).HasMaxLength(256);
        });

        modelBuilder.Entity<DoctorProfile>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.HasIndex(e => e.NormalizedProfessionalRegister).IsUnique();

            entity.Property(e => e.ProfessionalRegister).HasMaxLength(64);
            entity.Property(e => e.NormalizedProfessionalRegister).HasMaxLength(64);
            entity.Property(e => e.Specialties).HasMaxLength(2000);
            entity.Property(e => e.Phone).HasMaxLength(32);

            entity.HasOne<User>()
                .WithOne()
                .HasForeignKey<DoctorProfile>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PatientClinicalRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PatientId).IsUnique();

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.PatientId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ClinicalRecordEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.PatientId, e.CreatedAt });
            entity.HasIndex(e => e.AppointmentId);
            entity.Property(e => e.Title).HasMaxLength(256);
            entity.Property(e => e.Description).HasMaxLength(4000);

            entity.HasOne(e => e.ClinicalRecord)
                .WithMany(e => e.Entries)
                .HasForeignKey(e => e.ClinicalRecordId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ClinicalDocument>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ClinicalRecordEntryId, e.CreatedAt });
            entity.Property(e => e.FileName).HasMaxLength(256);
            entity.Property(e => e.StoredFileName).HasMaxLength(256);
            entity.Property(e => e.ContentType).HasMaxLength(128);
            entity.Property(e => e.S3Key).HasMaxLength(512);

            entity.HasOne(e => e.ClinicalRecordEntry)
                .WithMany(e => e.Documents)
                .HasForeignKey(e => e.ClinicalRecordEntryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ClinicalRecordAccessGrant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.PatientId, e.DoctorId, e.Status });
            entity.Property(e => e.Reason).HasMaxLength(512);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.PatientId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.DoctorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.StripeCustomerId).HasMaxLength(256);
            entity.Property(e => e.StripeSubscriptionId).HasMaxLength(256);

            entity.HasOne<User>()
                .WithOne()
                .HasForeignKey<Subscription>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkoutRoutine>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.Property(e => e.Name).HasMaxLength(256);
            entity.Property(e => e.Description).HasMaxLength(2000);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkoutExercise>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.WorkoutRoutineId);
            entity.Property(e => e.Name).HasMaxLength(256);
            entity.Property(e => e.Notes).HasMaxLength(1000);

            entity.HasOne<WorkoutRoutine>()
                .WithMany(e => e.Exercises)
                .HasForeignKey(e => e.WorkoutRoutineId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StravaConnection>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.AccessToken).HasMaxLength(1024);
            entity.Property(e => e.RefreshToken).HasMaxLength(1024);
            entity.Property(e => e.Scope).HasMaxLength(256);

            entity.HasOne<User>()
                .WithOne()
                .HasForeignKey<StravaConnection>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StravaActivity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.StravaConnectionId);
            entity.HasIndex(e => e.StravaActivityId).IsUnique();
            entity.Property(e => e.Name).HasMaxLength(512);
            entity.Property(e => e.Type).HasMaxLength(64);

            entity.HasOne<StravaConnection>()
                .WithMany(e => e.Activities)
                .HasForeignKey(e => e.StravaConnectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
