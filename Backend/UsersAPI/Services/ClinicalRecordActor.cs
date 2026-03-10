using UsersAPI.Models;

namespace UsersAPI.Services;

public sealed class ClinicalRecordActor
{
    public Guid UserId { get; init; }
    public UserType UserType { get; init; }
}
