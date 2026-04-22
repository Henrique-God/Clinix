namespace UsersAPI.Services;

public sealed class ClinicalRecordAuthorizationResult
{
    public bool Allowed { get; init; }
    public string? Error { get; init; }

    public static ClinicalRecordAuthorizationResult Success() => new() { Allowed = true };

    public static ClinicalRecordAuthorizationResult Fail(string error) => new()
    {
        Allowed = false,
        Error = error
    };
}
