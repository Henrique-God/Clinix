using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;

namespace UsersAPI.Controllers;

[ApiController]
[Route("patients/{patientId:guid}/workout-routines")]
[Authorize(Roles = "Doctor")]
public class PatientWorkoutRoutineController : ControllerBase
{
    private readonly IUsersDbContext context;

    public PatientWorkoutRoutineController(IUsersDbContext context)
    {
        this.context = context;
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid patientId)
    {
        Guid doctorId = GetUserId();

        bool hasGrant = await context.ClinicalRecordAccessGrants
            .AnyAsync(g => g.PatientId == patientId
                        && g.DoctorId == doctorId
                        && g.Status == ClinicalRecordAccessGrantStatus.Active);

        if (!hasGrant)
            return Forbid();

        List<WorkoutRoutine> routines = await context.WorkoutRoutines
            .AsNoTracking()
            .Include(r => r.Exercises.OrderBy(e => e.Order))
            .Where(r => r.UserId == patientId && r.IsActive)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();

        return Ok(routines.Select(MapRoutine));
    }

    private Guid GetUserId()
    {
        string? userIdValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdValue, out Guid userId))
            throw new UnauthorizedAccessException();
        return userId;
    }

    private static WorkoutRoutineResponseDTO MapRoutine(WorkoutRoutine routine) => new()
    {
        Id = routine.Id,
        Name = routine.Name,
        Description = routine.Description,
        DayOfWeek = routine.DayOfWeek,
        IsActive = routine.IsActive,
        CreatedAt = routine.CreatedAt,
        UpdatedAt = routine.UpdatedAt,
        Exercises = routine.Exercises.Select(MapExercise).ToList()
    };

    private static WorkoutExerciseResponseDTO MapExercise(WorkoutExercise exercise) => new()
    {
        Id = exercise.Id,
        Name = exercise.Name,
        Sets = exercise.Sets,
        Reps = exercise.Reps,
        DurationMinutes = exercise.DurationMinutes,
        RestSeconds = exercise.RestSeconds,
        Notes = exercise.Notes,
        Order = exercise.Order
    };
}
