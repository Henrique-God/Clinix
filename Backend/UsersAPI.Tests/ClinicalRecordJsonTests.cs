using System.Net;
using System.Text;
using System.Text.Json;
using UsersAPI.Models;
using UsersAPI.Tests.Infrastructure;
using Xunit;

namespace UsersAPI.Tests;

public class ClinicalRecordJsonTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory factory;

    public ClinicalRecordJsonTests(CustomWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task CreateEntryAcceptsStringEnumPayload()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();

        await factory.SeedAsync(context =>
        {
            context.Users.Add(new User
            {
                Id = patientId,
                Email = "patient-json@clinix.local",
                Name = "Paciente JSON",
                PasswordHash = "hash",
                UserType = UserType.User,
                CreatedAt = DateTime.UtcNow
            });

            return Task.CompletedTask;
        });

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", patientId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", "patient-json@clinix.local");
        client.DefaultRequestHeaders.Add("X-Test-Role", "User");

        StringContent content = new StringContent(
            JsonSerializer.Serialize(new
            {
                entryType = "Anamnesis",
                title = "Registro em texto",
                description = "Payload com enum em string.",
                isVisibleToPatient = true
            }),
            Encoding.UTF8,
            "application/json");

        HttpResponseMessage response = await client.PostAsync($"/patients/{patientId}/clinical-record/entries", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
