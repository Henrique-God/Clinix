namespace UsersAPI.Models;

public class WorkoutRoutine
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<WorkoutExercise> Exercises { get; set; } = new();
}
