using AppointmentsAPI.Data;
using AppointmentsAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointmentsAPI.Controllers;

[ApiController]
[Route("appointments")]
public class AppointmentsController : ControllerBase
{
    private readonly AppointmentsDbContext context;

    public AppointmentsController(AppointmentsDbContext context)
    {
        this.context = context;
    }

    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy", service = "AppointmentsAPI" });

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var appointments = await context.Appointments
            .OrderByDescending(a => a.StartTime)
            .ToListAsync();

        return Ok(appointments);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Appointment appointment)
    {
        appointment.Id = Guid.NewGuid();
        appointment.CreatedAt = DateTime.UtcNow;
        appointment.Status = AppointmentStatus.Scheduled;

        context.Appointments.Add(appointment);
        await context.SaveChangesAsync();

        return StatusCode(201, appointment);
    }
}
