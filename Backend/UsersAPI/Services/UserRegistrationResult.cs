using UsersAPI.Models;

namespace UsersAPI.Services;

public enum UserRegistrationError
{
    None = 0,
    EmailAlreadyRegistered = 1,
    ProfessionalRegisterAlreadyRegistered = 2,
    DoctorSpecialtiesRequired = 3
}

public class UserRegistrationResult
{
    public bool Success => User is not null && Error == UserRegistrationError.None;
    public IUser? User { get; init; }
    public UserRegistrationError Error { get; init; }
}
