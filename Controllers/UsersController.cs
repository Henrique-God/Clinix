using Clinix.Models;
using Clinix.Models.DTOs;
using Clinix.Services;
using Microsoft.AspNetCore.Mvc;

namespace Clinix.Controllers;

[ApiController]
[Route("[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService userService;
    private readonly IJwtService jwtService;
    private readonly ILogger<UsersController> logger;
    private readonly IConfiguration configuration;

    public UsersController(
        IUserService userService,
        IJwtService jwtService,
        ILogger<UsersController> logger,
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
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email and password are required.");

        IUser? user = await userService.ValidateCredentialsAsync(request.Email, request.Password);
        if (user == null)
            return Unauthorized("Invalid credentials.");

        string token = jwtService.GenerateToken(user);
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        return Ok(new LoginResponseDTO
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            UserType = user.UserType
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDTO request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Email, password and name are required.");

        IUser? user = await userService.RegisterAsync(request);
        if (user == null)
            return BadRequest("Email already registered.");

        string token = jwtService.GenerateToken(user);
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        return StatusCode(201, new LoginResponseDTO
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            UserType = user.UserType
        });
    }
}
