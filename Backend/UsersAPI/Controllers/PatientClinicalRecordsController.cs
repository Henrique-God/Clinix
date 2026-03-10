using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Controllers;

[ApiController]
[Route("patients/{patientId:guid}/clinical-record")]
[Authorize]
public class PatientClinicalRecordsController : ControllerBase
{
    private readonly IUsersDbContext context;
    private readonly IClinicalRecordAuthorizationService authorizationService;
    private readonly IS3StorageService storageService;

    public PatientClinicalRecordsController(
        IUsersDbContext context,
        IClinicalRecordAuthorizationService authorizationService,
        IS3StorageService storageService)
    {
        this.context = context;
        this.authorizationService = authorizationService;
        this.storageService = storageService;
    }

    [HttpGet]
    public async Task<IActionResult> GetClinicalRecord(Guid patientId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeReadAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);

        var summary = new ClinicalRecordSummaryDTO
        {
            ClinicalRecordId = record.Id,
            PatientId = patientId,
            ActiveEntriesCount = await context.ClinicalRecordEntries.CountAsync(
                e => e.PatientId == patientId && !e.DeletedAt.HasValue,
                cancellationToken),
            ActiveDocumentsCount = await context.ClinicalDocuments.CountAsync(
                d => d.ClinicalRecordEntry!.PatientId == patientId && !d.DeletedAt.HasValue && !d.ClinicalRecordEntry.DeletedAt.HasValue,
                cancellationToken),
            ActiveAccessGrantsCount = await context.ClinicalRecordAccessGrants.CountAsync(
                g => g.PatientId == patientId && g.Status == ClinicalRecordAccessGrantStatus.Active && !g.RevokedAt.HasValue,
                cancellationToken),
            CreatedAt = record.CreatedAt,
            UpdatedAt = record.UpdatedAt
        };

