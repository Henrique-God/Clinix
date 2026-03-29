namespace AppointmentsAPI.Application;

public static class TimePrecision
{
    public static DateTime NormalizeSchedulingUtc(DateTime value)
    {
        DateTime utcValue = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        return new DateTime(
            utcValue.Year,
            utcValue.Month,
            utcValue.Day,
            utcValue.Hour,
            utcValue.Minute,
            0,
            DateTimeKind.Utc);
    }
}
