using Clinix.Models;
using Microsoft.EntityFrameworkCore;

namespace Clinix.Data;

public interface IClinixDbContext
{
    DbSet<User> Users { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
