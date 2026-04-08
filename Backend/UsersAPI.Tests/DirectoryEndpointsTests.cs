using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using UsersAPI.Models;
using UsersAPI.Tests.Infrastructure;
using Xunit;

namespace UsersAPI.Tests;

public class DirectoryEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory factory;

    public DirectoryEndpointsTests(CustomWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task GetUserReturnsDoctorDirectoryEntryWhenUserExists()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();

        await factory.SeedAsync(context =>
        {
            context.Users.Add(new User
            {
                Id = doctorId,
                Email = "doctor@clinix.local",
                Name = "Dra. Helena Campos",
                PasswordHash = "hashed",
                UserType = UserType.Doctor,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.DoctorProfiles.Add(new DoctorProfile
            {
                UserId = doctorId,
                ProfessionalRegister = "CRM12345",
                NormalizedProfessionalRegister = "CRM12345",
                Phone = "11999999999",
                Specialties = JsonSerializer.Serialize(new[] { "Cardiologia", "Clinica Geral" }),
                CreatedAt = DateTime.UtcNow
            });

            return Task.CompletedTask;
        });

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", Guid.NewGuid().ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");

        HttpResponseMessage response = await client.GetAsync($"/directory/users/{doctorId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        DirectoryUserResponse? body = await response.Content.ReadFromJsonAsync<DirectoryUserResponse>();
        Assert.NotNull(body);
        Assert.Equal(doctorId, body.UserId);
        Assert.Equal("Dra. Helena Campos", body.Name);
        Assert.Equal("CRM12345", body.ProfessionalRegister);
        Assert.Contains("Cardiologia", body.Specialties);
    }

    [Fact]
    public async Task GetDoctorsFiltersBySpecialtyAndSearch()
    {
        await factory.ResetDatabaseAsync();
        Guid cardiologistId = Guid.NewGuid();
        Guid dermatologistId = Guid.NewGuid();
        Guid inactiveDoctorId = Guid.NewGuid();

        await factory.SeedAsync(context =>
        {
            context.Users.AddRange(
                new User
                {
                    Id = cardiologistId,
                    Email = "cardio@clinix.local",
                    Name = "Dr. Bruno Cardoso",
                    PasswordHash = "hashed",
                    UserType = UserType.Doctor,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = dermatologistId,
                    Email = "dermato@clinix.local",
                    Name = "Dra. Marina Lopes",
                    PasswordHash = "hashed",
                    UserType = UserType.Doctor,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new User
                {
                    Id = inactiveDoctorId,
                    Email = "inactive@clinix.local",
                    Name = "Dr. Inativo",
                    PasswordHash = "hashed",
                    UserType = UserType.Doctor,
                    IsActive = false,
                    CreatedAt = DateTime.UtcNow
                });

            context.DoctorProfiles.AddRange(
                new DoctorProfile
                {
                    UserId = cardiologistId,
                    ProfessionalRegister = "CRM1000",
                    NormalizedProfessionalRegister = "CRM1000",
                    Phone = "11911111111",
                    Specialties = JsonSerializer.Serialize(new[] { "Cardiologia" }),
                    CreatedAt = DateTime.UtcNow
                },
                new DoctorProfile
                {
                    UserId = dermatologistId,
                    ProfessionalRegister = "CRM2000",
                    NormalizedProfessionalRegister = "CRM2000",
                    Phone = "11922222222",
                    Specialties = JsonSerializer.Serialize(new[] { "Dermatologia" }),
                    CreatedAt = DateTime.UtcNow
                },
                new DoctorProfile
                {
                    UserId = inactiveDoctorId,
                    ProfessionalRegister = "CRM3000",
                    NormalizedProfessionalRegister = "CRM3000",
                    Phone = "11933333333",
                    Specialties = JsonSerializer.Serialize(new[] { "Cardiologia" }),
                    CreatedAt = DateTime.UtcNow
                });

            return Task.CompletedTask;
        });

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", Guid.NewGuid().ToString());
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");

        HttpResponseMessage response = await client.GetAsync("/directory/doctors?specialty=Cardiologia&search=Bruno");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        List<DoctorDirectoryItemResponse>? body = await response.Content.ReadFromJsonAsync<List<DoctorDirectoryItemResponse>>();
        Assert.NotNull(body);
        Assert.Single(body);
        Assert.Equal(cardiologistId, body[0].UserId);
        Assert.Equal("CRM1000", body[0].ProfessionalRegister);
    }

    private sealed class DirectoryUserResponse
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ProfessionalRegister { get; set; }
        public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
    }

    private sealed class DoctorDirectoryItemResponse
    {
        public Guid UserId { get; set; }
        public string ProfessionalRegister { get; set; } = string.Empty;
    }
}
