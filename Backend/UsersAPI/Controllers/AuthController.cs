using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using Npgsql;
using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService userService;
    private readonly IJwtService jwtService;
    private readonly ILogger<AuthController> logger;
    private readonly IConfiguration configuration;
    private readonly IUsersDbContext context;

    public AuthController(
        IUserService userService,
        IJwtService jwtService,
        ILogger<AuthController> logger,
        IConfiguration configuration,
        IUsersDbContext context)
    {
        this.userService = userService;
        this.jwtService = jwtService;
        this.logger = logger;
        this.configuration = configuration;
        this.context = context;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDTO request)
    {
        IUser? user = await userService.ValidateCredentialsAsync(request.Email, request.Password);
        if (user == null)
            return Unauthorized("Invalid credentials.");

        return Ok(BuildLoginResponse(user));
    }

    [HttpPost("patients/register")]
    public async Task<IActionResult> RegisterPatient([FromBody] RegisterRequestDTO request)
    {
        UserRegistrationResult result = await userService.RegisterPatientAsync(request);
        if (!result.Success)
            return BadRequest(MapRegistrationError(result.Error));

        return StatusCode(201, BuildLoginResponse(result.User!));
    }

    [HttpPost("register")]
    public Task<IActionResult> RegisterLegacy([FromBody] RegisterRequestDTO request)
    {
        return RegisterPatient(request);
    }

    [HttpPost("doctors/register")]
    public async Task<IActionResult> RegisterDoctor([FromBody] RegisterDoctorRequestDTO request)
    {
        UserRegistrationResult result = await userService.RegisterDoctorAsync(request);
        if (!result.Success)
            return BadRequest(MapRegistrationError(result.Error));

        return StatusCode(201, BuildLoginResponse(result.User!));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        string? userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        string? email = User.FindFirst(ClaimTypes.Email)?.Value;
        CurrentUserProfileResponseDTO response = new CurrentUserProfileResponseDTO
        {
            UserId = userId ?? string.Empty,
            Email = email ?? string.Empty
        };

        if (!Guid.TryParse(userId, out Guid parsedUserId))
            return Ok(response);

        User? user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == parsedUserId, cancellationToken);

        if (user is null)
            return Ok(response);

        response.Name = user.Name;
        response.UserType = user.UserType;
        response.IsActive = user.IsActive;
        response.Cpf = user.Cpf;
        response.Phone = user.Phone ?? response.Phone;
        response.DateOfBirth = user.DateOfBirth;
        response.HealthInsurance = user.HealthInsurance;

        if (user.UserType != UserType.Doctor)
            return Ok(response);

        DoctorProfile? doctorProfile = await context.DoctorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == parsedUserId, cancellationToken);

        if (doctorProfile is null)
            return Ok(response);

        response.ProfessionalRegister = doctorProfile.ProfessionalRegister;
        response.Phone = doctorProfile.Phone;
        response.Specialties = DeserializeSpecialties(doctorProfile.Specialties);
        response.ConsultationPriceCents = doctorProfile.ConsultationPriceCents;
        response.AcceptedInsurancePlans = DeserializeSpecialties(doctorProfile.AcceptedInsurancePlans ?? "");

        return Ok(response);
    }

    [Authorize(Roles = "Doctor")]
    [HttpPut("me/doctor-profile")]
    public async Task<IActionResult> UpdateDoctorProfile(
        [FromBody] UpdateDoctorProfileRequestDTO request,
        CancellationToken cancellationToken)
    {
        string? userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdValue, out Guid doctorId))
            return Unauthorized();

        User? user = await context.Users.FirstOrDefaultAsync(item => item.Id == doctorId, cancellationToken);
        if (user is null || user.UserType != UserType.Doctor)
            return NotFound("Doctor profile not found.");

        DoctorProfile? doctorProfile = await context.DoctorProfiles
            .FirstOrDefaultAsync(item => item.UserId == doctorId, cancellationToken);

        if (doctorProfile is null)
            return NotFound("Doctor profile not found.");

        List<string> normalizedSpecialties = request.Specialties
            .Select(item => item.Trim())
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedSpecialties.Count == 0)
            return BadRequest("At least one valid specialty is required.");

        user.Name = request.Name.Trim();
        doctorProfile.ProfessionalRegister = request.ProfessionalRegister.Trim();
        doctorProfile.NormalizedProfessionalRegister = request.ProfessionalRegister.Trim().ToUpperInvariant();
        doctorProfile.Specialties = JsonSerializer.Serialize(normalizedSpecialties);
        doctorProfile.Phone = request.Phone.Trim();
        doctorProfile.ConsultationPriceCents = request.ConsultationPriceCents;

        if (request.AcceptedInsurancePlans is not null)
        {
            List<string> normalizedPlans = request.AcceptedInsurancePlans
                .Select(item => item.Trim())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            doctorProfile.AcceptedInsurancePlans = normalizedPlans.Count > 0
                ? JsonSerializer.Serialize(normalizedPlans)
                : null;
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex, "IX_DoctorProfiles_NormalizedProfessionalRegister"))
        {
            return BadRequest("Professional register already registered.");
        }

        CurrentUserProfileResponseDTO response = new CurrentUserProfileResponseDTO
        {
            UserId = user.Id.ToString(),
            Email = user.Email,
            Name = user.Name,
            UserType = user.UserType,
            IsActive = user.IsActive,
            ProfessionalRegister = doctorProfile.ProfessionalRegister,
            Phone = doctorProfile.Phone,
            Specialties = normalizedSpecialties,
            ConsultationPriceCents = doctorProfile.ConsultationPriceCents,
            AcceptedInsurancePlans = DeserializeSpecialties(doctorProfile.AcceptedInsurancePlans ?? "")
        };

        return Ok(response);
    }

    private LoginResponseDTO BuildLoginResponse(IUser user)
    {
        string token = jwtService.GenerateToken(user);
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        return new LoginResponseDTO
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            UserType = user.UserType
        };
    }

    private static string MapRegistrationError(UserRegistrationError error) => error switch
    {
        UserRegistrationError.EmailAlreadyRegistered => "Email already registered.",
        UserRegistrationError.ProfessionalRegisterAlreadyRegistered => "Professional register already registered.",
        UserRegistrationError.DoctorSpecialtiesRequired => "At least one valid specialty is required.",
        _ => "Could not complete registration."
    };

    private static IReadOnlyCollection<string> DeserializeSpecialties(string serializedSpecialties)
    {
        if (string.IsNullOrWhiteSpace(serializedSpecialties))
            return Array.Empty<string>();

        return JsonSerializer.Deserialize<List<string>>(serializedSpecialties) ?? new List<string>();
    }

    private static bool IsUniqueViolation(DbUpdateException exception, string indexName)
    {
        if (exception.InnerException is not PostgresException postgresException)
            return false;

        return postgresException.SqlState == PostgresErrorCodes.UniqueViolation
            && string.Equals(postgresException.ConstraintName, indexName, StringComparison.Ordinal);
    }
}
