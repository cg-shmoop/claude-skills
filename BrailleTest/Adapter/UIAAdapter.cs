using System.Windows.Automation;
using BrailleTestAdapter.Models;

namespace BrailleTestAdapter;

public class UIAAdapter
{
    /// <summary>
    /// Returns the currently focused UI Automation element.
    /// </summary>
    public ElementInfoDto? GetFocusedElement()
    {
        try
        {
            var focused = AutomationElement.FocusedElement;
            return focused != null ? ToDto(focused) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Returns the root automation element for a given process.
    /// </summary>
    public ElementInfoDto? GetRootElement(int processId)
    {
        try
        {
            var root = AutomationElement.RootElement;
            var condition = new PropertyCondition(AutomationElement.ProcessIdProperty, processId);
            var element = root.FindFirst(TreeScope.Children, condition);
            return element != null ? ToDto(element) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Finds all descendant elements matching a property/value pair within a process window.
    /// </summary>
    public List<ElementInfoDto> FindAll(int processId, string propertyName, object value)
    {
        var results = new List<ElementInfoDto>();

        try
        {
            var processRoot = GetProcessRoot(processId);
            if (processRoot == null) return results;

            var property = ResolveProperty(propertyName);
            if (property == null) return results;

            var condition = new PropertyCondition(property, value.ToString());
            var elements = processRoot.FindAll(TreeScope.Descendants, condition);

            foreach (AutomationElement element in elements)
            {
                results.Add(ToDto(element));
            }
        }
        catch (Exception)
        {
            // Return what we have so far
        }

        return results;
    }

    /// <summary>
    /// Finds the first descendant element matching a property/value pair within a process window.
    /// </summary>
    public ElementInfoDto? FindFirst(int processId, string propertyName, object value)
    {
        try
        {
            var processRoot = GetProcessRoot(processId);
            if (processRoot == null) return null;

            var property = ResolveProperty(propertyName);
            if (property == null) return null;

            var condition = new PropertyCondition(property, value.ToString());
            var element = processRoot.FindFirst(TreeScope.Descendants, condition);
            return element != null ? ToDto(element) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Returns direct children of an element identified by AutomationId within a process.
    /// </summary>
    public List<ElementInfoDto> GetChildren(string automationId, int processId)
    {
        var results = new List<ElementInfoDto>();

        try
        {
            AutomationElement? parent;

            if (string.IsNullOrEmpty(automationId))
            {
                parent = GetProcessRoot(processId);
            }
            else
            {
                parent = FindByAutomationId(automationId, processId);
            }

            if (parent == null) return results;

            var walker = TreeWalker.ContentViewWalker;
            var child = walker.GetFirstChild(parent);

            while (child != null)
            {
                results.Add(ToDto(child));
                child = walker.GetNextSibling(child);
            }
        }
        catch (Exception)
        {
            // Return what we have so far
        }

        return results;
    }

    /// <summary>
    /// Invokes an element (clicks a button, activates a link, etc.).
    /// </summary>
    public bool Invoke(string automationId, int processId)
    {
        try
        {
            var element = FindByAutomationId(automationId, processId);
            if (element == null) return false;

            if (element.TryGetCurrentPattern(InvokePattern.Pattern, out var pattern))
            {
                ((InvokePattern)pattern).Invoke();
                return true;
            }

            return false;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>
    /// Sets the value of an input element.
    /// </summary>
    public bool SetValue(string automationId, string value, int processId)
    {
        try
        {
            var element = FindByAutomationId(automationId, processId);
            if (element == null) return false;

            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern))
            {
                ((ValuePattern)pattern).SetValue(value);
                return true;
            }

            return false;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>
    /// Toggles a checkbox or toggle button.
    /// </summary>
    public bool Toggle(string automationId, int processId)
    {
        try
        {
            var element = FindByAutomationId(automationId, processId);
            if (element == null) return false;

            if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var pattern))
            {
                ((TogglePattern)pattern).Toggle();
                return true;
            }

            return false;
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>
    /// Converts an AutomationElement to a serializable ElementInfoDto.
    /// Uses try/catch for each property since some elements don't support all properties.
    /// </summary>
    private ElementInfoDto ToDto(AutomationElement element)
    {
        var dto = new ElementInfoDto();

        try { dto.AutomationId = element.Current.AutomationId ?? ""; } catch { }
        try { dto.ControlType = element.Current.ControlType.Id; } catch { }
        try { dto.ControlTypeName = element.Current.ControlType.ProgrammaticName ?? ""; } catch { }
        try { dto.Name = element.Current.Name ?? ""; } catch { }
        try { dto.IsEnabled = element.Current.IsEnabled; } catch { }
        try { dto.IsKeyboardFocusable = element.Current.IsKeyboardFocusable; } catch { }
        try { dto.HasKeyboardFocus = element.Current.HasKeyboardFocus; } catch { }
        try { dto.HelpText = element.Current.HelpText ?? ""; } catch { }

        // Value from ValuePattern
        try
        {
            if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var valuePattern))
            {
                dto.Value = ((ValuePattern)valuePattern).Current.Value ?? "";
            }
        }
        catch { }

        // Role and AriaRole from extended properties
        try
        {
            var ariaRole = element.GetCurrentPropertyValue(AutomationElement.AriaRoleProperty);
            dto.AriaRole = ariaRole?.ToString() ?? "";
            dto.Role = dto.AriaRole != "" ? dto.AriaRole : dto.ControlTypeName;
        }
        catch
        {
            dto.Role = dto.ControlTypeName;
        }

        // Level, PositionInSet, SizeOfSet from item-related properties
        try
        {
            var ariaProps = element.GetCurrentPropertyValue(AutomationElement.AriaPropertiesProperty);
            if (ariaProps is string ariaStr && !string.IsNullOrEmpty(ariaStr))
            {
                // AriaProperties comes as semicolon-separated key=value pairs
                foreach (var pair in ariaStr.Split(';'))
                {
                    var kv = pair.Split('=');
                    if (kv.Length != 2) continue;
                    var key = kv[0].Trim();
                    var val = kv[1].Trim();

                    switch (key)
                    {
                        case "level":
                            if (int.TryParse(val, out var level)) dto.Level = level;
                            break;
                        case "posinset":
                            if (int.TryParse(val, out var pos)) dto.PositionInSet = pos;
                            break;
                        case "setsize":
                            if (int.TryParse(val, out var size)) dto.SizeOfSet = size;
                            break;
                        case "required":
                            dto.IsRequired = val == "true";
                            break;
                        case "describedby":
                        case "description":
                            dto.Description = val;
                            break;
                    }
                }
            }
        }
        catch { }

        // IsPassword from PasswordProperty
        try
        {
            var isPassword = element.GetCurrentPropertyValue(AutomationElement.IsPasswordProperty);
            dto.IsPassword = isPassword is bool b && b;
        }
        catch { }

        // LandmarkType
        try
        {
            var landmark = element.GetCurrentPropertyValue(AutomationElement.LandmarkTypeProperty);
            if (landmark is int landmarkId && landmarkId != 0)
            {
                dto.LandmarkType = landmarkId switch
                {
                    // Standard UIA landmark type IDs
                    80000 => "custom",
                    80001 => "form",
                    80002 => "main",
                    80003 => "navigation",
                    80004 => "search",
                    _ => $"landmark_{landmarkId}"
                };
            }
        }
        catch { }

        // States list from toggle, expand/collapse, selection
        try
        {
            if (element.TryGetCurrentPattern(TogglePattern.Pattern, out var togglePattern))
            {
                var state = ((TogglePattern)togglePattern).Current.ToggleState;
                dto.States.Add(state switch
                {
                    ToggleState.On => "checked",
                    ToggleState.Off => "unchecked",
                    ToggleState.Indeterminate => "indeterminate",
                    _ => "unknown"
                });
            }
        }
        catch { }

        try
        {
            if (element.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var expandPattern))
            {
                var state = ((ExpandCollapsePattern)expandPattern).Current.ExpandCollapseState;
                dto.States.Add(state switch
                {
                    ExpandCollapseState.Collapsed => "collapsed",
                    ExpandCollapseState.Expanded => "expanded",
                    ExpandCollapseState.PartiallyExpanded => "partially_expanded",
                    ExpandCollapseState.LeafNode => "leaf",
                    _ => "unknown"
                });
            }
        }
        catch { }

        try
        {
            if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var selPattern))
            {
                var isSelected = ((SelectionItemPattern)selPattern).Current.IsSelected;
                dto.States.Add(isSelected ? "selected" : "unselected");
            }
        }
        catch { }

        return dto;
    }

    /// <summary>
    /// Finds an element by its AutomationId within a process's UI tree.
    /// </summary>
    private AutomationElement? FindByAutomationId(string automationId, int processId)
    {
        try
        {
            var processRoot = GetProcessRoot(processId);
            if (processRoot == null) return null;

            var condition = new PropertyCondition(AutomationElement.AutomationIdProperty, automationId);
            return processRoot.FindFirst(TreeScope.Descendants, condition);
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Gets the top-level window for a process from the desktop root.
    /// </summary>
    private AutomationElement? GetProcessRoot(int processId)
    {
        try
        {
            var root = AutomationElement.RootElement;
            var condition = new PropertyCondition(AutomationElement.ProcessIdProperty, processId);
            return root.FindFirst(TreeScope.Children, condition);
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>
    /// Resolves a string property name to the corresponding AutomationProperty.
    /// </summary>
    private AutomationProperty? ResolveProperty(string propertyName)
    {
        return propertyName.ToLowerInvariant() switch
        {
            "automationid" => AutomationElement.AutomationIdProperty,
            "name" => AutomationElement.NameProperty,
            "classname" or "class" => AutomationElement.ClassNameProperty,
            "controltype" => AutomationElement.ControlTypeProperty,
            "helptext" => AutomationElement.HelpTextProperty,
            "ispassword" => AutomationElement.IsPasswordProperty,
            "isenabled" => AutomationElement.IsEnabledProperty,
            "ariarole" => AutomationElement.AriaRoleProperty,
            "landmarktype" => AutomationElement.LandmarkTypeProperty,
            _ => null
        };
    }
}
