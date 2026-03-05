using UsersAPI.Data;
using UsersAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace UsersAPI.Controllers;

[ApiController]
[Route("clinical-records")]
[Authorize]
public class ClinicalRecordController : ControllerBase
{
    private readonly IUsersDbContext context;

    public ClinicalRecordController(IUsersDbContext context)
    {
        this.context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var records = await context.ClinicalRecords
            .Where(r => r.PatientId == userId || r.ProfessionalId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(records);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ClinicalRecord record)
    {
        record.Id = Guid.NewGuid();
        record.CreatedAt = DateTime.UtcNow;

        context.ClinicalRecords.Add(record);
        await context.SaveChangesAsync();

        return StatusCode(201, record);
    }
}
