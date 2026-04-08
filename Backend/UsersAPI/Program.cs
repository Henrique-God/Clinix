using UsersAPI.Data;
using UsersAPI.Services;
using Clinix.Shared.Auth;
using Amazon;
using Amazon.S3;
using Microsoft.EntityFrameworkCore;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<UsersDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IUsersDbContext>(sp => sp.GetRequiredService<UsersDbContext>());
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IClinicalRecordAuthorizationService, ClinicalRecordAuthorizationService>();
builder.Services.AddScoped<IS3StorageService, S3StorageService>();
builder.Services.Configure<AppointmentsOptions>(builder.Configuration.GetSection(AppointmentsOptions.SectionName));
builder.Services.AddHttpClient<IAppointmentRelationshipService, AppointmentRelationshipService>((sp, client) =>
{
    AppointmentsOptions options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<AppointmentsOptions>>().Value;
    if (!string.IsNullOrWhiteSpace(options.BaseUrl))
        client.BaseAddress = new Uri(options.BaseUrl);
});
builder.Services.AddSingleton<IAmazonS3>(_ =>
{
    string region = builder.Configuration["Aws:Region"] ?? "us-east-1";
    return new AmazonS3Client(RegionEndpoint.GetBySystemName(region));
});

builder.Services.AddJwtValidation(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        string[] configuredOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        string[] defaultOrigins =
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ];
        string[] allowedOrigins = configuredOrigins.Length > 0 ? configuredOrigins : defaultOrigins;

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Clinix – Users Service",
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
    using IServiceScope scope = app.Services.CreateScope();
    UsersDbContext db = scope.ServiceProvider.GetRequiredService<UsersDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
