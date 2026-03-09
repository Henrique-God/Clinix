using UsersAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace UsersAPI.Data;

public interface IUsersDbContext
{
    DbSet<User> Users { get; }
    DbSet<DoctorProfile> DoctorProfiles { get; }
    DbSet<ClinicalRecord> ClinicalRecords { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
