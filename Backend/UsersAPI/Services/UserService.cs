using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Text.Json;

namespace UsersAPI.Services;

public class UserService : IUserService
{
    private readonly IUsersDbContext context;

    public UserService(IUsersDbContext context)
    {
        this.context = context;
    }

    public async Task<UserRegistrationResult> RegisterPatientAsync(RegisterRequestDTO request)
    {
        string normalizedEmail = NormalizeEmail(request.Email);
        if (await IsEmailTakenAsync(normalizedEmail))
            return new UserRegistrationResult { Error = UserRegistrationError.EmailAlreadyRegistered };

        User user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Name = request.Name.Trim(),
            UserType = UserType.User,
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        try
        {
            await context.SaveChangesAsync();
            return new UserRegistrationResult { User = user };
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IX_Users_Email"))
        {
            return new UserRegistrationResult { Error = UserRegistrationError.EmailAlreadyRegistered };
        }
    }

    public async Task<UserRegistrationResult> RegisterDoctorAsync(RegisterDoctorRequestDTO request)
    {
        string normalizedEmail = NormalizeEmail(request.Email);
        string normalizedProfessionalRegister = NormalizeProfessionalRegister(request.ProfessionalRegister);

        if (await IsEmailTakenAsync(normalizedEmail))
            return new UserRegistrationResult { Error = UserRegistrationError.EmailAlreadyRegistered };

        if (await IsProfessionalRegisterTakenAsync(normalizedProfessionalRegister))
            return new UserRegistrationResult { Error = UserRegistrationError.ProfessionalRegisterAlreadyRegistered };

        List<string> normalizedSpecialties = request.Specialties
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedSpecialties.Count == 0)
            return new UserRegistrationResult { Error = UserRegistrationError.DoctorSpecialtiesRequired };

        User user = new User
        {
            Id = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Name = request.Name.Trim(),
            UserType = UserType.Doctor,
            CreatedAt = DateTime.UtcNow
        };

        DoctorProfile doctorProfile = new DoctorProfile
        {
            UserId = user.Id,
            ProfessionalRegister = request.ProfessionalRegister.Trim(),
            NormalizedProfessionalRegister = normalizedProfessionalRegister,
            Specialties = JsonSerializer.Serialize(normalizedSpecialties),
            Phone = request.Phone.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        context.Users.Add(user);
        context.DoctorProfiles.Add(doctorProfile);

        try
        {
            await context.SaveChangesAsync();
            return new UserRegistrationResult { User = user };
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IX_Users_Email"))
        {
            return new UserRegistrationResult { Error = UserRegistrationError.EmailAlreadyRegistered };
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IX_DoctorProfiles_NormalizedProfessionalRegister"))
        {
            return new UserRegistrationResult { Error = UserRegistrationError.ProfessionalRegisterAlreadyRegistered };
        }
    }

    public async Task<IUser?> ValidateCredentialsAsync(string email, string password)
    {
        string normalizedEmail = NormalizeEmail(email);

        User? user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null)
            return null;

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        return user;
    }

    public Task<bool> IsEmailTakenAsync(string email)
    {
        string normalizedEmail = NormalizeEmail(email);
        return context.Users.AnyAsync(u => u.Email == normalizedEmail);
    }

    public Task<bool> IsProfessionalRegisterTakenAsync(string professionalRegister)
    {
        string normalizedProfessionalRegister = NormalizeProfessionalRegister(professionalRegister);
        return context.DoctorProfiles.AnyAsync(d => d.NormalizedProfessionalRegister == normalizedProfessionalRegister);
    }

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

    private static string NormalizeProfessionalRegister(string professionalRegister)
        => professionalRegister.Trim().ToUpperInvariant();

    private static bool IsUniqueViolation(DbUpdateException exception, string indexName)
    {
        if (exception.InnerException is not PostgresException postgresException)
            return false;

        return postgresException.SqlState == PostgresErrorCodes.UniqueViolation
            && string.Equals(postgresException.ConstraintName, indexName, StringComparison.Ordinal);
    }
}
