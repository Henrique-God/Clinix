using AppointmentsAPI.Application;
using AppointmentsAPI.Data;
using AppointmentsAPI.Tests.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace AppointmentsAPI.Tests.Infrastructure;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"appointments-api-tests-{Guid.NewGuid():N}";

    public FakeUserDirectoryService FakeUserDirectoryService { get; } = new();
    public FakeClinicalRecordsGateway FakeClinicalRecordsGateway { get; } = new();
    public FakeIntegrationEventPublisher FakeIntegrationEventPublisher { get; } = new();
    public TestClock TestClock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        string contentRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../AppointmentsAPI"));

        builder.UseContentRoot(contentRoot);
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.ClearProviders());

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppointmentsDbContext>>();
            services.RemoveAll<AppointmentsDbContext>();
            services.RemoveAll<IUserDirectoryService>();
            services.RemoveAll<IClinicalRecordsGateway>();
            services.RemoveAll<IIntegrationEventPublisher>();
            services.RemoveAll<IClock>();

            services.AddDbContext<AppointmentsDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
            services.AddSingleton<IUserDirectoryService>(FakeUserDirectoryService);
            services.AddSingleton<IClinicalRecordsGateway>(FakeClinicalRecordsGateway);
            services.AddSingleton<IIntegrationEventPublisher>(FakeIntegrationEventPublisher);
            services.AddSingleton<IClock>(TestClock);

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                TestAuthHandler.SchemeName,
                _ => { });
        });
    }

    public async Task ResetDatabaseAsync()
    {
        FakeUserDirectoryService.Reset();
        FakeClinicalRecordsGateway.Reset();
        FakeIntegrationEventPublisher.Reset();
        TestClock.UtcNow = new DateTime(2026, 3, 14, 12, 0, 0, DateTimeKind.Utc);

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppointmentsDbContext>();
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
    }

    public async Task SeedAsync(Func<AppointmentsDbContext, Task> seedAction)
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppointmentsDbContext>();
        await seedAction(context);
        await context.SaveChangesAsync();
    }
}
