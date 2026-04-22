using AppointmentsAPI.Application;

namespace AppointmentsAPI.Tests.Infrastructure;

public class FakeIntegrationEventPublisher : IIntegrationEventPublisher
{
    public List<string> Events { get; } = new();

    public Task PublishAsync(string eventName, object payload, CancellationToken cancellationToken = default)
    {
        Events.Add(eventName);
        return Task.CompletedTask;
    }

    public void Reset() => Events.Clear();
}
