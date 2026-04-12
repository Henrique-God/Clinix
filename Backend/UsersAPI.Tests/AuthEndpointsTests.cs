using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;
using UsersAPI.Tests.Infrastructure;
using Xunit;

namespace UsersAPI.Tests;

public class AuthEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory factory;

    public AuthEndpointsTests(CustomWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task LoginReturnsOkWhenCredentialsAreValid()
    {
        await factory.ResetDatabaseAsync();
        User user = new User
        {
            Id = Guid.NewGuid(),
            Email = "patient@clinix.local",
            Name = "Patient One",
            PasswordHash = "hashed",
            UserType = UserType.User,
            CreatedAt = DateTime.UtcNow
        };

        factory.FakeUserService.ValidateCredentialsAsyncHandler = (email, password) =>
            Task.FromResult<IUser?>(email == "patient@clinix.local" && password == "Password123"
                ? user
                : null);

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", new LoginRequestDTO
        {
            Email = "patient@clinix.local",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        LoginResponseDTO? body = await response.Content.ReadFromJsonAsync<LoginResponseDTO>(TestJson.SerializerOptions);
        Assert.NotNull(body);
        Assert.Equal($"test-token-{user.Id}", body.Token);
        Assert.Equal(UserType.User, body.UserType);
    }

    [Fact]
    public async Task LoginReturnsUnauthorizedWhenCredentialsAreInvalid()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.ValidateCredentialsAsyncHandler = (_, _) => Task.FromResult<IUser?>(null);

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", new LoginRequestDTO
        {
            Email = "missing@clinix.local",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LoginReturnsBadRequestWhenEmailIsInvalid()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.ValidateCredentialsAsyncHandler = (_, _) =>
            throw new InvalidOperationException("Handler should not be called for invalid payload.");

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", new LoginRequestDTO
        {
            Email = "invalid-email",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LoginReturnsBadRequestWhenPasswordIsTooShort()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.ValidateCredentialsAsyncHandler = (_, _) =>
            throw new InvalidOperationException("Handler should not be called for invalid payload.");

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/login", new LoginRequestDTO
        {
            Email = "patient@clinix.local",
            Password = "123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RegisterPatientReturnsCreatedWhenRegistrationSucceeds()
    {
        await factory.ResetDatabaseAsync();
        User user = BuildUser(UserType.User, "new-patient@clinix.local");
        factory.FakeUserService.RegisterPatientAsyncHandler = _ =>
            Task.FromResult(new UserRegistrationResult
            {
                User = user,
                Error = UserRegistrationError.None
            });

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/patients/register", new RegisterRequestDTO
        {
            Email = user.Email,
            Password = "Password123",
            Name = user.Name
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task RegisterPatientReturnsBadRequestWhenPayloadIsInvalid()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.RegisterPatientAsyncHandler = _ =>
            throw new InvalidOperationException("Handler should not be called for invalid payload.");

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/patients/register", new RegisterRequestDTO
        {
            Email = "invalid-email",
            Password = "123",
            Name = new string('n', 257)
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RegisterDoctorReturnsCreatedWhenRegistrationSucceeds()
    {
        await factory.ResetDatabaseAsync();
        User user = BuildUser(UserType.Doctor, "doctor@clinix.local");
        factory.FakeUserService.RegisterDoctorAsyncHandler = _ =>
            Task.FromResult(new UserRegistrationResult
            {
                User = user,
                Error = UserRegistrationError.None
            });

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/doctors/register", new RegisterDoctorRequestDTO
        {
            Name = "Doctor One",
            ProfessionalRegister = "CRM12345",
            Specialties = ["Cardiology"],
            Email = user.Email,
            Phone = "11999999999",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task RegisterDoctorReturnsBadRequestWhenPayloadIsInvalid()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.RegisterDoctorAsyncHandler = _ =>
            throw new InvalidOperationException("Handler should not be called for invalid payload.");

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/doctors/register", new RegisterDoctorRequestDTO
        {
            Name = new string('d', 257),
            ProfessionalRegister = string.Empty,
            Specialties = [],
            Email = "invalid-email",
            Phone = new string('1', 33),
            Password = "123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RegisterDoctorReturnsBadRequestWhenProfessionalRegisterAlreadyExists()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.RegisterDoctorAsyncHandler = _ =>
            Task.FromResult(new UserRegistrationResult
            {
                Error = UserRegistrationError.ProfessionalRegisterAlreadyRegistered
            });

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/doctors/register", new RegisterDoctorRequestDTO
        {
            Name = "Doctor One",
            ProfessionalRegister = "CRM0001",
            Specialties = ["Cardiology"],
            Email = "doctor@clinix.local",
            Phone = "11999999999",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        string message = await response.Content.ReadAsStringAsync();
        Assert.Contains("Professional register already registered", message);
    }

    [Fact]
    public async Task RegisterDoctorReturnsBadRequestWhenDoctorSpecialtiesAreMissing()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.RegisterDoctorAsyncHandler = _ =>
            Task.FromResult(new UserRegistrationResult
            {
                Error = UserRegistrationError.DoctorSpecialtiesRequired
            });

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/doctors/register", new RegisterDoctorRequestDTO
        {
            Name = "Doctor One",
            ProfessionalRegister = "CRM0002",
            Specialties = ["   "],
            Email = "doctor2@clinix.local",
            Phone = "11999999999",
            Password = "Password123"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        string message = await response.Content.ReadAsStringAsync();
        Assert.Contains("At least one valid specialty is required", message);
    }

    [Fact]
    public async Task RegisterLegacyReturnsBadRequestWhenEmailAlreadyExists()
    {
        await factory.ResetDatabaseAsync();
        factory.FakeUserService.RegisterPatientAsyncHandler = _ =>
            Task.FromResult(new UserRegistrationResult
            {
                Error = UserRegistrationError.EmailAlreadyRegistered
            });

        using HttpClient client = factory.CreateClient();
        HttpResponseMessage response = await client.PostAsJsonAsync("/auth/register", new RegisterRequestDTO
        {
            Email = "existing@clinix.local",
            Password = "Password123",
            Name = "Existing User"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        string message = await response.Content.ReadAsStringAsync();
        Assert.Contains("Email already registered", message);
    }

    [Fact]
    public async Task MeReturnsAuthenticatedUserClaims()
    {
        await factory.ResetDatabaseAsync();
        using HttpClient client = factory.CreateClient();
        Guid userId = Guid.NewGuid();
        client.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", "me@clinix.local");

        HttpResponseMessage response = await client.GetAsync("/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        MeResponse? body = await response.Content.ReadFromJsonAsync<MeResponse>(TestJson.SerializerOptions);
        Assert.NotNull(body);
        Assert.Equal(userId.ToString(), body.UserId);
        Assert.Equal("me@clinix.local", body.Email);
    }

    [Fact]
    public async Task MeReturnsDoctorProfileDataWhenDoctorExists()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();

        await factory.SeedAsync(context =>
        {
            context.Users.Add(new User
            {
                Id = doctorId,
                Email = "doctor-profile@clinix.local",
                Name = "Dra. Perfil",
                PasswordHash = "hashed",
                UserType = UserType.Doctor,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.DoctorProfiles.Add(new DoctorProfile
            {
                UserId = doctorId,
                ProfessionalRegister = "CRM777",
                NormalizedProfessionalRegister = "CRM777",
                Phone = "11912345678",
                Specialties = JsonSerializer.Serialize(new[] { "Cardiologia" }),
                CreatedAt = DateTime.UtcNow
            });

            return Task.CompletedTask;
        });

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", doctorId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", "doctor-profile@clinix.local");
        client.DefaultRequestHeaders.Add("X-Test-Role", "Doctor");

        HttpResponseMessage response = await client.GetAsync("/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        MeResponse? body = await response.Content.ReadFromJsonAsync<MeResponse>(TestJson.SerializerOptions);
        Assert.NotNull(body);
        Assert.Equal("CRM777", body.ProfessionalRegister);
        Assert.Equal("11912345678", body.Phone);
        Assert.Contains("Cardiologia", body.Specialties);
    }

    [Fact]
    public async Task UpdateDoctorProfileReturnsUpdatedDoctorData()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();

        await factory.SeedAsync(context =>
        {
            context.Users.Add(new User
            {
                Id = doctorId,
                Email = "update-doctor@clinix.local",
                Name = "Dr. Inicial",
                PasswordHash = "hashed",
                UserType = UserType.Doctor,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.DoctorProfiles.Add(new DoctorProfile
            {
                UserId = doctorId,
                ProfessionalRegister = "CRM100",
                NormalizedProfessionalRegister = "CRM100",
                Phone = "11911111111",
                Specialties = JsonSerializer.Serialize(new[] { "Clinica Geral" }),
                CreatedAt = DateTime.UtcNow
            });

            return Task.CompletedTask;
        });

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", doctorId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", "update-doctor@clinix.local");
        client.DefaultRequestHeaders.Add("X-Test-Role", "Doctor");

        HttpResponseMessage response = await client.PutAsJsonAsync("/auth/me/doctor-profile", new UpdateDoctorProfileRequestDTO
        {
            Name = "Dra. Atualizada",
            ProfessionalRegister = "CRM200",
            Phone = "11999998888",
            Specialties = ["Cardiologia", "Clinica Geral"]
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        MeResponse? body = await response.Content.ReadFromJsonAsync<MeResponse>(TestJson.SerializerOptions);
        Assert.NotNull(body);
        Assert.Equal("Dra. Atualizada", body.Name);
        Assert.Equal("CRM200", body.ProfessionalRegister);
        Assert.Equal("11999998888", body.Phone);
        Assert.Contains("Cardiologia", body.Specialties);
    }

    [Fact]
    public async Task MeReturnsUnauthorizedWithoutAuthentication()
    {
        await factory.ResetDatabaseAsync();
        using HttpClient client = factory.CreateClient();

        HttpResponseMessage response = await client.GetAsync("/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static User BuildUser(UserType userType, string email) =>
        new()
        {
            Id = Guid.NewGuid(),
            Email = email,
            Name = userType == UserType.Doctor ? "Doctor One" : "Patient One",
            PasswordHash = "hashed",
            UserType = userType,
            CreatedAt = DateTime.UtcNow
        };

    private sealed class MeResponse
    {
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? ProfessionalRegister { get; set; }
        public string? Phone { get; set; }
        public IReadOnlyCollection<string> Specialties { get; set; } = Array.Empty<string>();
    }
}