        return Ok(summary);
    }

    [HttpGet("entries")]
    public async Task<IActionResult> GetEntries(Guid patientId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeReadAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        var entries = await context.ClinicalRecordEntries
            .AsNoTracking()
            .Include(e => e.Documents.Where(d => !d.DeletedAt.HasValue))
            .Where(e => e.PatientId == patientId && !e.DeletedAt.HasValue)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(entries.Select(MapEntry));
    }

    [HttpGet("entries/{entryId:guid}")]
    public async Task<IActionResult> GetEntry(Guid patientId, Guid entryId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeReadAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        ClinicalRecordEntry? entry = await context.ClinicalRecordEntries
            .AsNoTracking()
            .Include(e => e.Documents.Where(d => !d.DeletedAt.HasValue))
            .FirstOrDefaultAsync(e => e.Id == entryId && e.PatientId == patientId && !e.DeletedAt.HasValue, cancellationToken);

        if (entry is null)
            return NotFound();

        return Ok(MapEntry(entry));
    }

    [HttpPost("entries")]
    public async Task<IActionResult> CreateEntry(Guid patientId, [FromBody] CreateClinicalRecordEntryRequestDTO request, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeWriteAsync(actor, patientId, request.AppointmentId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        if (actor.UserType == UserType.User && actor.UserId != patientId)
            return Forbid();

        if (request.EntryType == ClinicalRecordEntryType.Document && !request.AppointmentId.HasValue && actor.UserType == UserType.Doctor)
            return BadRequest("Doctor document entries must reference an appointment.");

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        DateTime utcNow = DateTime.UtcNow;

        var entry = new ClinicalRecordEntry
        {
            Id = Guid.NewGuid(),
            ClinicalRecordId = record.Id,
            PatientId = patientId,
            AuthorUserId = actor.UserId,
            AuthorType = actor.UserType == UserType.Doctor ? ClinicalRecordEntryAuthorType.Doctor : ClinicalRecordEntryAuthorType.Patient,
            EntryType = request.EntryType,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            AppointmentId = request.AppointmentId,
            AppointmentOccurredAt = request.AppointmentOccurredAt,
            IsVisibleToPatient = request.IsVisibleToPatient,
            CreatedAt = utcNow,
            UpdatedAt = utcNow
        };

        record.UpdatedAt = utcNow;
        context.ClinicalRecordEntries.Add(entry);
        await context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetEntry), new { patientId, entryId = entry.Id }, MapEntry(entry));
    }

    [HttpPut("entries/{entryId:guid}")]
    public async Task<IActionResult> UpdateEntry(
        Guid patientId,
        Guid entryId,
        [FromBody] UpdateClinicalRecordEntryRequestDTO request,
        CancellationToken cancellationToken)
    {
        ClinicalRecordEntry? entry = await context.ClinicalRecordEntries
            .FirstOrDefaultAsync(e => e.Id == entryId && e.PatientId == patientId && !e.DeletedAt.HasValue, cancellationToken);

        if (entry is null)
            return NotFound();

        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeWriteAsync(actor, patientId, entry.AppointmentId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        if (actor.UserType != UserType.Admin && entry.AuthorUserId != actor.UserId)
            return Forbid();

        entry.Title = request.Title.Trim();
        entry.Description = request.Description.Trim();
        entry.IsVisibleToPatient = request.IsVisibleToPatient;
        entry.UpdatedAt = DateTime.UtcNow;

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        record.UpdatedAt = entry.UpdatedAt;

        await context.SaveChangesAsync(cancellationToken);
        return Ok(MapEntry(entry));
    }

    [HttpDelete("entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteEntry(Guid patientId, Guid entryId, CancellationToken cancellationToken)
    {
        ClinicalRecordEntry? entry = await context.ClinicalRecordEntries
            .Include(e => e.Documents)
            .FirstOrDefaultAsync(e => e.Id == entryId && e.PatientId == patientId && !e.DeletedAt.HasValue, cancellationToken);

        if (entry is null)
            return NotFound();

        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeWriteAsync(actor, patientId, entry.AppointmentId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        if (actor.UserType != UserType.Admin && entry.AuthorUserId != actor.UserId)
            return Forbid();

        DateTime utcNow = DateTime.UtcNow;
        entry.DeletedAt = utcNow;
        entry.UpdatedAt = utcNow;

        foreach (ClinicalDocument document in entry.Documents.Where(d => !d.DeletedAt.HasValue))
        {
            document.DeletedAt = utcNow;
            await storageService.DeleteAsync(document.S3Key);
        }

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        record.UpdatedAt = utcNow;

        await context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("entries/{entryId:guid}/documents")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadDocument(Guid patientId, Guid entryId, [FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        ClinicalRecordEntry? entry = await context.ClinicalRecordEntries
            .Include(e => e.Documents)
            .FirstOrDefaultAsync(e => e.Id == entryId && e.PatientId == patientId && !e.DeletedAt.HasValue, cancellationToken);

        if (entry is null)
            return NotFound();

        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeWriteAsync(actor, patientId, entry.AppointmentId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        if (entry.EntryType != ClinicalRecordEntryType.Document)
            return BadRequest("Documents can only be attached to document entries.");

        if (file.Length == 0)
            return BadRequest("File is required.");

        string storedFileName = $"{Guid.NewGuid():N}-{Path.GetFileName(file.FileName)}";
        string s3Key = $"clinical-records/{patientId}/{entryId}/{storedFileName}";

        await using Stream stream = file.OpenReadStream();
        await storageService.UploadAsync(s3Key, stream, file.ContentType);

        var document = new ClinicalDocument
        {
            Id = Guid.NewGuid(),
            ClinicalRecordEntryId = entryId,
            FileName = file.FileName,
            StoredFileName = storedFileName,
            ContentType = file.ContentType,
            SizeInBytes = file.Length,
            S3Key = s3Key,
            UploadedByUserId = actor.UserId,
            CreatedAt = DateTime.UtcNow
        };

        context.ClinicalDocuments.Add(document);
        entry.UpdatedAt = DateTime.UtcNow;

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        record.UpdatedAt = entry.UpdatedAt;

        await context.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, MapDocument(document));
    }

    [HttpGet("documents/{documentId:guid}")]
    public async Task<IActionResult> DownloadDocument(Guid patientId, Guid documentId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeReadAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        ClinicalDocument? document = await context.ClinicalDocuments
            .AsNoTracking()
            .Include(d => d.ClinicalRecordEntry)
            .FirstOrDefaultAsync(d =>
                d.Id == documentId
                && !d.DeletedAt.HasValue
                && d.ClinicalRecordEntry != null
                && d.ClinicalRecordEntry.PatientId == patientId
                && !d.ClinicalRecordEntry.DeletedAt.HasValue,
                cancellationToken);

        if (document is null)
            return NotFound();

        Stream content = await storageService.DownloadAsync(document.S3Key);
        return File(content, document.ContentType, document.FileName);
    }

    [HttpDelete("documents/{documentId:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid patientId, Guid documentId, CancellationToken cancellationToken)
    {
        ClinicalDocument? document = await context.ClinicalDocuments
            .Include(d => d.ClinicalRecordEntry)
            .FirstOrDefaultAsync(d =>
                d.Id == documentId
                && !d.DeletedAt.HasValue
                && d.ClinicalRecordEntry != null
                && d.ClinicalRecordEntry.PatientId == patientId
                && !d.ClinicalRecordEntry.DeletedAt.HasValue,
                cancellationToken);

        if (document is null)
            return NotFound();

        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeWriteAsync(actor, patientId, document.ClinicalRecordEntry!.AppointmentId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        if (actor.UserType != UserType.Admin && document.UploadedByUserId != actor.UserId)
            return Forbid();

        document.DeletedAt = DateTime.UtcNow;
        document.ClinicalRecordEntry!.UpdatedAt = DateTime.UtcNow;

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        record.UpdatedAt = document.ClinicalRecordEntry.UpdatedAt;

        await storageService.DeleteAsync(document.S3Key);
        await context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("access-grants")]
    public async Task<IActionResult> GetAccessGrants(Guid patientId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeGrantManagementAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        var grants = await context.ClinicalRecordAccessGrants
            .AsNoTracking()
            .Where(g => g.PatientId == patientId)
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(grants.Select(MapGrant));
    }

    [HttpPost("access-grants")]
    public async Task<IActionResult> CreateAccessGrant(
        Guid patientId,
        [FromBody] CreateClinicalRecordAccessGrantRequestDTO request,
        CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeGrantManagementAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        User? doctor = await context.Users.FirstOrDefaultAsync(u => u.Id == request.DoctorId, cancellationToken);
        if (doctor is null || doctor.UserType != UserType.Doctor)
            return BadRequest("Doctor not found.");

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);

        DateTime utcNow = DateTime.UtcNow;
        var grant = new ClinicalRecordAccessGrant
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            DoctorId = request.DoctorId,
            GrantedByPatientId = actor.UserId,
            Status = ClinicalRecordAccessGrantStatus.Active,
            Reason = request.Reason.Trim(),
            StartAt = request.StartAt ?? utcNow,
            EndAt = request.EndAt,
            CreatedAt = utcNow
        };

        record.UpdatedAt = utcNow;
        context.ClinicalRecordAccessGrants.Add(grant);
        await context.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, MapGrant(grant));
    }

    [HttpPatch("access-grants/{grantId:guid}/revoke")]
    public async Task<IActionResult> RevokeAccessGrant(Guid patientId, Guid grantId, CancellationToken cancellationToken)
    {
        var actor = GetActor();
        IActionResult? authorizationFailure = await AuthorizeAsync(
            () => authorizationService.AuthorizeGrantManagementAsync(actor, patientId, cancellationToken));

        if (authorizationFailure is not null)
            return authorizationFailure;

        ClinicalRecordAccessGrant? grant = await context.ClinicalRecordAccessGrants
            .FirstOrDefaultAsync(g => g.Id == grantId && g.PatientId == patientId, cancellationToken);

        if (grant is null)
            return NotFound();

        grant.Status = ClinicalRecordAccessGrantStatus.Revoked;
        grant.RevokedAt = DateTime.UtcNow;

        PatientClinicalRecord record = await EnsureClinicalRecordAsync(patientId, cancellationToken);
        record.UpdatedAt = grant.RevokedAt.Value;

        await context.SaveChangesAsync(cancellationToken);
        return Ok(MapGrant(grant));
    }

    private ClinicalRecordActor GetActor()
    {
        string? userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(ClaimTypes.Name);
        string? roleValue = User.FindFirstValue(ClaimTypes.Role);

        if (userIdValue is null || roleValue is null)
            throw new InvalidOperationException("Authenticated user is missing required claims.");

        return new ClinicalRecordActor
        {
            UserId = Guid.Parse(userIdValue),
            UserType = Enum.Parse<UserType>(roleValue, ignoreCase: true)
        };
    }

    private async Task<IActionResult?> AuthorizeAsync(Func<Task<ClinicalRecordAuthorizationResult>> authorize)
    {
        ClinicalRecordAuthorizationResult result = await authorize();
        if (result.Allowed)
            return null;

        return StatusCode(StatusCodes.Status403Forbidden, result.Error);
    }

    private async Task<PatientClinicalRecord> EnsureClinicalRecordAsync(Guid patientId, CancellationToken cancellationToken)
    {
        PatientClinicalRecord? record = await context.PatientClinicalRecords
            .FirstOrDefaultAsync(r => r.PatientId == patientId, cancellationToken);

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

    private static ClinicalRecordEntryResponseDTO MapEntry(ClinicalRecordEntry entry) => new()
    {
        Id = entry.Id,
        PatientId = entry.PatientId,
        AuthorUserId = entry.AuthorUserId,
        AuthorType = entry.AuthorType,
        EntryType = entry.EntryType,
        Title = entry.Title,
        Description = entry.Description,
        AppointmentId = entry.AppointmentId,
        AppointmentOccurredAt = entry.AppointmentOccurredAt,
        IsVisibleToPatient = entry.IsVisibleToPatient,
        CreatedAt = entry.CreatedAt,
        UpdatedAt = entry.UpdatedAt,
        Documents = entry.Documents
            .Where(d => !d.DeletedAt.HasValue)
            .Select(MapDocument)
            .ToList()
    };

    private static ClinicalDocumentResponseDTO MapDocument(ClinicalDocument document) => new()
    {
        Id = document.Id,
        FileName = document.FileName,
        ContentType = document.ContentType,
        SizeInBytes = document.SizeInBytes,
        CreatedAt = document.CreatedAt
    };

    private static ClinicalRecordAccessGrantResponseDTO MapGrant(ClinicalRecordAccessGrant grant) => new()
    {
        Id = grant.Id,
        DoctorId = grant.DoctorId,
        Reason = grant.Reason,
        Status = grant.Status,
        StartAt = grant.StartAt,
        EndAt = grant.EndAt,
        CreatedAt = grant.CreatedAt,
        RevokedAt = grant.RevokedAt
    };
}
