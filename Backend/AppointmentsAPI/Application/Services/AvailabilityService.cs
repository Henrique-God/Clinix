using System.Data;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Data;
using AppointmentsAPI.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace AppointmentsAPI.Application.Services;

public class AvailabilityService
{
    private readonly AppointmentsDbContext context;
    private readonly ICurrentActorAccessor currentActorAccessor;
    private readonly IClock clock;
    private readonly IUserDirectoryService userDirectoryService;
    private readonly IIntegrationEventPublisher integrationEventPublisher;

    public AvailabilityService(
        AppointmentsDbContext context,
        ICurrentActorAccessor currentActorAccessor,
        IClock clock,
        IUserDirectoryService userDirectoryService,
        IIntegrationEventPublisher integrationEventPublisher)
    {
        this.context = context;
        this.currentActorAccessor = currentActorAccessor;
        this.clock = clock;
        this.userDirectoryService = userDirectoryService;
        this.integrationEventPublisher = integrationEventPublisher;
    }

    public async Task<DoctorAvailability> CreateAsync(Guid doctorId, CreateAvailabilityRequestDto request, CancellationToken cancellationToken)
    {
        await EnsureDoctorCanManageResourcesAsync(doctorId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        DateTime startTime = NormalizeUtc(request.StartTime);
        DateTime endTime = NormalizeUtc(request.EndTime);

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);
        await EnsureNoAvailabilityOverlapAsync(doctorId, startTime, endTime, null, cancellationToken);

        DoctorAvailability availability = DoctorAvailability.Create(doctorId, startTime, endTime, request.Visibility, utcNow);
        context.DoctorAvailabilities.Add(availability);
        await context.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("DoctorAvailabilityUpdated", new
        {
            doctorId,
            availabilityId = availability.Id,
            action = "created"
        }, cancellationToken);

        return availability;
    }

    public async Task<DoctorAvailability> UpdateAsync(Guid availabilityId, UpdateAvailabilityRequestDto request, CancellationToken cancellationToken)
    {
        DoctorAvailability availability = await context.DoctorAvailabilities
            .FirstOrDefaultAsync(item => item.Id == availabilityId && !item.DeletedAt.HasValue, cancellationToken)
            ?? throw DomainRuleException.NotFound("availability_not_found", "Availability slot not found.");

        await EnsureDoctorCanManageResourcesAsync(availability.DoctorId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        DateTime startTime = NormalizeUtc(request.StartTime);
        DateTime endTime = NormalizeUtc(request.EndTime);

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);
        await EnsureNoAvailabilityOverlapAsync(availability.DoctorId, startTime, endTime, availability.Id, cancellationToken);

        availability.Update(startTime, endTime, request.Visibility, utcNow);
        await context.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("DoctorAvailabilityUpdated", new
        {
            doctorId = availability.DoctorId,
            availabilityId = availability.Id,
            action = "updated"
        }, cancellationToken);

        return availability;
    }

    public async Task DeleteAsync(Guid availabilityId, CancellationToken cancellationToken)
    {
        DoctorAvailability availability = await context.DoctorAvailabilities
            .FirstOrDefaultAsync(item => item.Id == availabilityId && !item.DeletedAt.HasValue, cancellationToken)
            ?? throw DomainRuleException.NotFound("availability_not_found", "Availability slot not found.");

        await EnsureDoctorCanManageResourcesAsync(availability.DoctorId, cancellationToken);

        availability.Delete(clock.UtcNow);
        await context.SaveChangesAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("DoctorAvailabilityUpdated", new
        {
            doctorId = availability.DoctorId,
            availabilityId = availability.Id,
            action = "deleted"
        }, cancellationToken);
    }

