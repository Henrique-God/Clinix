using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UsersAPI.Data;
using UsersAPI.Models;
using UsersAPI.Models.DTOs;

namespace UsersAPI.Controllers;

[ApiController]
[Route("directory")]
[Authorize]
public class DirectoryController : ControllerBase
{
    private readonly IUsersDbContext context;

    public DirectoryController(IUsersDbContext context)
    {
        this.context = context;
    }

    [HttpGet("users/{userId:guid}")]
    public async Task<IActionResult> GetUser(Guid userId, CancellationToken cancellationToken)
    {
        User? user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId && item.IsActive, cancellationToken);

        if (user is null)
            return NotFound();

        DoctorProfile? doctorProfile = null;
        if (user.UserType == UserType.Doctor)
        {
            doctorProfile = await context.DoctorProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == user.Id, cancellationToken);
        }

        return Ok(MapDirectoryUser(user, doctorProfile));
    }

    [HttpGet("doctors")]
    public async Task<IActionResult> GetDoctors([FromQuery] DoctorDirectoryQueryDTO query, CancellationToken cancellationToken)
    {
        List<DoctorDirectoryProjection> doctors = await (
            from user in context.Users.AsNoTracking()
            join profile in context.DoctorProfiles.AsNoTracking() on user.Id equals profile.UserId
            where user.UserType == UserType.Doctor && user.IsActive
            orderby user.Name
            select new DoctorDirectoryProjection
            {
                UserId = user.Id,
                Name = user.Name,
                ProfessionalRegister = profile.ProfessionalRegister,
                Phone = profile.Phone,
                SerializedSpecialties = profile.Specialties
            })
            .ToListAsync(cancellationToken);

        IEnumerable<DoctorDirectoryItemDTO> mappedDoctors = doctors.Select(MapDoctor);

        if (!string.IsNullOrWhiteSpace(query.Specialty))
        {
            string specialty = query.Specialty.Trim();
            mappedDoctors = mappedDoctors.Where(item =>
                item.Specialties.Any(current =>
                    string.Equals(current, specialty, StringComparison.OrdinalIgnoreCase)));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string search = query.Search.Trim();
            mappedDoctors = mappedDoctors.Where(item =>
                item.Name.Contains(search, StringComparison.OrdinalIgnoreCase)
                || item.ProfessionalRegister.Contains(search, StringComparison.OrdinalIgnoreCase)
                || item.Specialties.Any(current => current.Contains(search, StringComparison.OrdinalIgnoreCase)));
        }

        List<DoctorDirectoryItemDTO> result = mappedDoctors
            .Take(query.Limit)
            .ToList();

        return Ok(result);
    }

    [HttpGet("patients")]
    public async Task<IActionResult> GetPatients([FromQuery] PatientDirectoryQueryDTO query, CancellationToken cancellationToken)
    {
        IQueryable<User> patientsQuery = context.Users
            .AsNoTracking()
            .Where(item => item.UserType == UserType.User && item.IsActive);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            string search = query.Search.Trim();
            string normalizedSearch = search.ToLower();
            patientsQuery = patientsQuery.Where(item =>
                item.Name.ToLower().Contains(normalizedSearch) || item.Email.ToLower().Contains(normalizedSearch));
        }

        List<PatientDirectoryItemDTO> result = await patientsQuery
            .OrderBy(item => item.Name)
            .Take(query.Limit)
            .Select(item => new PatientDirectoryItemDTO
            {
                UserId = item.Id,
                Name = item.Name,
                Email = item.Email
            })
            .ToListAsync(cancellationToken);

        return Ok(result);
    }

    private static DirectoryUserResponseDTO MapDirectoryUser(User user, DoctorProfile? doctorProfile)
    {
        return new DirectoryUserResponseDTO
        {
            UserId = user.Id,
            Name = user.Name,
            UserType = user.UserType,
            IsActive = user.IsActive,
            ProfessionalRegister = doctorProfile?.ProfessionalRegister,
            Specialties = doctorProfile is null
                ? Array.Empty<string>()
                : DeserializeSpecialties(doctorProfile.Specialties)
        };
    }

    private static DoctorDirectoryItemDTO MapDoctor(DoctorDirectoryProjection projection)
    {
        return new DoctorDirectoryItemDTO
        {
            UserId = projection.UserId,
            Name = projection.Name,
            ProfessionalRegister = projection.ProfessionalRegister,
            Phone = projection.Phone,
            Specialties = DeserializeSpecialties(projection.SerializedSpecialties)
        };
    }

    private static IReadOnlyCollection<string> DeserializeSpecialties(string serializedSpecialties)
    {
        if (string.IsNullOrWhiteSpace(serializedSpecialties))
            return Array.Empty<string>();

        return JsonSerializer.Deserialize<List<string>>(serializedSpecialties) ?? new List<string>();
    }

    private sealed class DoctorDirectoryProjection
    {
        public Guid UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ProfessionalRegister { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string SerializedSpecialties { get; set; } = string.Empty;
    }
}
