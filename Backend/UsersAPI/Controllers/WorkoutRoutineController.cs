using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UsersAPI.Infrastructure;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;
using UsersAPI.Services;

namespace UsersAPI.Controllers;

[ApiController]
[Route("workout-routines")]
[Authorize(Roles = "User")]
[ServiceFilter(typeof(PremiumAuthorizationFilter))]
public class WorkoutRoutineController : ControllerBase
{
    private readonly IWorkoutRoutineService workoutService;

    public WorkoutRoutineController(IWorkoutRoutineService workoutService)
    {
        this.workoutService = workoutService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        Guid userId = GetUserId();
        List<WorkoutRoutine> routines = await workoutService.ListAsync(userId);
        return Ok(routines.Select(MapRoutine));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkoutRoutineRequestDTO request)
    {
        Guid userId = GetUserId();
        WorkoutRoutine routine = await workoutService.CreateAsync(
            userId, request.Name, request.Description, request.DayOfWeek);
        return StatusCode(201, MapRoutine(routine));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        Guid userId = GetUserId();
        WorkoutRoutine? routine = await workoutService.GetByIdAsync(id, userId);
        if (routine == null)
            return NotFound();
        return Ok(MapRoutine(routine));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkoutRoutineRequestDTO request)
    {
        Guid userId = GetUserId();
        WorkoutRoutine? routine = await workoutService.UpdateAsync(
            id, userId, request.Name, request.Description, request.DayOfWeek, request.IsActive);
        if (routine == null)
            return NotFound();
        return Ok(MapRoutine(routine));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        Guid userId = GetUserId();
        bool deleted = await workoutService.DeleteAsync(id, userId);
        if (!deleted)
            return NotFound();
        return NoContent();
    }

    [HttpPost("{id:guid}/exercises")]
    public async Task<IActionResult> AddExercise(Guid id, [FromBody] CreateWorkoutExerciseRequestDTO request)
    {
        Guid userId = GetUserId();
        try
        {
            var exercise = new WorkoutExercise
            {
                Name = request.Name,
                Sets = request.Sets,
                Reps = request.Reps,
                DurationMinutes = request.DurationMinutes,
                RestSeconds = request.RestSeconds,
                Notes = request.Notes,
                Order = request.Order
            };

            WorkoutExercise created = await workoutService.AddExerciseAsync(id, userId, exercise);
            return StatusCode(201, MapExercise(created));
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    [HttpPut("{id:guid}/exercises/{exerciseId:guid}")]
    public async Task<IActionResult> UpdateExercise(Guid id, Guid exerciseId, [FromBody] UpdateWorkoutExerciseRequestDTO request)
    {
        Guid userId = GetUserId();
        var exercise = new WorkoutExercise
        {
            Name = request.Name,
            Sets = request.Sets,
            Reps = request.Reps,
            DurationMinutes = request.DurationMinutes,
            RestSeconds = request.RestSeconds,
            Notes = request.Notes,
            Order = request.Order
        };

        WorkoutExercise? updated = await workoutService.UpdateExerciseAsync(id, exerciseId, userId, exercise);
        if (updated == null)
            return NotFound();
        return Ok(MapExercise(updated));
    }

    [HttpDelete("{id:guid}/exercises/{exerciseId:guid}")]
    public async Task<IActionResult> DeleteExercise(Guid id, Guid exerciseId)
    {
        Guid userId = GetUserId();
        bool deleted = await workoutService.DeleteExerciseAsync(id, exerciseId, userId);
        if (!deleted)
            return NotFound();
        return NoContent();
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
