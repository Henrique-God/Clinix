using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatBotAPI.Controllers;

public record ChatMessageRequest(string Message);
public record ChatMessageResponse(string Reply, DateTime Timestamp);

[ApiController]
[Route("chatbot")]
[Authorize]
public class ChatBotController : ControllerBase
{
    private readonly ILogger<ChatBotController> logger;

    public ChatBotController(ILogger<ChatBotController> logger)
    {
        this.logger = logger;
    }

    [HttpPost("message")]
    public IActionResult SendMessage([FromBody] ChatMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest("Message is required.");

        logger.LogInformation("ChatBot received message: {Message}", request.Message);

        // Mock response — OpenAI integration will be implemented in Sprint 3
        return Ok(new ChatMessageResponse(
            Reply: "Olá! Sou o assistente virtual do Clinix. A integração com OpenAI será implementada no Sprint 3.",
            Timestamp: DateTime.UtcNow
        ));
    }
}
