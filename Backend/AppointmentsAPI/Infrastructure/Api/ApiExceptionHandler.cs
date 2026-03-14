using AppointmentsAPI.Domain;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace AppointmentsAPI.Infrastructure.Api;

public class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService problemDetailsService;
    private readonly ILogger<ApiExceptionHandler> logger;

    public ApiExceptionHandler(IProblemDetailsService problemDetailsService, ILogger<ApiExceptionHandler> logger)
    {
        this.problemDetailsService = problemDetailsService;
        this.logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        int statusCode = exception is DomainRuleException domainRule ? domainRule.StatusCode : StatusCodes.Status500InternalServerError;
        string title = exception is DomainRuleException domain ? domain.Code : "unexpected_error";

        if (statusCode >= 500)
            logger.LogError(exception, "Unhandled exception while processing request.");
        else
            logger.LogWarning(exception, "Handled domain exception while processing request.");

        httpContext.Response.StatusCode = statusCode;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = exception.Message
            }
        });
    }
}
