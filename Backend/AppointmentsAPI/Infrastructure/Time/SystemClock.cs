using AppointmentsAPI.Application;

namespace AppointmentsAPI.Infrastructure.Time;

public class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
