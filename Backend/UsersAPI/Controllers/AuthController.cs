using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace UsersAPI.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService userService;
    private readonly IJwtService jwtService;
    private readonly ILogger<AuthController> logger;
    private readonly IConfiguration configuration;

    public AuthController(
        IUserService userService,
        IJwtService jwtService,
        ILogger<AuthController> logger,
        IConfiguration configuration)
    {
        this.userService = userService;
        this.jwtService = jwtService;
        this.logger = logger;
        this.configuration = configuration;
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

    [HttpPost("doctors/register")]
    public async Task<IActionResult> RegisterDoctor([FromBody] RegisterDoctorRequestDTO request)
    {
        UserRegistrationResult result = await userService.RegisterDoctorAsync(request);
        if (!result.Success)
            return BadRequest(MapRegistrationError(result.Error));

        return StatusCode(201, BuildLoginResponse(result.User!));
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDTO request)
    {
        UserRegistrationResult result = await userService.RegisterPatientAsync(request);
        if (!result.Success)
            return BadRequest(MapRegistrationError(result.Error));

        return StatusCode(201, BuildLoginResponse(result.User!));
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value;

        return Ok(new { userId, email });
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
}