    public async Task<IReadOnlyCollection<DoctorAvailability>> ListAsync(Guid doctorId, AvailabilityQueryDto query, CancellationToken cancellationToken)
    {
        await EnsureDoctorCanManageResourcesAsync(doctorId, cancellationToken);

        IQueryable<DoctorAvailability> availabilities = context.DoctorAvailabilities
            .AsNoTracking()
            .Where(item => item.DoctorId == doctorId && !item.DeletedAt.HasValue);

        if (query.FromUtc.HasValue)
        {
            DateTime fromUtc = NormalizeUtc(query.FromUtc.Value);
            availabilities = availabilities.Where(item => item.EndTime >= fromUtc);
        }

        if (query.ToUtc.HasValue)
        {
            DateTime toUtc = NormalizeUtc(query.ToUtc.Value);
            availabilities = availabilities.Where(item => item.StartTime <= toUtc);
        }

        if (query.Visibility.HasValue)
            availabilities = availabilities.Where(item => item.Visibility == query.Visibility.Value);

        return await availabilities
            .OrderBy(item => item.StartTime)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<AvailableSlotResponseDto>> GetPublicAvailableSlotsAsync(Guid doctorId, AvailableSlotsQueryDto query, CancellationToken cancellationToken)
    {
        await EnsureActiveDoctorAsync(doctorId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        DateTime fromUtc = NormalizeUtc(query.FromUtc);
        DateTime toUtc = NormalizeUtc(query.ToUtc);

        if (toUtc <= fromUtc)
            throw DomainRuleException.Validation("invalid_range", "The end of the range must be later than the start.");

        DateTime effectiveFromUtc = fromUtc < utcNow ? utcNow : fromUtc;
        TimeSpan slotDuration = TimeSpan.FromMinutes(query.DurationMinutes);

        List<DoctorAvailability> publicAvailabilities = await context.DoctorAvailabilities
            .AsNoTracking()
            .Where(item =>
                item.DoctorId == doctorId
                && !item.DeletedAt.HasValue
                && item.Visibility == ScheduleVisibility.Public
                && item.EndTime > effectiveFromUtc
                && item.StartTime < toUtc)
            .OrderBy(item => item.StartTime)
            .ToListAsync(cancellationToken);

        List<(DateTime StartTime, DateTime EndTime)> blockingIntervals = await GetBlockingIntervalsAsync(
            doctorId,
            effectiveFromUtc,
            toUtc,
            utcNow,
            cancellationToken);

        var slots = new List<AvailableSlotResponseDto>();

        foreach (DoctorAvailability availability in publicAvailabilities)
        {
            DateTime availabilityStart = availability.StartTime < effectiveFromUtc ? effectiveFromUtc : availability.StartTime;
            DateTime availabilityEnd = availability.EndTime > toUtc ? toUtc : availability.EndTime;

            if (availabilityEnd <= availabilityStart)
                continue;

            List<(DateTime StartTime, DateTime EndTime)> freeSegments = [(availabilityStart, availabilityEnd)];

            foreach ((DateTime blockStart, DateTime blockEnd) in blockingIntervals)
            {
                var nextSegments = new List<(DateTime StartTime, DateTime EndTime)>();

                foreach ((DateTime segmentStart, DateTime segmentEnd) in freeSegments)
                {
                    if (!SchedulingRules.Overlaps(segmentStart, segmentEnd, blockStart, blockEnd))
                    {
                        nextSegments.Add((segmentStart, segmentEnd));
                        continue;
                    }

                    if (blockStart > segmentStart)
                        nextSegments.Add((segmentStart, blockStart < segmentEnd ? blockStart : segmentEnd));

                    if (blockEnd < segmentEnd)
                        nextSegments.Add((blockEnd > segmentStart ? blockEnd : segmentStart, segmentEnd));
                }

                freeSegments = nextSegments
                    .Where(item => item.EndTime > item.StartTime)
                    .OrderBy(item => item.StartTime)
                    .ToList();

                if (freeSegments.Count == 0)
                    break;
            }

            foreach ((DateTime segmentStart, DateTime segmentEnd) in freeSegments)
            {
                for (DateTime slotStart = segmentStart; slotStart + slotDuration <= segmentEnd; slotStart = slotStart.Add(slotDuration))
                {
                    slots.Add(availability.ToResponse(slotStart, slotStart.Add(slotDuration)));
                }
            }
        }

        return slots;
    }

    private async Task<List<(DateTime StartTime, DateTime EndTime)>> GetBlockingIntervalsAsync(
        Guid doctorId,
        DateTime fromUtc,
        DateTime toUtc,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        List<(DateTime StartTime, DateTime EndTime)> intervals = await context.AgendaEvents
            .AsNoTracking()
            .Where(item =>
                item.DoctorId == doctorId
                && item.AppointmentId == null
                && !item.DeletedAt.HasValue
                && item.BlocksScheduling
                && item.EndTime > fromUtc
                && item.StartTime < toUtc)
            .Select(item => new ValueTuple<DateTime, DateTime>(item.StartTime, item.EndTime))
            .ToListAsync(cancellationToken);

        List<(DateTime StartTime, DateTime EndTime)> appointmentIntervals = await context.Appointments
            .AsNoTracking()
            .Where(item =>
                item.DoctorId == doctorId
                && item.EndTime > fromUtc
                && item.StartTime < toUtc
                && (item.Status == AppointmentStatus.Accepted
                    || (item.Status == AppointmentStatus.PendingAcceptance && item.InvitationExpiresAt > utcNow && item.StartTime > utcNow)))
            .Select(item => new ValueTuple<DateTime, DateTime>(item.StartTime, item.EndTime))
            .ToListAsync(cancellationToken);

        intervals.AddRange(appointmentIntervals);

        return intervals
            .OrderBy(item => item.StartTime)
            .ToList();
    }

    private async Task EnsureDoctorCanManageResourcesAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();

        if (!actor.IsDoctor || actor.UserId != doctorId)
            throw DomainRuleException.Forbidden("doctor_not_authorized", "Doctors can only manage their own availability.");

        await EnsureActiveDoctorAsync(doctorId, cancellationToken);
    }

    private async Task<UserDirectoryEntry> EnsureActiveDoctorAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        UserDirectoryEntry? doctor = await userDirectoryService.GetUserAsync(doctorId, cancellationToken);
        if (doctor is null || !string.Equals(doctor.UserType, "Doctor", StringComparison.OrdinalIgnoreCase))
            throw DomainRuleException.Validation("doctor_not_found", "Doctor profile was not found in UsersAPI.");

        if (!doctor.IsActive)
            throw DomainRuleException.Conflict("doctor_inactive", "Inactive doctors cannot expose availability.");

        return doctor;
    }

    private async Task EnsureNoAvailabilityOverlapAsync(
        Guid doctorId,
        DateTime startTime,
        DateTime endTime,
        Guid? excludeAvailabilityId,
        CancellationToken cancellationToken)
    {
        bool hasOverlap = await context.DoctorAvailabilities.AnyAsync(item =>
                item.DoctorId == doctorId
                && !item.DeletedAt.HasValue
                && (!excludeAvailabilityId.HasValue || item.Id != excludeAvailabilityId.Value)
                && SchedulingRules.Overlaps(startTime, endTime, item.StartTime, item.EndTime),
            cancellationToken);

        if (hasOverlap)
            throw DomainRuleException.Conflict("availability_overlap", "Availability windows cannot overlap.");
    }

    private Task<IDbContextTransaction?> BeginTransactionIfNeededAsync(CancellationToken cancellationToken)
    {
        if (!context.Database.IsRelational())
            return Task.FromResult<IDbContextTransaction?>(null);

        return context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)!;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}
