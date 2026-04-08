using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
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

        if (user.UserType != UserType.Doctor)
            return Ok(response);

        DoctorProfile? doctorProfile = await context.DoctorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == parsedUserId, cancellationToken);

        if (doctorProfile is null)
            return Ok(response);

        response.ProfessionalRegister = doctorProfile.ProfessionalRegister;
        response.Specialties = DeserializeSpecialties(doctorProfile.Specialties);

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
}
