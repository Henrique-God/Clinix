using UsersAPI.Models;
using UsersAPI.Models.DTOs;

namespace UsersAPI.Services;

public interface IUserService
{
    Task<UserRegistrationResult> RegisterPatientAsync(RegisterRequestDTO request);
    Task<UserRegistrationResult> RegisterDoctorAsync(RegisterDoctorRequestDTO request);
    Task<IUser?> ValidateCredentialsAsync(string email, string password);
    Task<bool> IsEmailTakenAsync(string email);
    Task<bool> IsProfessionalRegisterTakenAsync(string professionalRegister);
}
