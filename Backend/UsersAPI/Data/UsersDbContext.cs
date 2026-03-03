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

        modelBuilder.Entity<ClinicalRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Description).HasMaxLength(4000);
        });
    }
}
