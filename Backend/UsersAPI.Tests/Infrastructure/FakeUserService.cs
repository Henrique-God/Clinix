using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Tests.Infrastructure;

public class FakeUserService : IUserService
{
    public Func<RegisterRequestDTO, Task<UserRegistrationResult>> RegisterPatientAsyncHandler { get; set; } =
        request => Task.FromResult(new UserRegistrationResult());

    public Func<RegisterDoctorRequestDTO, Task<UserRegistrationResult>> RegisterDoctorAsyncHandler { get; set; } =
        request => Task.FromResult(new UserRegistrationResult());

    public Func<string, string, Task<IUser?>> ValidateCredentialsAsyncHandler { get; set; } =
        (_, _) => Task.FromResult<IUser?>(null);

    public Func<string, Task<bool>> IsEmailTakenAsyncHandler { get; set; } =
        _ => Task.FromResult(false);

    public Func<string, Task<bool>> IsProfessionalRegisterTakenAsyncHandler { get; set; } =
        _ => Task.FromResult(false);

    public void Reset()
    {
        RegisterPatientAsyncHandler = _ => Task.FromResult(new UserRegistrationResult());
        RegisterDoctorAsyncHandler = _ => Task.FromResult(new UserRegistrationResult());
        ValidateCredentialsAsyncHandler = (_, _) => Task.FromResult<IUser?>(null);
        IsEmailTakenAsyncHandler = _ => Task.FromResult(false);
        IsProfessionalRegisterTakenAsyncHandler = _ => Task.FromResult(false);
    }

    public Task<UserRegistrationResult> RegisterPatientAsync(RegisterRequestDTO request) =>
        RegisterPatientAsyncHandler(request);

    public Task<UserRegistrationResult> RegisterDoctorAsync(RegisterDoctorRequestDTO request) =>
        RegisterDoctorAsyncHandler(request);

    public Task<IUser?> ValidateCredentialsAsync(string email, string password) =>
        ValidateCredentialsAsyncHandler(email, password);

    public Task<bool> IsEmailTakenAsync(string email) =>
        IsEmailTakenAsyncHandler(email);

    public Task<bool> IsProfessionalRegisterTakenAsync(string professionalRegister) =>
        IsProfessionalRegisterTakenAsyncHandler(professionalRegister);
}
