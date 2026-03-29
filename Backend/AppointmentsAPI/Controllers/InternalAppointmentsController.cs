using AppointmentsAPI.Application.Services;
using AppointmentsAPI.Infrastructure.Security;
using Microsoft.AspNetCore.Mvc;

namespace AppointmentsAPI.Controllers;

[ApiController]
[Route("internal/appointments")]
public class InternalAppointmentsController : ControllerBase
{
    private readonly AppointmentService appointmentService;
    private readonly IInternalRequestAuthorizer internalRequestAuthorizer;

    public InternalAppointmentsController(
        AppointmentService appointmentService,
        IInternalRequestAuthorizer internalRequestAuthorizer)
    {
        this.appointmentService = appointmentService;
        this.internalRequestAuthorizer = internalRequestAuthorizer;
    }

    [HttpGet("relationship-check")]
    public async Task<IActionResult> RelationshipCheck(
        [FromQuery] Guid patientId,
        [FromQuery] Guid doctorId,
        [FromQuery] string mode,
        CancellationToken cancellationToken)
    {
        internalRequestAuthorizer.EnsureAuthorized(Request);

        bool completedOnly = mode.Trim().ToLowerInvariant() switch
        {
            "completed" => true,
            "scheduled-or-completed" => false,
            _ => throw AppointmentsAPI.Domain.DomainRuleException.Validation("invalid_relationship_mode", "Mode must be completed or scheduled-or-completed.")
        };

        bool hasRelationship = await appointmentService.HasRelationshipAsync(patientId, doctorId, completedOnly, cancellationToken);
        return Ok(new { hasRelationship });
    }

    [HttpGet("{appointmentId:guid}/ownership")]
    public async Task<IActionResult> Ownership(
        Guid appointmentId,
        [FromQuery] Guid patientId,
        [FromQuery] Guid doctorId,
        CancellationToken cancellationToken)
    {
        internalRequestAuthorizer.EnsureAuthorized(Request);

        bool matches = await appointmentService.IsOwnedCompletedAppointmentAsync(
            appointmentId,
            patientId,
            doctorId,
            cancellationToken);

        return Ok(new { matches });
    }
}
