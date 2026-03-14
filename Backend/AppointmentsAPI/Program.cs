using System.Text.Json.Serialization;
using AppointmentsAPI.Application;
using AppointmentsAPI.Application.Services;
using AppointmentsAPI.Data;
using AppointmentsAPI.Infrastructure.Api;
using AppointmentsAPI.Infrastructure.Auth;
using AppointmentsAPI.Infrastructure.Integrations;
using AppointmentsAPI.Infrastructure.Security;
using AppointmentsAPI.Infrastructure.Time;
using Clinix.Shared.Auth;
using Microsoft.EntityFrameworkCore;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddDbContext<AppointmentsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<UsersApiOptions>(builder.Configuration.GetSection(UsersApiOptions.SectionName));
builder.Services.Configure<ClinicalRecordsOptions>(builder.Configuration.GetSection(ClinicalRecordsOptions.SectionName));
builder.Services.Configure<InternalServiceSecurityOptions>(builder.Configuration.GetSection(InternalServiceSecurityOptions.SectionName));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentActorAccessor, HttpContextCurrentActorAccessor>();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IIntegrationEventPublisher, LoggingIntegrationEventPublisher>();
builder.Services.AddSingleton<IInternalRequestAuthorizer, InternalRequestAuthorizer>();

builder.Services.AddHttpClient<IUserDirectoryService, UsersApiDirectoryService>((serviceProvider, client) =>
{
    UsersApiOptions options = serviceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<UsersApiOptions>>()
        .Value;

    if (!string.IsNullOrWhiteSpace(options.BaseUrl))
        client.BaseAddress = new Uri(options.BaseUrl);
});

builder.Services.AddHttpClient<IClinicalRecordsGateway, ClinicalRecordsGateway>((serviceProvider, client) =>
{
    ClinicalRecordsOptions options = serviceProvider
        .GetRequiredService<Microsoft.Extensions.Options.IOptions<ClinicalRecordsOptions>>()
        .Value;

    if (!string.IsNullOrWhiteSpace(options.BaseUrl))
        client.BaseAddress = new Uri(options.BaseUrl);
});

builder.Services.AddScoped<AppointmentService>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddScoped<CalendarService>();

builder.Services.AddJwtValidation(builder.Configuration);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Clinix - Appointments Service",
        Version = "v1"
    });
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Digite: Bearer {seu token}"
    });
    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

WebApplication app = builder.Build();

if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppointmentsDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
