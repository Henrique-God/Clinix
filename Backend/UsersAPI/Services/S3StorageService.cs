using Amazon.S3;
using Amazon.S3.Model;

namespace UsersAPI.Services;

public class S3StorageService : IS3StorageService
{
    private readonly IAmazonS3 amazonS3;
    private readonly IConfiguration configuration;

    public S3StorageService(IAmazonS3 amazonS3, IConfiguration configuration)
    {
        this.amazonS3 = amazonS3;
        this.configuration = configuration;
    }

    public async Task<string> UploadAsync(string fileName, Stream content, string contentType)
    {
        string bucketName = GetBucketName();

        var request = new PutObjectRequest
        {
            BucketName = bucketName,
            Key = fileName,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false
        };

        await amazonS3.PutObjectAsync(request);
        return fileName;
    }

    public async Task<Stream> DownloadAsync(string fileName)
    {
        string bucketName = GetBucketName();
        GetObjectResponse response = await amazonS3.GetObjectAsync(bucketName, fileName);

        var memoryStream = new MemoryStream();
        await response.ResponseStream.CopyToAsync(memoryStream);
        memoryStream.Position = 0;
        return memoryStream;
    }

    public Task DeleteAsync(string fileName)
    {
        string bucketName = GetBucketName();
        return amazonS3.DeleteObjectAsync(bucketName, fileName);
    }

    private string GetBucketName() =>
        configuration["Aws:S3BucketName"] ?? throw new InvalidOperationException("Aws:S3BucketName is not configured.");
}
