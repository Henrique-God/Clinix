using AppointmentsAPI.Application;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointmentsAPI.Controllers;

[ApiController]
[Route("appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly AppointmentService appointmentService;
    private readonly IClock clock;

    public AppointmentsController(AppointmentService appointmentService, IClock clock)
    {
        this.appointmentService = appointmentService;
        this.clock = clock;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy", service = "AppointmentsAPI" });

    [HttpGet("{appointmentId:guid}")]
    public async Task<ActionResult<AppointmentResponseDto>> GetById(Guid appointmentId, CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.GetByIdForCurrentActorAsync(appointmentId, cancellationToken);
        return Ok(appointment.ToResponse(clock.UtcNow));
    }

    [HttpPost("invite")]
    public async Task<ActionResult<AppointmentResponseDto>> Invite(
        [FromBody] CreateAppointmentInviteRequestDto request,
        CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.InviteAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { appointmentId = appointment.Id }, appointment.ToResponse(clock.UtcNow));
    }

    [HttpPost("{appointmentId:guid}/accept")]
    public async Task<ActionResult<AppointmentResponseDto>> Accept(
        Guid appointmentId,
        [FromBody] RespondToInvitationRequestDto? request,
        CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.AcceptAsync(appointmentId, request, cancellationToken);
        return Ok(appointment.ToResponse(clock.UtcNow));
    }

    [HttpPost("{appointmentId:guid}/reject")]
    public async Task<ActionResult<AppointmentResponseDto>> Reject(
        Guid appointmentId,
        [FromBody] RespondToInvitationRequestDto? request,
        CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.RejectAsync(appointmentId, request, cancellationToken);
        return Ok(appointment.ToResponse(clock.UtcNow));
    }

    [HttpPost("{appointmentId:guid}/cancel")]
    public async Task<ActionResult<AppointmentResponseDto>> Cancel(
        Guid appointmentId,
        [FromBody] CancelAppointmentRequestDto? request,
        CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.CancelAsync(appointmentId, request, cancellationToken);
        return Ok(appointment.ToResponse(clock.UtcNow));
    }

    [Authorize(Roles = "Doctor")]
    [HttpPost("{appointmentId:guid}/complete")]
    public async Task<ActionResult<AppointmentResponseDto>> Complete(
        Guid appointmentId,
        [FromBody] CompleteAppointmentRequestDto? request,
        CancellationToken cancellationToken)
    {
        var appointment = await appointmentService.CompleteAsync(appointmentId, request, cancellationToken);
        return Ok(appointment.ToResponse(clock.UtcNow));
    }

    [Authorize(Roles = "User")]
    [HttpGet("patient")]
    public async Task<ActionResult<IReadOnlyCollection<AppointmentResponseDto>>> GetPatientAppointments(
        [FromQuery] AppointmentListQueryDto query,
        CancellationToken cancellationToken)
    {
        var appointments = await appointmentService.GetPatientAppointmentsAsync(query, cancellationToken);
        return Ok(appointments.Select(item => item.ToResponse(clock.UtcNow)));
    }

    [Authorize(Roles = "Doctor")]
    [HttpGet("doctor")]
    public async Task<ActionResult<IReadOnlyCollection<AppointmentResponseDto>>> GetDoctorAppointments(
        [FromQuery] AppointmentListQueryDto query,
        CancellationToken cancellationToken)
    {
        var appointments = await appointmentService.GetDoctorAppointmentsAsync(query, cancellationToken);
        return Ok(appointments.Select(item => item.ToResponse(clock.UtcNow)));
    }
}
