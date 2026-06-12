# WCAG 2.2 AA Reference

Context document for the AccessibilityScan skill. Contains tag groups, commonly failed success criteria, legal context, impact definitions, and remediation patterns.

---

## WCAG Tag Groups for 2.2 AA Compliance

axe-core uses tags to map rules to specific WCAG versions and conformance levels. For full WCAG 2.2 AA coverage, include all six tag groups:

| Tag | Version | Level | Rule Count (approx.) |
|-----|---------|-------|---------------------|
| `wcag2a` | WCAG 2.0 | A | ~30 rules |
| `wcag2aa` | WCAG 2.0 | AA | ~10 rules |
| `wcag21a` | WCAG 2.1 | A | ~5 rules |
| `wcag21aa` | WCAG 2.1 | AA | ~3 rules |
| `wcag22aa` | WCAG 2.2 | AA | ~4 rules |
| `best-practice` | N/A | Advisory | ~20 rules |

**Default combined tag string:** `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa`

Include `best-practice` when the user wants a comprehensive audit beyond strict compliance.

---

## Key WCAG 2.2 AA Success Criteria Commonly Failed

These are the success criteria that cause the most violations in real-world audits. Prioritize remediation in this order.

### Perceivable (Principle 1)

| SC | Name | Common Failure |
|----|------|---------------|
| **1.1.1** | Non-text Content | Images missing `alt` attributes; decorative images not marked with `alt=""` or `role="presentation"` |
| **1.3.1** | Info and Relationships | Form inputs missing associated `<label>` elements; tables without proper headers; heading hierarchy skipped |
| **1.4.3** | Contrast (Minimum) | Text color does not meet 4.5:1 ratio against background; placeholder text fails contrast |
| **1.4.4** | Resize Text | Content breaks or overlaps when browser zoom reaches 200% |
| **1.4.11** | Non-text Contrast | UI components (buttons, inputs, icons) do not meet 3:1 contrast ratio against adjacent colors |

### Operable (Principle 2)

| SC | Name | Common Failure |
|----|------|---------------|
| **2.1.1** | Keyboard | Interactive elements not reachable via Tab; custom widgets lack keyboard handlers |
| **2.4.1** | Bypass Blocks | No skip navigation link; no landmark regions (`<main>`, `<nav>`, `<aside>`) |
| **2.4.2** | Page Titled | Missing or generic `<title>` element |
| **2.4.4** | Link Purpose (In Context) | Links with text like "click here" or "read more" without surrounding context |
| **2.4.7** | Focus Visible | Focus indicator removed via `outline: none` with no replacement |
| **2.4.11** | Focus Not Obscured (Minimum) | Sticky headers or footers cover focused elements (WCAG 2.2 new) |

### Understandable (Principle 3)

| SC | Name | Common Failure |
|----|------|---------------|
| **3.1.1** | Language of Page | Missing `lang` attribute on `<html>` element |
| **3.3.1** | Error Identification | Form errors not programmatically associated with their fields |
| **3.3.2** | Labels or Instructions | Inputs rely solely on placeholder text instead of persistent labels |

### Robust (Principle 4)

| SC | Name | Common Failure |
|----|------|---------------|
| **4.1.2** | Name, Role, Value | Custom components missing ARIA attributes; buttons without accessible names |

### WCAG 2.2 New Criteria (AA Level)

| SC | Name | Common Failure |
|----|------|---------------|
| **2.4.11** | Focus Not Obscured (Minimum) | Fixed-position elements obscure keyboard focus indicator |
| **2.4.13** | Focus Appearance | Focus indicator does not meet minimum area and contrast requirements |
| **2.5.7** | Dragging Movements | Drag-and-drop without single-pointer alternative |
| **2.5.8** | Target Size (Minimum) | Touch targets smaller than 24x24 CSS pixels without adequate spacing |
| **3.2.6** | Consistent Help | Help mechanisms (chat, phone, FAQ) not in consistent location across pages |
| **3.3.7** | Redundant Entry | Previously entered information not auto-populated when re-requested |

---

## Legal Context

### ADA Title II -- State and Local Government

| Deadline | Applies To | Requirement |
|----------|-----------|-------------|
| **April 24, 2026** | Entities serving 50,000+ people | WCAG 2.1 Level AA compliance for all web content and mobile apps |
| **April 26, 2027** | Entities serving fewer than 50,000 people | WCAG 2.1 Level AA compliance for all web content and mobile apps |

