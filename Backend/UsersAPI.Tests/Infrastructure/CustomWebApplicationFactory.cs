using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using UsersAPI.Data;
using UsersAPI.Services;

namespace UsersAPI.Tests.Infrastructure;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = $"users-api-tests-{Guid.NewGuid():N}";

    public FakeUserService FakeUserService { get; } = new();
    public FakeAppointmentRelationshipService FakeAppointmentRelationshipService { get; } = new();
    public FakeS3StorageService FakeS3StorageService { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<UsersDbContext>>();
            services.RemoveAll<UsersDbContext>();
            services.RemoveAll<IUsersDbContext>();
            services.RemoveAll<IUserService>();
            services.RemoveAll<IJwtService>();
            services.RemoveAll<IAppointmentRelationshipService>();
            services.RemoveAll<IClinicalRecordAuthorizationService>();
            services.RemoveAll<IS3StorageService>();

            services.AddDbContext<UsersDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
            services.AddScoped<IUsersDbContext>(sp => sp.GetRequiredService<UsersDbContext>());
            services.AddSingleton<IUserService>(FakeUserService);
            services.AddSingleton<IJwtService, TestJwtService>();
            services.AddSingleton<IAppointmentRelationshipService>(FakeAppointmentRelationshipService);
            services.AddScoped<IClinicalRecordAuthorizationService, ClinicalRecordAuthorizationService>();
            services.AddSingleton<IS3StorageService>(FakeS3StorageService);

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                TestAuthHandler.SchemeName,
                _ => { });
        });
    }

    public async Task SeedAsync(Func<UsersDbContext, Task> seedAction)
    {
        using IServiceScope scope = Services.CreateScope();
        UsersDbContext context = scope.ServiceProvider.GetRequiredService<UsersDbContext>();
        await seedAction(context);
        await context.SaveChangesAsync();
    }

    public async Task ResetDatabaseAsync()
    {
        FakeUserService.Reset();
        FakeAppointmentRelationshipService.Reset();
        FakeS3StorageService.Reset();
        using IServiceScope scope = Services.CreateScope();
        UsersDbContext context = scope.ServiceProvider.GetRequiredService<UsersDbContext>();
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
    }
}
