using UsersAPI.Services;

namespace UsersAPI.Tests.Infrastructure;

public class FakeS3StorageService : IS3StorageService
{
    private readonly Dictionary<string, StoredObject> objects = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, StoredObject> Objects => objects;

    public Task<string> UploadAsync(string fileName, Stream content, string contentType)
    {
        using MemoryStream memoryStream = new MemoryStream();
        content.CopyTo(memoryStream);
        objects[fileName] = new StoredObject
        {
            ContentType = contentType,
            Content = memoryStream.ToArray()
        };

        return Task.FromResult(fileName);
    }

    public Task<Stream> DownloadAsync(string fileName)
    {
        if (!objects.TryGetValue(fileName, out StoredObject? storedObject))
            throw new FileNotFoundException(fileName);

        Stream stream = new MemoryStream(storedObject.Content);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string fileName)
    {
        objects.Remove(fileName);
        return Task.CompletedTask;
    }

    public void Reset() => objects.Clear();

    public sealed class StoredObject
    {
        public string ContentType { get; init; } = string.Empty;
        public byte[] Content { get; init; } = [];
    }
}
