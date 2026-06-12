namespace BrailleTestAdapter.Models;

public class ElementInfoDto
{
    public string AutomationId { get; set; } = "";
    public int ControlType { get; set; }
    public string ControlTypeName { get; set; } = "";
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
    public string Role { get; set; } = "";
    public string AriaRole { get; set; } = "";
    public int Level { get; set; }
    public int PositionInSet { get; set; }
    public int SizeOfSet { get; set; }
    public bool IsEnabled { get; set; }
    public bool IsKeyboardFocusable { get; set; }
    public bool HasKeyboardFocus { get; set; }
    public bool IsRequired { get; set; }
    public bool IsPassword { get; set; }
    public List<string> States { get; set; } = new();
    public string Description { get; set; } = "";
    public string HelpText { get; set; } = "";
    public string LandmarkType { get; set; } = "";
}
