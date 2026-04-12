namespace UsersAPI.Models.DTOs;

public class WorkoutRoutineResponseDTO
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<WorkoutExerciseResponseDTO> Exercises { get; set; } = new();
}

public class WorkoutExerciseResponseDTO
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int Order { get; set; }
}

public class CreateWorkoutRoutineRequestDTO
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
}

public class UpdateWorkoutRoutineRequestDTO
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public bool IsActive { get; set; }
}

public class CreateWorkoutExerciseRequestDTO
{
    public string Name { get; set; } = string.Empty;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int Order { get; set; }
}

public class UpdateWorkoutExerciseRequestDTO
{
    public string Name { get; set; } = string.Empty;
    public int Sets { get; set; }
    public int Reps { get; set; }
    public int? DurationMinutes { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
    public int Order { get; set; }
}
