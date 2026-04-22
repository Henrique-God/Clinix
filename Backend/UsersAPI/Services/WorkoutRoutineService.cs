using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;

namespace UsersAPI.Services;

public class WorkoutRoutineService : IWorkoutRoutineService
{
    private readonly IUsersDbContext context;

    public WorkoutRoutineService(IUsersDbContext context)
    {
        this.context = context;
    }

    public Task<List<WorkoutRoutine>> ListAsync(Guid userId)
    {
        return context.WorkoutRoutines
            .AsNoTracking()
            .Include(r => r.Exercises.OrderBy(e => e.Order))
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();
    }

    public Task<WorkoutRoutine?> GetByIdAsync(Guid routineId, Guid userId)
    {
        return context.WorkoutRoutines
            .AsNoTracking()
            .Include(r => r.Exercises.OrderBy(e => e.Order))
            .FirstOrDefaultAsync(r => r.Id == routineId && r.UserId == userId);
    }

    public async Task<WorkoutRoutine> CreateAsync(Guid userId, string name, string? description, DayOfWeek? dayOfWeek)
    {
        DateTime now = DateTime.UtcNow;
        var routine = new WorkoutRoutine
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = name.Trim(),
            Description = description?.Trim(),
            DayOfWeek = dayOfWeek,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        context.WorkoutRoutines.Add(routine);
        await context.SaveChangesAsync();
        return routine;
    }

    public async Task<WorkoutRoutine?> UpdateAsync(Guid routineId, Guid userId, string name, string? description, DayOfWeek? dayOfWeek, bool isActive)
    {
        WorkoutRoutine? routine = await context.WorkoutRoutines
            .FirstOrDefaultAsync(r => r.Id == routineId && r.UserId == userId);

        if (routine == null)
            return null;

        routine.Name = name.Trim();
        routine.Description = description?.Trim();
        routine.DayOfWeek = dayOfWeek;
        routine.IsActive = isActive;
        routine.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        return routine;
    }

    public async Task<bool> DeleteAsync(Guid routineId, Guid userId)
    {
        WorkoutRoutine? routine = await context.WorkoutRoutines
            .FirstOrDefaultAsync(r => r.Id == routineId && r.UserId == userId);

        if (routine == null)
            return false;

        routine.IsActive = false;
        routine.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<WorkoutExercise> AddExerciseAsync(Guid routineId, Guid userId, WorkoutExercise exercise)
    {
        WorkoutRoutine? routine = await context.WorkoutRoutines
            .FirstOrDefaultAsync(r => r.Id == routineId && r.UserId == userId);

        if (routine == null)
            throw new InvalidOperationException("Routine not found.");

        exercise.Id = Guid.NewGuid();
        exercise.WorkoutRoutineId = routineId;
        exercise.CreatedAt = DateTime.UtcNow;

        context.WorkoutExercises.Add(exercise);
        routine.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        return exercise;
    }

    public async Task<WorkoutExercise?> UpdateExerciseAsync(Guid routineId, Guid exerciseId, Guid userId, WorkoutExercise updated)
    {
        bool routineExists = await context.WorkoutRoutines
            .AnyAsync(r => r.Id == routineId && r.UserId == userId);

        if (!routineExists)
            return null;

        WorkoutExercise? exercise = await context.WorkoutExercises
            .FirstOrDefaultAsync(e => e.Id == exerciseId && e.WorkoutRoutineId == routineId);

        if (exercise == null)
            return null;

        exercise.Name = updated.Name.Trim();
        exercise.Sets = updated.Sets;
        exercise.Reps = updated.Reps;
        exercise.DurationMinutes = updated.DurationMinutes;
        exercise.RestSeconds = updated.RestSeconds;
        exercise.Notes = updated.Notes?.Trim();
        exercise.Order = updated.Order;

        await context.SaveChangesAsync();
        return exercise;
    }

    public async Task<bool> DeleteExerciseAsync(Guid routineId, Guid exerciseId, Guid userId)
    {
        bool routineExists = await context.WorkoutRoutines
            .AnyAsync(r => r.Id == routineId && r.UserId == userId);

        if (!routineExists)
            return false;

        WorkoutExercise? exercise = await context.WorkoutExercises
            .FirstOrDefaultAsync(e => e.Id == exerciseId && e.WorkoutRoutineId == routineId);

        if (exercise == null)
            return false;

        context.WorkoutExercises.Remove(exercise);
        await context.SaveChangesAsync();
        return true;
    }
}
