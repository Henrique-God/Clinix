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
    DbSet<Subscription> Subscriptions { get; }
    DbSet<WorkoutRoutine> WorkoutRoutines { get; }
    DbSet<WorkoutExercise> WorkoutExercises { get; }
    DbSet<StravaConnection> StravaConnections { get; }
    DbSet<StravaActivity> StravaActivities { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
