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
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email e senha são obrigatórios.");

        User? user = await userService.ValidateCredentialsAsync(request.Email, request.Password);
        if (user == null)
            return Unauthorized("Credenciais inválidas.");

        string token = jwtService.GenerateToken(user);
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        return Ok(new LoginResponse
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            UserType = user.UserType
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest("Email, senha e nome são obrigatórios.");

        User? user = await userService.RegisterAsync(request);
        if (user == null)
            return BadRequest("E-mail já cadastrado.");

        string token = jwtService.GenerateToken(user);
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        return StatusCode(201, new LoginResponse
        {
            Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes),
            UserType = user.UserType
        });
    }
}
