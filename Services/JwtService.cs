using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Clinix.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Clinix.Services;

public class JwtService : IJwtService
{
    private readonly IConfiguration configuration;

    public JwtService(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    public string GenerateToken(IUser user)
    {
        string key = configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is not configured.");
        string issuer = configuration["Jwt:Issuer"] ?? "Clinix";
        string audience = configuration["Jwt:Audience"] ?? "Clinix";
        int expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");

        SymmetricSecurityKey securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        SigningCredentials credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha512Signature);

        Claim[] claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.UserType.ToString())
        };

        JwtSecurityToken token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
