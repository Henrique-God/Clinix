using AppointmentsAPI.Application;

namespace AppointmentsAPI.Tests.Infrastructure;

public class TestClock : IClock
{
    public DateTime UtcNow { get; set; } = new(2026, 3, 14, 12, 0, 0, DateTimeKind.Utc);
}
