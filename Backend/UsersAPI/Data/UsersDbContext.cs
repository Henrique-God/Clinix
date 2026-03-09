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
    public DbSet<ClinicalRecord> ClinicalRecords { get; set; }

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

        modelBuilder.Entity<ClinicalRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Description).HasMaxLength(4000);
        });
    }
}
