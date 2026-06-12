namespace BrailleTestAdapter.Models;

public class JsonRpcRequest
{
    public string Method { get; set; } = "";
    public Dictionary<string, object>? Params { get; set; }
    public int Id { get; set; }
}

public class JsonRpcResponse
{
    public int Id { get; set; }
    public object? Result { get; set; }
    public JsonRpcError? Error { get; set; }
}

public class JsonRpcError
{
    public int Code { get; set; }
    public string Message { get; set; } = "";
}
