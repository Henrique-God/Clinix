namespace UsersAPI.Models;

public class WorkoutExercise
{
    public Guid Id { get; set; }
    public Guid WorkoutRoutineId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int Order { get; set; }
    public DateTime CreatedAt { get; set; }
}
