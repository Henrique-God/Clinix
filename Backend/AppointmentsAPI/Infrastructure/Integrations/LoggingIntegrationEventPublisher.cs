using System.Text.Json;
using AppointmentsAPI.Application;

namespace AppointmentsAPI.Infrastructure.Integrations;

public class LoggingIntegrationEventPublisher : IIntegrationEventPublisher
{
    private readonly ILogger<LoggingIntegrationEventPublisher> logger;

    public LoggingIntegrationEventPublisher(ILogger<LoggingIntegrationEventPublisher> logger)
    {
        this.logger = logger;
    }

    public Task PublishAsync(string eventName, object payload, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Integration event emitted: {EventName} {Payload}", eventName, JsonSerializer.Serialize(payload));
        return Task.CompletedTask;
    }
}
