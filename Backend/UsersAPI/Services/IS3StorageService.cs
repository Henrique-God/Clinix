namespace UsersAPI.Services;

public interface IS3StorageService
{
    Task<string> UploadAsync(string fileName, Stream content, string contentType);
    Task<Stream> DownloadAsync(string fileName);
    Task DeleteAsync(string fileName);
}
