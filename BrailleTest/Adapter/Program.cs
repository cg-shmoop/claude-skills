using System.Text.Json;
using BrailleTestAdapter;
using BrailleTestAdapter.Models;

var adapter = new UIAAdapter();
var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

// Write ready signal to stderr (stdout is reserved for JSON-RPC responses)
Console.Error.WriteLine("BrailleTestAdapter ready");
Console.Error.Flush();

while (true)
{
    var line = Console.ReadLine();
    if (line == null) break; // stdin closed

    try
    {
        var request = JsonSerializer.Deserialize<JsonRpcRequest>(line, options);
        if (request == null) continue;

        object? result = request.Method switch
        {
            "getFocusedElement" => adapter.GetFocusedElement(),
            "getRootElement" => adapter.GetRootElement(GetInt(request, "processId")),
            "findAll" => adapter.FindAll(
                GetInt(request, "processId"),
                GetString(request, "property"),
                GetString(request, "value")),
            "findFirst" => adapter.FindFirst(
                GetInt(request, "processId"),
                GetString(request, "property"),
                GetString(request, "value")),
            "getChildren" => adapter.GetChildren(
                GetString(request, "automationId"),
                GetInt(request, "processId")),
            "invoke" => adapter.Invoke(
                GetString(request, "automationId"),
                GetInt(request, "processId")),
            "setValue" => adapter.SetValue(
                GetString(request, "automationId"),
                GetString(request, "value"),
                GetInt(request, "processId")),
            "toggle" => adapter.Toggle(
                GetString(request, "automationId"),
                GetInt(request, "processId")),
            "ping" => "pong",
            "exit" => null,
            _ => throw new Exception($"Unknown method: {request.Method}")
        };

        if (request.Method == "exit") break;

        var response = new JsonRpcResponse { Id = request.Id, Result = result };
        var json = JsonSerializer.Serialize(response, options);
        Console.WriteLine(json);
        Console.Out.Flush();
    }
    catch (Exception ex)
    {
        var errorResponse = new JsonRpcResponse
        {
            Id = 0,
            Error = new JsonRpcError { Code = -1, Message = ex.Message }
        };
        var json = JsonSerializer.Serialize(errorResponse, options);
        Console.WriteLine(json);
        Console.Out.Flush();
    }
}

Console.Error.WriteLine("BrailleTestAdapter exiting");

// --- Helper methods ---

static int GetInt(JsonRpcRequest req, string key)
{
    if (req.Params?.TryGetValue(key, out var v) == true)
    {
        // System.Text.Json deserializes numbers as JsonElement
        if (v is JsonElement je && je.ValueKind == JsonValueKind.Number)
            return je.GetInt32();
        return Convert.ToInt32(v);
    }
    return 0;
}

static string GetString(JsonRpcRequest req, string key)
{
    if (req.Params?.TryGetValue(key, out var v) == true)
    {
        if (v is JsonElement je && je.ValueKind == JsonValueKind.String)
            return je.GetString() ?? "";
        return v?.ToString() ?? "";
    }
    return "";
}
