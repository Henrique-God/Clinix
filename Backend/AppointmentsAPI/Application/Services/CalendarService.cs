using System.Data;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Data;
using AppointmentsAPI.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace AppointmentsAPI.Application.Services;

public class CalendarService
{
    private readonly AppointmentsDbContext context;
    private readonly ICurrentActorAccessor currentActorAccessor;
    private readonly IClock clock;
    private readonly IUserDirectoryService userDirectoryService;
    private readonly IIntegrationEventPublisher integrationEventPublisher;

    public CalendarService(
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

    public async Task<AgendaEvent> CreateAsync(Guid doctorId, CreateCalendarEventRequestDto request, CancellationToken cancellationToken)
    {
        await EnsureDoctorCanManageCalendarAsync(doctorId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        DateTime startTime = NormalizeUtc(request.StartTime);
        DateTime endTime = NormalizeUtc(request.EndTime);

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);
        await EnsureNoCalendarConflictAsync(doctorId, startTime, endTime, null, utcNow, cancellationToken);

        AgendaEvent agendaEvent = AgendaEvent.CreateManual(
            doctorId,
            request.Type,
            request.Title,
            request.Description,
            startTime,
            endTime,
            utcNow);

        context.AgendaEvents.Add(agendaEvent);
        await context.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        await integrationEventPublisher.PublishAsync("CalendarEventCreated", new
        {
            doctorId,
            eventId = agendaEvent.Id,
            type = agendaEvent.Type.ToString()
        }, cancellationToken);

        return agendaEvent;
    }

    public async Task<AgendaEvent> UpdateAsync(Guid eventId, UpdateCalendarEventRequestDto request, CancellationToken cancellationToken)
    {
        AgendaEvent agendaEvent = await context.AgendaEvents
            .FirstOrDefaultAsync(item => item.Id == eventId && !item.DeletedAt.HasValue, cancellationToken)
            ?? throw DomainRuleException.NotFound("calendar_event_not_found", "Calendar event not found.");

        await EnsureDoctorCanManageCalendarAsync(agendaEvent.DoctorId, cancellationToken);

        DateTime utcNow = clock.UtcNow;
        DateTime startTime = NormalizeUtc(request.StartTime);
        DateTime endTime = NormalizeUtc(request.EndTime);

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(cancellationToken);
        await EnsureNoCalendarConflictAsync(agendaEvent.DoctorId, startTime, endTime, agendaEvent.Id, utcNow, cancellationToken);

        agendaEvent.UpdateManual(request.Type, request.Title, request.Description, startTime, endTime, utcNow);
        await context.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        return agendaEvent;
    }

    public async Task DeleteAsync(Guid eventId, CancellationToken cancellationToken)
    {
        AgendaEvent agendaEvent = await context.AgendaEvents
            .FirstOrDefaultAsync(item => item.Id == eventId && !item.DeletedAt.HasValue, cancellationToken)
            ?? throw DomainRuleException.NotFound("calendar_event_not_found", "Calendar event not found.");

        await EnsureDoctorCanManageCalendarAsync(agendaEvent.DoctorId, cancellationToken);

        agendaEvent.Delete(clock.UtcNow);
        await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<AgendaEvent>> GetDoctorAgendaAsync(Guid doctorId, CalendarQueryDto query, CancellationToken cancellationToken)
    {
        await EnsureDoctorCanManageCalendarAsync(doctorId, cancellationToken);
        (DateTime fromUtc, DateTime toUtc) = ResolveRange(query);

        return await context.AgendaEvents
            .AsNoTracking()
            .Include(item => item.Appointment)
            .Where(item =>
                item.DoctorId == doctorId
                && !item.DeletedAt.HasValue
                && item.EndTime > fromUtc
                && item.StartTime < toUtc)
            .OrderBy(item => item.StartTime)
            .ToListAsync(cancellationToken);
    }

    private async Task EnsureDoctorCanManageCalendarAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        CurrentActor actor = currentActorAccessor.GetRequiredActor();

        if (!actor.IsDoctor || actor.UserId != doctorId)
            throw DomainRuleException.Forbidden("doctor_not_authorized", "Doctors can only manage their own calendar.");

        UserDirectoryEntry? doctor = await userDirectoryService.GetUserAsync(doctorId, cancellationToken);
        if (doctor is null || !string.Equals(doctor.UserType, "Doctor", StringComparison.OrdinalIgnoreCase))
            throw DomainRuleException.Validation("doctor_not_found", "Doctor profile was not found in UsersAPI.");

        if (!doctor.IsActive)
            throw DomainRuleException.Conflict("doctor_inactive", "Inactive doctors cannot manage calendar events.");
    }

    private async Task EnsureNoCalendarConflictAsync(
        Guid doctorId,
        DateTime startTime,
        DateTime endTime,
        Guid? excludedEventId,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        bool hasManualEventConflict = await context.AgendaEvents.AnyAsync(item =>
                item.DoctorId == doctorId
                && item.AppointmentId == null
                && !item.DeletedAt.HasValue
                && item.BlocksScheduling
                && (!excludedEventId.HasValue || item.Id != excludedEventId.Value)
                && startTime < item.EndTime
                && endTime > item.StartTime,
            cancellationToken);

        if (hasManualEventConflict)
            throw DomainRuleException.Conflict("calendar_conflict", "This calendar event overlaps another blocking event.");

        bool hasAppointmentConflict = await context.Appointments.AnyAsync(item =>
                item.DoctorId == doctorId
                && startTime < item.EndTime
                && endTime > item.StartTime
                && (item.Status == AppointmentStatus.Accepted
                    || (item.Status == AppointmentStatus.PendingAcceptance 
                        && item.InvitationExpiresAt > utcNow 
                        && item.StartTime > utcNow)),
            cancellationToken);

        if (hasAppointmentConflict)
            throw DomainRuleException.Conflict("calendar_conflict", "This calendar event overlaps a platform appointment.");
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveRange(CalendarQueryDto query)
    {
        if (query.FromUtc.HasValue || query.ToUtc.HasValue)
        {
            if (!query.FromUtc.HasValue || !query.ToUtc.HasValue)
                throw DomainRuleException.Validation("invalid_range", "Both fromUtc and toUtc are required when querying by date range.");

            DateTime fromUtc = NormalizeUtc(query.FromUtc.Value);
            DateTime toUtc = NormalizeUtc(query.ToUtc.Value);

            if (toUtc <= fromUtc)
                throw DomainRuleException.Validation("invalid_range", "toUtc must be later than fromUtc.");

            return (fromUtc, toUtc);
        }

        DateTime referenceDate = query.ReferenceDateUtc.HasValue
            ? NormalizeUtc(query.ReferenceDateUtc.Value).Date
            : DateTime.UtcNow.Date;

        string view = string.IsNullOrWhiteSpace(query.View) ? "week" : query.View.Trim().ToLowerInvariant();

        return view switch
        {
            "day" => (referenceDate, referenceDate.AddDays(1)),
            "week" => ResolveWeekRange(referenceDate),
            _ => throw DomainRuleException.Validation("invalid_view", "Calendar view must be day, week, or an explicit fromUtc/toUtc range.")
        };
    }

    private static (DateTime FromUtc, DateTime ToUtc) ResolveWeekRange(DateTime referenceDate)
    {
        int difference = ((7 + (referenceDate.DayOfWeek - DayOfWeek.Monday)) % 7);
        DateTime fromUtc = referenceDate.AddDays(-difference);
        return (fromUtc, fromUtc.AddDays(7));
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
