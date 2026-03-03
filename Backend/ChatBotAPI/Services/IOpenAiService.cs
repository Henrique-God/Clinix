namespace ChatBotAPI.Services;

public interface IOpenAiService
{
    Task<string> SendMessageAsync(string userMessage, string? conversationContext = null);
}
