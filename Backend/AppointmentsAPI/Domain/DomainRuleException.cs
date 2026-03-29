namespace AppointmentsAPI.Domain;

public sealed class DomainRuleException : Exception
{
    public DomainRuleException(string code, string message, int statusCode)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    public string Code { get; }

    public int StatusCode { get; }

    public static DomainRuleException Validation(string code, string message) => new(code, message, 400);

    public static DomainRuleException Forbidden(string code, string message) => new(code, message, 403);

    public static DomainRuleException NotFound(string code, string message) => new(code, message, 404);

    public static DomainRuleException Conflict(string code, string message) => new(code, message, 409);

    public static DomainRuleException ServiceUnavailable(string code, string message) => new(code, message, 503);
}
