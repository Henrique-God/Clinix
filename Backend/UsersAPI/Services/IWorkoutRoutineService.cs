using UsersAPI.Models;

namespace UsersAPI.Services;

public interface IWorkoutRoutineService
{
    Task<List<WorkoutRoutine>> ListAsync(Guid userId);
    Task<WorkoutRoutine?> GetByIdAsync(Guid routineId, Guid userId);
    Task<WorkoutRoutine> CreateAsync(Guid userId, string name, string? description, DayOfWeek? dayOfWeek);
    Task<WorkoutRoutine?> UpdateAsync(Guid routineId, Guid userId, string name, string? description, DayOfWeek? dayOfWeek, bool isActive);
    Task<bool> DeleteAsync(Guid routineId, Guid userId);
    Task<WorkoutExercise> AddExerciseAsync(Guid routineId, Guid userId, WorkoutExercise exercise);
    Task<WorkoutExercise?> UpdateExerciseAsync(Guid routineId, Guid exerciseId, Guid userId, WorkoutExercise exercise);
    Task<bool> DeleteExerciseAsync(Guid routineId, Guid exerciseId, Guid userId);
}
