using UsersAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace UsersAPI.Data;

public interface IUsersDbContext
{
    DbSet<User> Users { get; }
    DbSet<DoctorProfile> DoctorProfiles { get; }
    DbSet<PatientClinicalRecord> PatientClinicalRecords { get; }
    DbSet<ClinicalRecordEntry> ClinicalRecordEntries { get; }
    DbSet<ClinicalDocument> ClinicalDocuments { get; }
    DbSet<ClinicalRecordAccessGrant> ClinicalRecordAccessGrants { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
