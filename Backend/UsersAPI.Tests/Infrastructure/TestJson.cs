using System.Text.Json;
using System.Text.Json.Serialization;

namespace UsersAPI.Tests.Infrastructure;

internal static class TestJson
{
    internal static readonly JsonSerializerOptions SerializerOptions = CreateSerializerOptions();

    private static JsonSerializerOptions CreateSerializerOptions()
    {
        JsonSerializerOptions options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
