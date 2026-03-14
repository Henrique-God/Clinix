namespace AppointmentsAPI.Domain;

public static class SchedulingRules
{
    public static void ValidateRange(DateTime startTime, DateTime endTime, string resourceName)
    {
        if (startTime >= endTime)
            throw DomainRuleException.Validation("invalid_time_range", $"{resourceName} start time must be earlier than the end time.");

        if ((endTime - startTime) < TimeSpan.FromMinutes(15))
            throw DomainRuleException.Validation("minimum_duration_not_met", $"{resourceName} duration must be at least 15 minutes.");

        if ((endTime - startTime) > TimeSpan.FromHours(12))
            throw DomainRuleException.Validation("maximum_duration_exceeded", $"{resourceName} duration must be shorter than 12 hours.");
    }

    public static bool Overlaps(DateTime startA, DateTime endA, DateTime startB, DateTime endB) =>
        startA < endB && endA > startB;

    public static string RequiredTrimmed(string? value, string fieldName, int maxLength)
    {
        string normalized = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(normalized))
            throw DomainRuleException.Validation("required_field_missing", $"{fieldName} is required.");

        if (normalized.Length > maxLength)
            throw DomainRuleException.Validation("field_too_long", $"{fieldName} must be {maxLength} characters or less.");

        return normalized;
    }

    public static string? OptionalTrimmed(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        string normalized = value.Trim();
        if (normalized.Length > maxLength)
            throw DomainRuleException.Validation("field_too_long", $"Field must be {maxLength} characters or less.");

        return normalized;
    }
}
