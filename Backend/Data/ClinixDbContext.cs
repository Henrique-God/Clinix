using Clinix.Models;
using Microsoft.EntityFrameworkCore;

namespace Clinix.Data;

public class ClinixDbContext : DbContext, IClinixDbContext
{
    public ClinixDbContext(DbContextOptions<ClinixDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.Name).HasMaxLength(256);
            entity.Property(e => e.PasswordHash).HasMaxLength(256);
        });
    }
}
