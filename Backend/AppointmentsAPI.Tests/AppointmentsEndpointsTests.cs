using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Domain;
using AppointmentsAPI.Tests.Infrastructure;
using Xunit;

namespace AppointmentsAPI.Tests;

public class AppointmentsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string AppointmentsInternalApiKey = "APPOINTMENTS_INTERNAL_KEY_CHANGE_ME";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly CustomWebApplicationFactory factory;

    public AppointmentsEndpointsTests(CustomWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task InviteReturnsCreatedForDoctor()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        using HttpClient client = CreateAuthenticatedClient(doctorId, "Doctor");
        HttpResponseMessage response = await client.PostAsJsonAsync("/appointments/invite", new CreateAppointmentInviteRequestDto
        {
            PatientId = patientId,
            Title = "Consulta cardiologica",
            Description = "Primeira avaliacao",
            Location = "Sala 2",
            InvitationMessage = "Horario reservado para avaliacao inicial.",
            StartTime = factory.TestClock.UtcNow.AddDays(1).AddHours(2),
            EndTime = factory.TestClock.UtcNow.AddDays(1).AddHours(3),
            InvitationExpiresAt = factory.TestClock.UtcNow.AddDays(1).AddHours(1)
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        AppointmentResponseDto? body = await response.Content.ReadFromJsonAsync<AppointmentResponseDto>(JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(AppointmentStatus.PendingAcceptance, body.Status);
        Assert.False(body.IsInvitationExpired);
        Assert.Contains("AppointmentInvited", factory.FakeIntegrationEventPublisher.Events);
    }

    [Fact]
    public async Task AcceptReturnsOkAndGrantsClinicalAccess()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        Guid appointmentId = await InviteAppointmentAsync(doctorId, patientId);

        using HttpClient patientClient = CreateAuthenticatedClient(patientId, "User");
        HttpResponseMessage response = await patientClient.PostAsJsonAsync(
            $"/appointments/{appointmentId}/accept",
            new RespondToInvitationRequestDto { Note = "Aceito o horario." });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AppointmentResponseDto? body = await response.Content.ReadFromJsonAsync<AppointmentResponseDto>(JsonOptions);
        Assert.NotNull(body);
        Assert.Equal(AppointmentStatus.Accepted, body.Status);
        Assert.Single(factory.FakeClinicalRecordsGateway.AccessGrants);
        Assert.Contains("AppointmentAccepted", factory.FakeIntegrationEventPublisher.Events);
        Assert.Contains("ClinicalRecordAccessGranted", factory.FakeIntegrationEventPublisher.Events);
    }

    [Fact]
    public async Task AcceptReturnsConflictWhenInvitationExpired()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        using HttpClient doctorClient = CreateAuthenticatedClient(doctorId, "Doctor");
        HttpResponseMessage inviteResponse = await doctorClient.PostAsJsonAsync("/appointments/invite", new CreateAppointmentInviteRequestDto
        {
            PatientId = patientId,
            Title = "Consulta de retorno",
            StartTime = factory.TestClock.UtcNow.AddHours(3),
            EndTime = factory.TestClock.UtcNow.AddHours(4),
            InvitationExpiresAt = factory.TestClock.UtcNow.AddHours(1)
        });

        AppointmentResponseDto? inviteBody = await inviteResponse.Content.ReadFromJsonAsync<AppointmentResponseDto>(JsonOptions);
        Assert.NotNull(inviteBody);

        factory.TestClock.UtcNow = factory.TestClock.UtcNow.AddHours(2);

        using HttpClient patientClient = CreateAuthenticatedClient(patientId, "User");
        HttpResponseMessage response = await patientClient.PostAsJsonAsync(
            $"/appointments/{inviteBody.Id}/accept",
            new RespondToInvitationRequestDto());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task AcceptReturnsForbiddenForDifferentPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        Guid anotherPatientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");
        factory.FakeUserDirectoryService.Upsert(anotherPatientId, "User");

        Guid appointmentId = await InviteAppointmentAsync(doctorId, patientId);

        using HttpClient anotherPatientClient = CreateAuthenticatedClient(anotherPatientId, "User");
        HttpResponseMessage response = await anotherPatientClient.PostAsJsonAsync(
            $"/appointments/{appointmentId}/accept",
            new RespondToInvitationRequestDto());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CancelCompletedAppointmentReturnsConflict()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        Guid appointmentId = await InviteAppointmentAsync(doctorId, patientId);

        using HttpClient patientClient = CreateAuthenticatedClient(patientId, "User");
        await patientClient.PostAsJsonAsync($"/appointments/{appointmentId}/accept", new RespondToInvitationRequestDto());

        factory.TestClock.UtcNow = factory.TestClock.UtcNow.AddDays(2);

        using HttpClient doctorClient = CreateAuthenticatedClient(doctorId, "Doctor");
        HttpResponseMessage completeResponse = await doctorClient.PostAsJsonAsync(
            $"/appointments/{appointmentId}/complete",
            new CompleteAppointmentRequestDto());

        Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);

        HttpResponseMessage cancelResponse = await doctorClient.PostAsJsonAsync(
            $"/appointments/{appointmentId}/cancel",
            new CancelAppointmentRequestDto { Reason = "Nao deveria cancelar." });

        Assert.Equal(HttpStatusCode.Conflict, cancelResponse.StatusCode);
    }

    [Fact]
    public async Task AvailableSlotsExcludeBlockingEventsAndPendingInvitations()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        DateTime availabilityStart = new(2026, 3, 16, 9, 0, 0, DateTimeKind.Utc);
        DateTime availabilityEnd = new(2026, 3, 16, 12, 0, 0, DateTimeKind.Utc);

        await factory.SeedAsync(context =>
        {
            context.DoctorAvailabilities.Add(DoctorAvailability.Create(
                doctorId,
                availabilityStart,
                availabilityEnd,
                ScheduleVisibility.Public,
                factory.TestClock.UtcNow));

            context.AgendaEvents.Add(AgendaEvent.CreateManual(
                doctorId,
                AgendaEventType.ExternalEvent,
                "Cirurgia",
                "Bloqueio da agenda",
                new DateTime(2026, 3, 16, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 16, 11, 0, 0, DateTimeKind.Utc),
                factory.TestClock.UtcNow));

            Appointment acceptedAppointment = Appointment.CreateInvitation(
                doctorId,
                patientId,
                "Consulta 1",
                null,
                null,
                null,
                new DateTime(2026, 3, 16, 9, 30, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 16, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 15, 20, 0, 0, DateTimeKind.Utc),
                factory.TestClock.UtcNow);
            acceptedAppointment.Accept(patientId, factory.TestClock.UtcNow, null);
            context.Appointments.Add(acceptedAppointment);

            Appointment pendingAppointment = Appointment.CreateInvitation(
                doctorId,
                patientId,
                "Consulta 2",
                null,
                null,
                null,
                new DateTime(2026, 3, 16, 11, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 16, 11, 30, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 15, 22, 0, 0, DateTimeKind.Utc),
                factory.TestClock.UtcNow);
            context.Appointments.Add(pendingAppointment);

            return Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, "User");
        HttpResponseMessage response = await client.GetAsync(
            "/doctors/" + doctorId + "/available-slots?FromUtc=2026-03-16T09:00:00Z&ToUtc=2026-03-16T12:00:00Z&DurationMinutes=30");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        List<AvailableSlotResponseDto>? slots = await response.Content.ReadFromJsonAsync<List<AvailableSlotResponseDto>>(JsonOptions);
        Assert.NotNull(slots);
        Assert.Equal(2, slots.Count);
        Assert.Equal(new DateTime(2026, 3, 16, 9, 0, 0, DateTimeKind.Utc), slots[0].StartTime);
        Assert.Equal(new DateTime(2026, 3, 16, 11, 30, 0, DateTimeKind.Utc), slots[1].StartTime);
    }

    [Fact]
    public async Task InternalRelationshipCheckReturnsTrueForAcceptedAppointment()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        Guid appointmentId = await InviteAppointmentAsync(doctorId, patientId);

        using HttpClient patientClient = CreateAuthenticatedClient(patientId, "User");
        await patientClient.PostAsJsonAsync($"/appointments/{appointmentId}/accept", new RespondToInvitationRequestDto());

        using HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Internal-Api-Key", AppointmentsInternalApiKey);
        HttpResponseMessage response = await client.GetAsync(
            $"/internal/appointments/relationship-check?patientId={patientId}&doctorId={doctorId}&mode=scheduled-or-completed");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, bool>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body["hasRelationship"]);
    }

    [Fact]
    public async Task InternalOwnershipReturnsTrueOnlyForCompletedAppointment()
    {
        await factory.ResetDatabaseAsync();
        Guid doctorId = Guid.NewGuid();
        Guid patientId = Guid.NewGuid();
        factory.FakeUserDirectoryService.Upsert(doctorId, "Doctor");
        factory.FakeUserDirectoryService.Upsert(patientId, "User");

        Guid appointmentId = await InviteAppointmentAsync(doctorId, patientId);

        using HttpClient patientClient = CreateAuthenticatedClient(patientId, "User");
        await patientClient.PostAsJsonAsync($"/appointments/{appointmentId}/accept", new RespondToInvitationRequestDto());

        using HttpClient internalClient = factory.CreateClient();
        internalClient.DefaultRequestHeaders.Add("X-Internal-Api-Key", AppointmentsInternalApiKey);

        HttpResponseMessage beforeCompletion = await internalClient.GetAsync(
            $"/internal/appointments/{appointmentId}/ownership?patientId={patientId}&doctorId={doctorId}");
        var beforeBody = await beforeCompletion.Content.ReadFromJsonAsync<Dictionary<string, bool>>(JsonOptions);
        Assert.NotNull(beforeBody);
        Assert.False(beforeBody["matches"]);

        factory.TestClock.UtcNow = factory.TestClock.UtcNow.AddDays(2);
        using HttpClient doctorClient = CreateAuthenticatedClient(doctorId, "Doctor");
        await doctorClient.PostAsJsonAsync($"/appointments/{appointmentId}/complete", new CompleteAppointmentRequestDto());

        HttpResponseMessage afterCompletion = await internalClient.GetAsync(
            $"/internal/appointments/{appointmentId}/ownership?patientId={patientId}&doctorId={doctorId}");
        var afterBody = await afterCompletion.Content.ReadFromJsonAsync<Dictionary<string, bool>>(JsonOptions);
        Assert.NotNull(afterBody);
        Assert.True(afterBody["matches"]);
    }

    private async Task<Guid> InviteAppointmentAsync(Guid doctorId, Guid patientId)
    {
        using HttpClient doctorClient = CreateAuthenticatedClient(doctorId, "Doctor");
        HttpResponseMessage response = await doctorClient.PostAsJsonAsync("/appointments/invite", new CreateAppointmentInviteRequestDto
        {
            PatientId = patientId,
            Title = "Consulta geral",
            StartTime = factory.TestClock.UtcNow.AddDays(1).AddHours(1),
            EndTime = factory.TestClock.UtcNow.AddDays(1).AddHours(2),
            InvitationExpiresAt = factory.TestClock.UtcNow.AddDays(1)
        });

        AppointmentResponseDto? body = await response.Content.ReadFromJsonAsync<AppointmentResponseDto>(JsonOptions);
        Assert.NotNull(body);
        return body.Id;
    }

    private HttpClient CreateAuthenticatedClient(Guid userId, string role)
    {
        HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", $"{role.ToLowerInvariant()}@clinix.local");
        client.DefaultRequestHeaders.Add("X-Test-Role", role);
        return client;
    }
}
