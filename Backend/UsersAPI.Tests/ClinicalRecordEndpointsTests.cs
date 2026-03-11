using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Tests.Infrastructure;
using Xunit;

namespace UsersAPI.Tests;

public class ClinicalRecordEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory factory;

    public ClinicalRecordEndpointsTests(CustomWebApplicationFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task ProtectedEndpointsReturnUnauthorizedWithoutAuthentication()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();
        Guid documentId = Guid.NewGuid();
        Guid grantId = Guid.NewGuid();

        using HttpClient client = factory.CreateClient();
        using MultipartFormDataContent uploadContent = new MultipartFormDataContent();
        using ByteArrayContent fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("content"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
        uploadContent.Add(fileContent, "file", "file.pdf");

        HttpResponseMessage getClinicalRecord = await client.GetAsync($"/patients/{patientId}/clinical-record");
        HttpResponseMessage getEntries = await client.GetAsync($"/patients/{patientId}/clinical-record/entries");
        HttpResponseMessage getEntry = await client.GetAsync($"/patients/{patientId}/clinical-record/entries/{entryId}");
        HttpResponseMessage createEntry = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/entries", new CreateClinicalRecordEntryRequestDTO
        {
            EntryType = ClinicalRecordEntryType.Anamnesis,
            Title = "Title",
            Description = "Description",
            IsVisibleToPatient = true
        });
        HttpResponseMessage updateEntry = await client.PutAsJsonAsync($"/patients/{patientId}/clinical-record/entries/{entryId}", new UpdateClinicalRecordEntryRequestDTO
        {
            Title = "Updated",
            Description = "Updated description",
            IsVisibleToPatient = true
        });
        HttpResponseMessage deleteEntry = await client.DeleteAsync($"/patients/{patientId}/clinical-record/entries/{entryId}");
        HttpResponseMessage uploadDocument = await client.PostAsync($"/patients/{patientId}/clinical-record/entries/{entryId}/documents", uploadContent);
        HttpResponseMessage downloadDocument = await client.GetAsync($"/patients/{patientId}/clinical-record/documents/{documentId}");
        HttpResponseMessage deleteDocument = await client.DeleteAsync($"/patients/{patientId}/clinical-record/documents/{documentId}");
        HttpResponseMessage getAccessGrants = await client.GetAsync($"/patients/{patientId}/clinical-record/access-grants");
        HttpResponseMessage createGrant = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/access-grants", new CreateClinicalRecordAccessGrantRequestDTO
        {
            DoctorId = Guid.NewGuid(),
            Reason = "Reason"
        });
        HttpResponseMessage revokeGrant = await client.PatchAsync($"/patients/{patientId}/clinical-record/access-grants/{grantId}/revoke", null);

        Assert.Equal(HttpStatusCode.Unauthorized, getClinicalRecord.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, getEntries.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, getEntry.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, createEntry.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, updateEntry.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, deleteEntry.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, uploadDocument.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, downloadDocument.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, deleteDocument.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, getAccessGrants.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, createGrant.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, revokeGrant.StatusCode);
    }

    [Fact]
    public async Task GetClinicalRecordReturnsSummaryForPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                UpdatedAt = DateTime.UtcNow.AddHours(-1)
            });

            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        ClinicalRecordSummaryDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordSummaryDTO>();
        Assert.NotNull(body);
        Assert.Equal(patientId, body.PatientId);
    }

    [Fact]
    public async Task GetClinicalRecordReturnsForbiddenForDifferentPatientUser()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid otherPatientId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            context.Users.Add(BuildUser(otherPatientId, UserType.User));
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(otherPatientId, UserType.User);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetEntriesReturnsForbiddenForDoctorWithoutGrant()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();

        await SeedUsersAsync(patientId, doctorId);
        factory.FakeAppointmentRelationshipService.HasScheduledOrCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/entries");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetEntriesReturnsForbiddenForDoctorWithoutScheduledOrCompletedAppointment()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid clinicalRecordId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = clinicalRecordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                UpdatedAt = DateTime.UtcNow.AddDays(-1)
            });
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        factory.FakeAppointmentRelationshipService.HasScheduledOrCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(false);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/entries");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetEntriesReturnsEntriesForAuthorizedDoctor()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid clinicalRecordId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = clinicalRecordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow.AddDays(-2),
                UpdatedAt = DateTime.UtcNow.AddDays(-1)
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = Guid.NewGuid(),
                ClinicalRecordId = clinicalRecordId,
                PatientId = patientId,
                AuthorUserId = doctorId,
                AuthorType = ClinicalRecordEntryAuthorType.Doctor,
                EntryType = ClinicalRecordEntryType.Anamnesis,
                Title = "Retorno",
                Description = "Paciente sem intercorrencias.",
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow.AddHours(-2),
                UpdatedAt = DateTime.UtcNow.AddHours(-2)
            });
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });

            await Task.CompletedTask;
        });

        factory.FakeAppointmentRelationshipService.HasScheduledOrCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/entries");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        List<ClinicalRecordEntryResponseDTO>? body = await response.Content.ReadFromJsonAsync<List<ClinicalRecordEntryResponseDTO>>();
        Assert.NotNull(body);
        Assert.Single(body);
        Assert.Equal("Retorno", body[0].Title);
    }

    [Fact]
    public async Task GetEntryReturnsEntryById()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid clinicalRecordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = clinicalRecordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = clinicalRecordId,
                PatientId = patientId,
                AuthorUserId = patientId,
                AuthorType = ClinicalRecordEntryAuthorType.Patient,
                EntryType = ClinicalRecordEntryType.Anamnesis,
                Title = "Sintomas",
                Description = "Dor de cabeca.",
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/entries/{entryId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        ClinicalRecordEntryResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordEntryResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal(entryId, body.Id);
    }

    [Fact]
    public async Task CreateEntryReturnsForbiddenForDoctorWithoutCompletedAppointment()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        factory.FakeAppointmentRelationshipService.HasCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(false);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/entries", new CreateClinicalRecordEntryRequestDTO
        {
            EntryType = ClinicalRecordEntryType.Anamnesis,
            Title = "Anotacao",
            Description = "Descricao",
            IsVisibleToPatient = true
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateEntryReturnsForbiddenWhenAppointmentDoesNotBelongToDoctorAndPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid appointmentId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        factory.FakeAppointmentRelationshipService.HasCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);
        factory.FakeAppointmentRelationshipService.IsAppointmentOwnedByDoctorAndPatientAsyncHandler =
            (_, _, _, _) => Task.FromResult(false);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/entries", new CreateClinicalRecordEntryRequestDTO
        {
            EntryType = ClinicalRecordEntryType.Document,
            Title = "Pedido de exame",
            Description = "Detalhes",
            AppointmentId = appointmentId,
            IsVisibleToPatient = true
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateEntryReturnsCreatedForPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/entries", new CreateClinicalRecordEntryRequestDTO
        {
            EntryType = ClinicalRecordEntryType.Anamnesis,
            Title = "Queixa principal",
            Description = "Febre ha dois dias.",
            IsVisibleToPatient = true
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        ClinicalRecordEntryResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordEntryResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal("Queixa principal", body.Title);
    }

    [Fact]
    public async Task UpdateEntryReturnsOkForAuthor()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid recordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = recordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = recordId,
                PatientId = patientId,
                AuthorUserId = patientId,
                AuthorType = ClinicalRecordEntryAuthorType.Patient,
                EntryType = ClinicalRecordEntryType.Anamnesis,
                Title = "Antigo",
                Description = "Descricao antiga.",
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.PutAsJsonAsync($"/patients/{patientId}/clinical-record/entries/{entryId}", new UpdateClinicalRecordEntryRequestDTO
        {
            Title = "Atualizado",
            Description = "Descricao nova.",
            IsVisibleToPatient = false
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        ClinicalRecordEntryResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordEntryResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal("Atualizado", body.Title);
        Assert.False(body.IsVisibleToPatient);
    }

    [Fact]
    public async Task DeleteEntryReturnsNoContentForAuthor()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid recordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            context.Users.Add(BuildUser(patientId, UserType.User));
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = recordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = recordId,
                PatientId = patientId,
                AuthorUserId = patientId,
                AuthorType = ClinicalRecordEntryAuthorType.Patient,
                EntryType = ClinicalRecordEntryType.Anamnesis,
                Title = "Titulo",
                Description = "Descricao",
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.DeleteAsync($"/patients/{patientId}/clinical-record/entries/{entryId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task UploadDocumentReturnsCreatedForAuthorizedDoctor()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid appointmentId = Guid.NewGuid();
        Guid recordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = recordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = recordId,
                PatientId = patientId,
                AuthorUserId = doctorId,
                AuthorType = ClinicalRecordEntryAuthorType.Doctor,
                EntryType = ClinicalRecordEntryType.Document,
                Title = "Pedido",
                Description = "Solicitacao de exame.",
                AppointmentId = appointmentId,
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        factory.FakeAppointmentRelationshipService.HasCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);
        factory.FakeAppointmentRelationshipService.IsAppointmentOwnedByDoctorAndPatientAsyncHandler =
            (requestedAppointmentId, requestedPatientId, requestedDoctorId, _) =>
                Task.FromResult(requestedAppointmentId == appointmentId
                    && requestedPatientId == patientId
                    && requestedDoctorId == doctorId);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        using MultipartFormDataContent content = new MultipartFormDataContent();
        using ByteArrayContent fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("document-content"));
        fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/pdf");
        content.Add(fileContent, "file", "pedido.pdf");

        HttpResponseMessage response = await client.PostAsync($"/patients/{patientId}/clinical-record/entries/{entryId}/documents", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        ClinicalDocumentResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalDocumentResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal("pedido.pdf", body.FileName);
        Assert.Single(factory.FakeS3StorageService.Objects);
    }

    [Fact]
    public async Task DownloadDocumentReturnsFileForAuthorizedDoctor()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid recordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();
        Guid documentId = Guid.NewGuid();
        const string s3Key = "clinical-records/test/document.pdf";

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = recordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = recordId,
                PatientId = patientId,
                AuthorUserId = doctorId,
                AuthorType = ClinicalRecordEntryAuthorType.Doctor,
                EntryType = ClinicalRecordEntryType.Document,
                Title = "Laudo",
                Description = "Laudo anexado.",
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalDocuments.Add(new ClinicalDocument
            {
                Id = documentId,
                ClinicalRecordEntryId = entryId,
                FileName = "laudo.pdf",
                StoredFileName = "stored-laudo.pdf",
                ContentType = "application/pdf",
                SizeInBytes = 20,
                S3Key = s3Key,
                UploadedByUserId = doctorId,
                CreatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        await factory.FakeS3StorageService.UploadAsync(s3Key, new MemoryStream(Encoding.UTF8.GetBytes("pdf-content")), "application/pdf");
        factory.FakeAppointmentRelationshipService.HasScheduledOrCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/documents/{documentId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task DeleteDocumentReturnsNoContentForUploader()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid appointmentId = Guid.NewGuid();
        Guid recordId = Guid.NewGuid();
        Guid entryId = Guid.NewGuid();
        Guid documentId = Guid.NewGuid();
        const string s3Key = "clinical-records/test/delete.pdf";

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.PatientClinicalRecords.Add(new PatientClinicalRecord
            {
                Id = recordId,
                PatientId = patientId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordEntries.Add(new ClinicalRecordEntry
            {
                Id = entryId,
                ClinicalRecordId = recordId,
                PatientId = patientId,
                AuthorUserId = doctorId,
                AuthorType = ClinicalRecordEntryAuthorType.Doctor,
                EntryType = ClinicalRecordEntryType.Document,
                Title = "Anexo",
                Description = "Documento anexado.",
                AppointmentId = appointmentId,
                IsVisibleToPatient = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            context.ClinicalDocuments.Add(new ClinicalDocument
            {
                Id = documentId,
                ClinicalRecordEntryId = entryId,
                FileName = "delete.pdf",
                StoredFileName = "stored-delete.pdf",
                ContentType = "application/pdf",
                SizeInBytes = 10,
                S3Key = s3Key,
                UploadedByUserId = doctorId,
                CreatedAt = DateTime.UtcNow
            });
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        await factory.FakeS3StorageService.UploadAsync(s3Key, new MemoryStream(Encoding.UTF8.GetBytes("delete-content")), "application/pdf");
        factory.FakeAppointmentRelationshipService.HasCompletedAppointmentAsyncHandler =
            (_, _, _) => Task.FromResult(true);
        factory.FakeAppointmentRelationshipService.IsAppointmentOwnedByDoctorAndPatientAsyncHandler =
            (_, _, _, _) => Task.FromResult(true);

        using HttpClient client = CreateAuthenticatedClient(doctorId, UserType.Doctor);
        HttpResponseMessage response = await client.DeleteAsync($"/patients/{patientId}/clinical-record/documents/{documentId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(factory.FakeS3StorageService.Objects);
    }

    [Fact]
    public async Task GetAccessGrantsReturnsPatientGrants()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                Reason = "Acompanhamento cardiologico",
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.GetAsync($"/patients/{patientId}/clinical-record/access-grants");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        List<ClinicalRecordAccessGrantResponseDTO>? body = await response.Content.ReadFromJsonAsync<List<ClinicalRecordAccessGrantResponseDTO>>();
        Assert.NotNull(body);
        Assert.Single(body);
    }

    [Fact]
    public async Task CreateAccessGrantReturnsCreatedForPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();

        await SeedUsersAsync(patientId, doctorId);

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.PostAsJsonAsync($"/patients/{patientId}/clinical-record/access-grants", new CreateClinicalRecordAccessGrantRequestDTO
        {
            DoctorId = doctorId,
            Reason = "Compartilhar historico",
            StartAt = DateTime.UtcNow
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        ClinicalRecordAccessGrantResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordAccessGrantResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal(doctorId, body.DoctorId);
    }

    [Fact]
    public async Task RevokeAccessGrantReturnsOkForPatient()
    {
        await factory.ResetDatabaseAsync();
        Guid patientId = Guid.NewGuid();
        Guid doctorId = Guid.NewGuid();
        Guid grantId = Guid.NewGuid();

        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            context.ClinicalRecordAccessGrants.Add(new ClinicalRecordAccessGrant
            {
                Id = grantId,
                PatientId = patientId,
                DoctorId = doctorId,
                GrantedByPatientId = patientId,
                Status = ClinicalRecordAccessGrantStatus.Active,
                StartAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            });
            await Task.CompletedTask;
        });

        using HttpClient client = CreateAuthenticatedClient(patientId, UserType.User);
        HttpResponseMessage response = await client.PatchAsync($"/patients/{patientId}/clinical-record/access-grants/{grantId}/revoke", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        ClinicalRecordAccessGrantResponseDTO? body = await response.Content.ReadFromJsonAsync<ClinicalRecordAccessGrantResponseDTO>();
        Assert.NotNull(body);
        Assert.Equal(ClinicalRecordAccessGrantStatus.Revoked, body.Status);
    }

    private HttpClient CreateAuthenticatedClient(Guid userId, UserType userType)
    {
        HttpClient client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", userId.ToString());
        client.DefaultRequestHeaders.Add("X-Test-Email", $"{userType.ToString().ToLowerInvariant()}@clinix.local");
        client.DefaultRequestHeaders.Add("X-Test-Role", userType.ToString());
        return client;
    }

    private async Task SeedUsersAsync(Guid patientId, Guid doctorId)
    {
        await factory.SeedAsync(async context =>
        {
            SeedUsers(context, patientId, doctorId);
            await Task.CompletedTask;
        });
    }

    private static void SeedUsers(UsersDbContext context, Guid patientId, Guid doctorId)
    {
        context.Users.Add(BuildUser(patientId, UserType.User));
        context.Users.Add(BuildUser(doctorId, UserType.Doctor));
    }

    private static User BuildUser(Guid userId, UserType userType) => new()
    {
        Id = userId,
        Email = $"{userType.ToString().ToLowerInvariant()}-{userId:N}@clinix.local",
        Name = userType == UserType.Doctor ? "Doctor" : "Patient",
        PasswordHash = "hash",
        UserType = userType,
        CreatedAt = DateTime.UtcNow
    };
}