**Key points:**
- The DOJ final rule (April 2024) formally adopts WCAG 2.1 AA as the technical standard
- Covers websites, web applications, mobile apps, and documents published online
- Third-party content hosted on government domains is included
- Existing content must be remediated, not just new content
- Good-faith compliance efforts may be considered but do not constitute a defense

### Section 508 -- Federal Government

| Requirement | Standard |
|-------------|----------|
| Federal websites and ICT | WCAG 2.0 Level AA (current); agencies increasingly adopting 2.1/2.2 |
| Procurement | Section 508 conformance required for all purchased ICT |
| Refresh cycle | Expected to formally adopt WCAG 2.1+ in upcoming refresh |

### Private Sector (ADA Title III)

- No explicit technical standard in the statute, but courts routinely apply WCAG 2.1 AA
- Lawsuits increased 300%+ between 2018-2024
- Industries most targeted: retail, hospitality, banking, healthcare, education
- DOJ has signaled that WCAG 2.1 AA is the expected standard for private entities

---

## Impact Level Definitions

axe-core assigns one of four impact levels to each violation. These map to user experience severity.

### Critical

**Definition:** Content is completely inaccessible to one or more user groups. No workaround exists.

**Examples:**
- Image with no alt text inside a link (screen reader users cannot determine link destination)
- Form cannot be submitted via keyboard
- Video with no captions (deaf users cannot access content)

**Remediation priority:** Immediate. Fix before next deployment if possible.

### Serious

**Definition:** Significant barrier that makes content very difficult to use. Workaround may exist but is unreasonable to expect.

**Examples:**
- Color contrast ratio below 3:1 (fails even the lower threshold)
- Focus order is illogical, requiring excessive tabbing
- ARIA attributes reference non-existent IDs

**Remediation priority:** High. Fix within the current sprint or release cycle.

### Moderate

**Definition:** Some users will experience difficulty, but a reasonable workaround exists.

**Examples:**
- Color contrast ratio between 3:1 and 4.5:1 (partially readable)
- Heading hierarchy has a skipped level (h2 to h4)
- Table missing explicit headers but structure is inferrable

**Remediation priority:** Medium. Plan for next release cycle.

### Minor

**Definition:** Annoyance or inconvenience. Content is still accessible but the experience is degraded.

**Examples:**
- Redundant ARIA role on a native element
- Tabindex greater than 0 (works but disrupts natural order)
- Empty heading tag that does not affect content flow

**Remediation priority:** Low. Address during routine maintenance.

---

## Common Remediation Patterns

### Missing Alt Text (SC 1.1.1)

**Violation:** `image-alt`, `input-image-alt`, `area-alt`

```html
<!-- BEFORE: Fails -->
<img src="photo.jpg">

<!-- AFTER: Informative image -->
<img src="photo.jpg" alt="Team members at the 2025 company retreat">

<!-- AFTER: Decorative image -->
<img src="divider.png" alt="" role="presentation">

<!-- AFTER: Complex image with long description -->
<img src="chart.png" alt="Q4 revenue chart" aria-describedby="chart-desc">
<div id="chart-desc" class="sr-only">Revenue grew from $2M in October to $3.4M in December...</div>
```

### Insufficient Color Contrast (SC 1.4.3, 1.4.11)

**Violation:** `color-contrast`, `color-contrast-enhanced`

```css
/* BEFORE: Fails - gray on white, ratio 2.8:1 */
.text { color: #999999; background: #ffffff; }

/* AFTER: Passes 4.5:1 for normal text */
.text { color: #595959; background: #ffffff; }

/* AFTER: Passes 3:1 for large text (18pt+ or 14pt+ bold) */
.large-text { color: #767676; background: #ffffff; }
```

**Tools:** Use the Chrome DevTools color picker (shows contrast ratio) or WebAIM Contrast Checker.

### Missing Form Labels (SC 1.3.1, 3.3.2)

**Violation:** `label`, `input-image-alt`, `select-name`

