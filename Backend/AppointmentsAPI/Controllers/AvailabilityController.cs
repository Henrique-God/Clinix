using AppointmentsAPI.Application;
using AppointmentsAPI.Application.Contracts;
using AppointmentsAPI.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AppointmentsAPI.Controllers;

[ApiController]
[Authorize]
public class AvailabilityController : ControllerBase
{
    private readonly AvailabilityService availabilityService;

    public AvailabilityController(AvailabilityService availabilityService)
    {
        this.availabilityService = availabilityService;
    }

    [Authorize(Roles = "Doctor")]
    [HttpPost("doctors/{doctorId:guid}/availability")]
    public async Task<ActionResult<AvailabilityResponseDto>> CreateAvailability(
        Guid doctorId,
        [FromBody] CreateAvailabilityRequestDto request,
        CancellationToken cancellationToken)
    {
        var availability = await availabilityService.CreateAsync(doctorId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, availability.ToResponse());
    }

    [Authorize(Roles = "Doctor")]
    [HttpPut("availability/{availabilityId:guid}")]
    public async Task<ActionResult<AvailabilityResponseDto>> UpdateAvailability(
        Guid availabilityId,
        [FromBody] UpdateAvailabilityRequestDto request,
        CancellationToken cancellationToken)
    {
        var availability = await availabilityService.UpdateAsync(availabilityId, request, cancellationToken);
        return Ok(availability.ToResponse());
    }

    [Authorize(Roles = "Doctor")]
    [HttpDelete("availability/{availabilityId:guid}")]
    public async Task<IActionResult> DeleteAvailability(Guid availabilityId, CancellationToken cancellationToken)
    {
        await availabilityService.DeleteAsync(availabilityId, cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "Doctor")]
    [HttpGet("doctors/{doctorId:guid}/availability")]
    public async Task<ActionResult<IReadOnlyCollection<AvailabilityResponseDto>>> GetAvailability(
        Guid doctorId,
        [FromQuery] AvailabilityQueryDto query,
        CancellationToken cancellationToken)
    {
        var availability = await availabilityService.ListAsync(doctorId, query, cancellationToken);
        return Ok(availability.Select(item => item.ToResponse()));
    }

    [HttpGet("doctors/{doctorId:guid}/available-slots")]
    public async Task<ActionResult<IReadOnlyCollection<AvailableSlotResponseDto>>> GetAvailableSlots(
        Guid doctorId,
        [FromQuery] AvailableSlotsQueryDto query,
        CancellationToken cancellationToken)
    {
        var slots = await availabilityService.GetPublicAvailableSlotsAsync(doctorId, query, cancellationToken);
        return Ok(slots);
    }
}
