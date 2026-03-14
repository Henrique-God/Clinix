using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointmentsAPI.Controllers;

[ApiController]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly CalendarService calendarService;

    public CalendarController(CalendarService calendarService)
    {
        this.calendarService = calendarService;
    }

    [Authorize(Roles = "Doctor")]
    [HttpPost("doctors/{doctorId:guid}/calendar-events")]
    public async Task<ActionResult<AgendaEventResponseDto>> CreateCalendarEvent(
        Guid doctorId,
        [FromBody] CreateCalendarEventRequestDto request,
        CancellationToken cancellationToken)
    {
        var agendaEvent = await calendarService.CreateAsync(doctorId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, agendaEvent.ToResponse());
    }

    [Authorize(Roles = "Doctor")]
    [HttpPut("calendar-events/{eventId:guid}")]
    public async Task<ActionResult<AgendaEventResponseDto>> UpdateCalendarEvent(
        Guid eventId,
        [FromBody] UpdateCalendarEventRequestDto request,
        CancellationToken cancellationToken)
    {
        var agendaEvent = await calendarService.UpdateAsync(eventId, request, cancellationToken);
        return Ok(agendaEvent.ToResponse());
    }

    [Authorize(Roles = "Doctor")]
    [HttpDelete("calendar-events/{eventId:guid}")]
    public async Task<IActionResult> DeleteCalendarEvent(Guid eventId, CancellationToken cancellationToken)
    {
        await calendarService.DeleteAsync(eventId, cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "Doctor")]
    [HttpGet("doctors/{doctorId:guid}/calendar")]
    public async Task<ActionResult<IReadOnlyCollection<AgendaEventResponseDto>>> GetCalendar(
        Guid doctorId,
        [FromQuery] CalendarQueryDto query,
        CancellationToken cancellationToken)
    {
        var agenda = await calendarService.GetDoctorAgendaAsync(doctorId, query, cancellationToken);
        return Ok(agenda.Select(item => item.ToResponse()));
    }
}