```html
<!-- BEFORE: Fails - no label association -->
<input type="text" placeholder="Email">

<!-- AFTER: Explicit label -->
<label for="email">Email address</label>
<input type="text" id="email" placeholder="user@example.com">

<!-- AFTER: Visually hidden label (when design requires no visible label) -->
<label for="search" class="sr-only">Search</label>
<input type="search" id="search" placeholder="Search...">

<!-- AFTER: aria-label (last resort) -->
<input type="search" aria-label="Search the site" placeholder="Search...">
```

### Missing Document Language (SC 3.1.1)

**Violation:** `html-has-lang`, `html-lang-valid`

```html
<!-- BEFORE: Fails -->
<html>

<!-- AFTER: Passes -->
<html lang="en">

<!-- For multilingual content -->
<html lang="en">
  <body>
    <p>Welcome to our site.</p>
    <p lang="es">Bienvenido a nuestro sitio.</p>
  </body>
</html>
```

### Missing Landmark Regions (SC 2.4.1)

**Violation:** `bypass`, `region`, `landmark-one-main`

```html
<!-- BEFORE: Fails - flat div structure -->
<div class="header">...</div>
<div class="sidebar">...</div>
<div class="content">...</div>
<div class="footer">...</div>

<!-- AFTER: Semantic landmarks -->
<header>...</header>
<nav aria-label="Main navigation">...</nav>
<aside aria-label="Sidebar">...</aside>
<main>...</main>
<footer>...</footer>

<!-- ALSO: Add skip navigation link -->
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header>...</header>
  <main id="main-content">...</main>
</body>
```

### Keyboard Inaccessibility (SC 2.1.1)

**Violation:** `keyboard`, `focusable-no-name`

```html
<!-- BEFORE: Fails - click-only interaction on non-focusable element -->
<div class="button" onclick="doThing()">Submit</div>

<!-- AFTER: Use native button -->
<button type="button" onclick="doThing()">Submit</button>

<!-- AFTER: If custom element is required -->
<div class="button" role="button" tabindex="0"
     onclick="doThing()"
     onkeydown="if(event.key==='Enter'||event.key===' ')doThing()">
  Submit
</div>
```

### Missing Focus Indicator (SC 2.4.7, 2.4.13)

**Violation:** No axe rule (manual check), but `focus-visible` best practice

```css
/* BEFORE: Fails - focus removed */
*:focus { outline: none; }

/* AFTER: Custom focus indicator that meets WCAG 2.2 focus appearance */
*:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Ensure adequate contrast of focus indicator */
/* Focus indicator must have >= 3:1 contrast against adjacent colors */
```

### Target Size Too Small (SC 2.5.8 -- WCAG 2.2)

**Violation:** `target-size`

```css
/* BEFORE: Fails - 16x16 touch target */
.icon-button { width: 16px; height: 16px; }

/* AFTER: Meets 24x24 minimum */
.icon-button {
  width: 24px;
  height: 24px;
  /* Or use padding to increase touch target without changing visual size */
  padding: 4px;
  min-width: 24px;
  min-height: 24px;
}
```

---

## axe-core Rule-to-Criteria Mapping (Most Common)

| axe Rule ID | WCAG SC | Impact | Description |
|------------|---------|--------|-------------|
| `image-alt` | 1.1.1 | Critical | Images must have alt text |
| `color-contrast` | 1.4.3 | Serious | Text must meet contrast ratio |
| `label` | 1.3.1, 4.1.2 | Critical | Form elements must have labels |
| `html-has-lang` | 3.1.1 | Serious | html element must have lang attribute |
| `bypass` | 2.4.1 | Serious | Page must have means to bypass repeated blocks |
| `link-name` | 2.4.4, 4.1.2 | Serious | Links must have discernible text |
| `button-name` | 4.1.2 | Critical | Buttons must have discernible text |
| `document-title` | 2.4.2 | Serious | Documents must have a title |
| `duplicate-id` | 4.1.1 | Moderate | IDs must be unique |
| `heading-order` | 1.3.1 | Moderate | Heading levels should increase by one |
| `landmark-one-main` | 2.4.1 | Moderate | Document must have one main landmark |
| `region` | 2.4.1 | Moderate | All content must be in landmark regions |
| `tabindex` | 2.4.3 | Moderate | Tabindex should not be greater than 0 |
| `aria-allowed-attr` | 4.1.2 | Critical | ARIA attributes must be valid for role |
| `aria-valid-attr-value` | 4.1.2 | Critical | ARIA attribute values must be valid |
