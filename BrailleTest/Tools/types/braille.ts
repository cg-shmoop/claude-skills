/**
 * Braille display simulation types.
 * Models a 40-cell refreshable braille display.
 */

export interface BrailleDisplay {
  /** Number of cells (default 40, configurable for 14, 20, 80) */
  cells: number;
  /** What is currently shown (max `cells` chars) */
  currentContent: string;
  /** Full content of current line before truncation */
  fullLine: string;
  /** Current pan offset into fullLine (0-based, increments by `cells`) */
  panPosition: number;
  /** true = show element type prefixes (btn, edt, lnk, h2, etc.) */
  structuredMode: boolean;
}

export interface BrailleView {
  /** Exactly `cells` characters (padded with spaces if shorter) */
  displayedText: string;
  /** true if fullLine exceeds cells */
  truncated: boolean;
  /** 0-based character offset into fullLine */
  panPosition: number;
  /** Total number of pan operations needed to read the full line */
  totalPans: number;
  /** Which pan we are on (1-based) */
  currentPan: number;
  /** Element type abbreviation: "lnk", "btn", "edt", "h2", "chk", "cbo", etc. */
  elementType: string;
  /** Accessible name of the element */
  elementName: string;
  /** Current interaction mode */
  mode: 'browse' | 'forms';
}

/** Braille element type abbreviations matching JAWS Structured Mode */
export const BRAILLE_ABBREVIATIONS: Record<string, string> = {
  button: 'btn',
  edit: 'edt',
  checkbox: 'chk',
  radiobutton: 'rad',
  combobox: 'cbo',
  link: 'lnk',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  heading4: 'h4',
  heading5: 'h5',
  heading6: 'h6',
  list: 'lst',
  listitem: 'lstitm',
  table: 'tbl',
  image: 'gra',
  separator: 'sprtr',
  tab: 'tab',
  tree: 'tree',
  treeitem: 'trtm',
  menu: 'mnu',
  menuitem: 'mnuitm',
  dialog: 'dlg',
  alert: 'alrt',
  progressbar: 'prgbr',
  slider: 'sldr',
  text: '',          // Plain text has no prefix
  group: 'grp',
  landmark: 'rgn',
  main: 'main',
  navigation: 'nav',
  banner: 'bnr',
  contentinfo: 'cntinfo',
  search: 'srch',
  complementary: 'cmplmtry',
  form: 'frm',
};

/** Map UIA ControlType IDs to braille abbreviations */
export const UIA_CONTROL_TYPE_MAP: Record<number, string> = {
  50000: 'btn',     // Button
  50001: '',         // Calendar
  50002: 'chk',     // CheckBox
  50003: 'cbo',     // ComboBox
  50004: 'edt',     // Edit
  50005: 'lnk',     // Hyperlink
  50006: 'gra',     // Image
  50007: 'lstitm',  // ListItem
  50008: 'lst',     // List
  50009: 'mnu',     // Menu
  50010: 'mnubar',  // MenuBar
  50011: 'mnuitm',  // MenuItem
  50012: 'prgbr',   // ProgressBar
  50013: 'rad',     // RadioButton
  50014: 'scrlbar', // ScrollBar
  50015: 'sldr',    // Slider
  50016: '',         // Spinner
  50017: '',         // StatusBar
  50018: 'tab',     // Tab
  50019: 'tabitm',  // TabItem
  50020: '',         // Text
  50021: '',         // ToolBar
  50022: '',         // ToolTip
  50023: 'tree',    // Tree
  50024: 'trtm',    // TreeItem
  50025: '',         // Custom
  50026: 'grp',     // Group
  50027: '',         // Thumb
  50028: 'tbl',     // DataGrid (table)
  50029: '',         // DataItem
  50030: '',         // Document
  50031: '',         // SplitButton
  50032: '',         // Window
  50033: '',         // Pane
  50034: '',         // Header
  50035: '',         // HeaderItem
  50036: 'tbl',     // Table
  50037: '',         // TitleBar
  50038: 'sprtr',   // Separator
};
