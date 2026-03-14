using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;

namespace UsersAPI.Controllers;

[ApiController]
[Route("internal")]
public class InternalIntegrationController : ControllerBase
{
    private readonly IUsersDbContext context;
    private readonly IConfiguration configuration;

    public InternalIntegrationController(IUsersDbContext context, IConfiguration configuration)
    {
        this.context = context;
        this.configuration = configuration;
    }

    [HttpGet("users/{userId:guid}")]
    public async Task<IActionResult> GetUser(Guid userId, CancellationToken cancellationToken)
    {
        IActionResult? authorizationFailure = EnsureInternalRequestAuthorized();
        if (authorizationFailure is not null)
            return authorizationFailure;

        User? user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);

        if (user is null)
            return NotFound();

        DoctorProfile? doctorProfile = null;
        if (user.UserType == UserType.Doctor)
        {
            doctorProfile = await context.DoctorProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == user.Id, cancellationToken);
        }

        IReadOnlyCollection<string> specialties = doctorProfile is null
            ? Array.Empty<string>()
            : DeserializeSpecialties(doctorProfile.Specialties);

        return Ok(new
        {
            userId = user.Id,
            userType = user.UserType.ToString(),
            isActive = user.IsActive,
            name = user.Name,
            professionalRegister = doctorProfile?.ProfessionalRegister,
            specialties
        });
    }

    [HttpPost("patients/{patientId:guid}/clinical-record/access-grants/from-appointment")]
    public async Task<IActionResult> CreateAccessGrantFromAppointment(
        Guid patientId,
        [FromBody] CreateInternalAccessGrantRequest request,
        CancellationToken cancellationToken)
    {
        IActionResult? authorizationFailure = EnsureInternalRequestAuthorized();
        if (authorizationFailure is not null)
            return authorizationFailure;

        IActionResult? validationFailure = await EnsurePatientAndDoctorAsync(patientId, request.DoctorId, cancellationToken);
        if (validationFailure is not null)
            return validationFailure;

        ClinicalRecordAccessGrant? existingGrant = await context.ClinicalRecordAccessGrants
            .FirstOrDefaultAsync(item =>
                item.PatientId == patientId
                && item.DoctorId == request.DoctorId
                && item.Status == ClinicalRecordAccessGrantStatus.Active
                && !item.RevokedAt.HasValue,
                cancellationToken);

        if (existingGrant is not null)
            return Ok(new { grantId = existingGrant.Id, created = false });

        var grant = new ClinicalRecordAccessGrant
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            DoctorId = request.DoctorId,
            GrantedByPatientId = patientId,
            Status = ClinicalRecordAccessGrantStatus.Active,
            Reason = $"Granted automatically after appointment acceptance ({request.AppointmentId}).",
            StartAt = DateTime.UtcNow,
            EndAt = null,
            CreatedAt = DateTime.UtcNow
        };

        context.ClinicalRecordAccessGrants.Add(grant);
        await context.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new { grantId = grant.Id, created = true });
    }

    [HttpPost("patients/{patientId:guid}/clinical-record/entries/from-appointment")]
    public async Task<IActionResult> CreateEntryFromAppointment(
        Guid patientId,
        [FromBody] CreateInternalClinicalEntryRequest request,
        CancellationToken cancellationToken)
    {
        IActionResult? authorizationFailure = EnsureInternalRequestAuthorized();
        if (authorizationFailure is not null)
            return authorizationFailure;

        IActionResult? validationFailure = await EnsurePatientAndDoctorAsync(patientId, request.DoctorId, cancellationToken);
        if (validationFailure is not null)
            return validationFailure;

        ClinicalRecordEntry? existingEntry = await context.ClinicalRecordEntries
            .FirstOrDefaultAsync(item =>
                item.PatientId == patientId
                && item.AppointmentId == request.AppointmentId
                && item.AuthorUserId == request.DoctorId
                && !item.DeletedAt.HasValue,
                cancellationToken);

        if (existingEntry is not null)
            return Ok(new { entryId = existingEntry.Id, created = false });

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        DateTime utcNow = DateTime.UtcNow;

        var entry = new ClinicalRecordEntry
        {
            Id = Guid.NewGuid(),
            ClinicalRecordId = record.Id,
            PatientId = patientId,
            AuthorUserId = request.DoctorId,
            AuthorType = ClinicalRecordEntryAuthorType.Doctor,
            EntryType = ClinicalRecordEntryType.Anamnesis,
            Title = string.IsNullOrWhiteSpace(request.Title) ? "Consulta concluida" : request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? "Rascunho de anotacao clinica criado a partir da consulta concluida." : request.Description.Trim(),
            AppointmentId = request.AppointmentId,
            AppointmentOccurredAt = request.AppointmentOccurredAtUtc,
            IsVisibleToPatient = false,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        record.UpdatedAt = utcNow;
        context.ClinicalRecordEntries.Add(entry);
        await context.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new { entryId = entry.Id, created = true });
    }

    private IActionResult? EnsureInternalRequestAuthorized()
    {
        string? configuredApiKey = configuration["InternalServices:ApiKey"];

        if (string.IsNullOrWhiteSpace(configuredApiKey))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, "Internal services API key is not configured.");

        if (!Request.Headers.TryGetValue("X-Internal-Api-Key", out var providedApiKey))
            return Unauthorized("Missing internal API key.");

        byte[] expected = Encoding.UTF8.GetBytes(configuredApiKey);
        byte[] provided = Encoding.UTF8.GetBytes(providedApiKey.ToString());

        if (!CryptographicOperations.FixedTimeEquals(expected, provided))
            return Unauthorized("Invalid internal API key.");

        return null;
    }

    private async Task<IActionResult?> EnsurePatientAndDoctorAsync(Guid patientId, Guid doctorId, CancellationToken cancellationToken)
    {
        User? patient = await context.Users.FirstOrDefaultAsync(item => item.Id == patientId, cancellationToken);
        User? doctor = await context.Users.FirstOrDefaultAsync(item => item.Id == doctorId, cancellationToken);

        if (patient is null || patient.UserType != UserType.User || !patient.IsActive)
            return BadRequest("Patient was not found or is inactive.");

        if (doctor is null || doctor.UserType != UserType.Doctor || !doctor.IsActive)
            return BadRequest("Doctor was not found or is inactive.");

        return null;
    }

    private async Task<PatientClinicalRecord> EnsureClinicalRecordAsync(Guid patientId, CancellationToken cancellationToken)
    {
        PatientClinicalRecord? record = await context.PatientClinicalRecords
            .FirstOrDefaultAsync(item => item.PatientId == patientId, cancellationToken);

        if (record is not null)
            return record;

        record = new PatientClinicalRecord
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        context.PatientClinicalRecords.Add(record);
        await context.SaveChangesAsync(cancellationToken);
        return record;
    }

    private static IReadOnlyCollection<string> DeserializeSpecialties(string serializedSpecialties)
    {
        if (string.IsNullOrWhiteSpace(serializedSpecialties))
            return Array.Empty<string>();

        return JsonSerializer.Deserialize<List<string>>(serializedSpecialties) ?? [];
    }

    public sealed class CreateInternalAccessGrantRequest
    {
        public Guid AppointmentId { get; set; }

        public Guid DoctorId { get; set; }

        public DateTime AppointmentEndTimeUtc { get; set; }
    }

    public sealed class CreateInternalClinicalEntryRequest
    {
        public Guid AppointmentId { get; set; }

        public Guid DoctorId { get; set; }

        public DateTime AppointmentOccurredAtUtc { get; set; }

        public string? Title { get; set; }

        public string? Description { get; set; }
    }
}
