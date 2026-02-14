# UI Design Guidelines - SuperHuman CRM

## 🎨 Design System

### Color Palette

#### Background Colors
```css
Main Background: #F5F5F0 (warm off-white)
Card Background: white
Input Area: #FAFAF8 or #F5F5F0
```

#### Text Colors (stone-* family)
```css
Primary Headings: text-stone-900
Body Text: text-stone-700
Secondary Text: text-stone-600
Muted Text: text-stone-500
Icons (muted): text-stone-400
```

#### Action Colors
```css
Primary Action: bg-sky-500 hover:bg-sky-600
Primary Text: text-white (on sky-500)
Active States: text-sky-600, border-sky-600
Focus Ring: ring-sky-500
```

#### Status Colors
```css
Success: bg-green-100 text-green-700
Warning: bg-yellow-100 text-yellow-600
Error: bg-red-50 text-red-600, border-red-300
Info: bg-blue-100 text-blue-700
```

#### Structural Colors (gray-* family)
```css
Borders: border-gray-200, border-gray-300
Dividers: border-gray-100
Backgrounds: bg-gray-50, bg-gray-100
Input Borders: border-gray-300
```

### Typography

#### Font Sizes
```css
Headings (large): text-2xl (24px)
Headings (medium): text-xl (20px)
Headings (small): text-base (16px)
Body: text-sm (14px) or text-[15px]
Small/Helper: text-xs (12px)
```

#### Font Weights
```css
Headings: font-semibold or font-bold
Labels: font-medium
Body: font-normal
```

### Spacing

#### Padding
```css
Cards: p-4 (16px)
Large Sections: p-6 (24px)
Small Sections: p-3 (12px)
Buttons: px-4 py-2 or px-3 py-1.5
```

#### Margins & Gaps
```css
Card Bottom Margin: mb-3 (12px)
Section Spacing: space-y-6 (24px) in chat
Within Cards: space-y-3 (12px) or space-y-2 (8px)
Inline Elements: gap-2 (8px) or gap-3 (12px)
```

### Borders & Corners

#### Border Radius
```css
Cards: rounded-lg (8px)
Buttons: rounded-lg (8px)
User Messages: rounded-2xl (16px)
Inputs: rounded-lg (8px)
Tags/Badges: rounded (4px)
```

#### Border Width
```css
Default: border (1px)
Focus Ring: ring-2 (2px)
Active Tab: border-b-2 (2px)
```

### Shadows
```css
Cards: shadow-sm
Detail Views: shadow-lg
Hover State: hover:shadow-md
```

## 🎯 Component Patterns

### Card Component Structure
```tsx
<div className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
  {/* Header with icon and title */}
  <div className="flex items-start justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-sky-600">...</svg>
      </div>
      <div>
        <h3 className="text-base font-semibold text-stone-900">Title</h3>
        <p className="text-sm text-stone-600">Subtitle</p>
      </div>
    </div>
  </div>

  {/* Content with icons */}
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm">
      <svg className="w-4 h-4 text-stone-400">...</svg>
      <span className="text-stone-700">Detail</span>
    </div>
  </div>

  {/* Optional Actions */}
  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
    <button className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors">
      Primary
    </button>
    <button className="px-4 py-2 bg-white hover:bg-stone-50 border border-gray-300 text-stone-700 text-sm font-medium rounded-lg transition-colors">
      Secondary
    </button>
  </div>
</div>
```

### Button Patterns
```tsx
// Primary Button
<button className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors">
  Primary Action
</button>

// Secondary Button
<button className="px-4 py-2 bg-white hover:bg-stone-50 border border-gray-300 text-stone-700 text-sm font-medium rounded-lg transition-colors">
  Secondary Action
</button>

// Text Button
<button className="text-sm text-sky-600 hover:text-sky-700 font-medium">
  Text Link
</button>

// Disabled State
<button disabled className="... disabled:opacity-50 disabled:cursor-not-allowed">
  Disabled
</button>
```

### Form Input Patterns
```tsx
// Label
<label className="block text-sm font-medium text-stone-700 mb-1">
  Field Name <span className="text-red-500">*</span>
</label>

// Input (Normal)
<input
  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
/>

// Input (Error)
<input
  className="w-full px-3 py-2 border border-red-300 bg-red-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
/>

// Error Message
<p className="text-xs text-red-600 mt-1 flex items-center gap-1">
  <svg className="w-3 h-3">...</svg>
  Error message
</p>
```

### Icon Patterns
```tsx
// Primary Icon (colored)
<svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
</svg>

// Muted Icon (gray)
<svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
</svg>

// Icon in Button
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="..." />
</svg>
```

### User Message Pattern (Chat)
```tsx
<div className="bg-sky-500 text-white shadow-sm rounded-2xl px-4 py-3 max-w-[70%]">
  <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
    {messageContent}
  </div>
</div>
```

### Assistant Message Pattern (Chat)
```tsx
<div className="max-w-3xl w-full">
  <div className="text-[15px] leading-relaxed text-stone-800 prose prose-sm max-w-none">
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
</div>
```

## ✅ Design Checklist

### Every Card Must Have:
- [ ] White background: `bg-white`
- [ ] Border: `border border-gray-200`
- [ ] Rounded corners: `rounded-lg`
- [ ] Shadow: `shadow-sm`
- [ ] Padding: `p-4`
- [ ] Bottom margin: `mb-3`
- [ ] Text colors from `stone-*` family

### Every Button Must Have:
- [ ] Appropriate color (primary/secondary)
- [ ] Hover state
- [ ] Disabled state with opacity and cursor
- [ ] Rounded: `rounded-lg`
- [ ] Transition: `transition-colors`

### Every Input Must Have:
- [ ] Border: `border border-gray-300`
- [ ] Rounded: `rounded-lg`
- [ ] Focus ring: `focus:ring-2 focus:ring-sky-500`
- [ ] Disabled state: `disabled:bg-gray-50`
- [ ] Proper text size: `text-sm`

### Every Icon Must Have:
- [ ] Consistent size: `w-4 h-4` or `w-5 h-5`
- [ ] Proper color: `text-sky-600` or `text-stone-400`
- [ ] Stroke width: `strokeWidth={2}`

## 🚫 Common Mistakes to Avoid

### ❌ Don't Use:
```css
❌ text-gray-900 → ✅ text-stone-900
❌ text-gray-700 → ✅ text-stone-700
❌ text-gray-600 → ✅ text-stone-600
❌ hover:bg-gray-200 → ✅ hover:bg-stone-100
❌ hover:bg-gray-100 → ✅ hover:bg-stone-50
```

### ❌ Don't Mix Color Families:
- Use `stone-*` for TEXT only
- Use `gray-*` for STRUCTURE (borders, backgrounds)
- Never use `text-gray-*` - always use `text-stone-*`

## 🎨 Special Use Cases

### Progressive Disclosure Pattern
```tsx
const [showOptional, setShowOptional] = useState(false);

<button
  onClick={() => setShowOptional(!showOptional)}
  className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 mb-3 font-medium"
>
  <svg className="w-4 h-4">...</svg>
  {showOptional ? 'Hide optional fields' : 'Add more details'}
</button>

{showOptional && (
  <div className="space-y-3 mb-3 pb-3 border-t border-gray-100 pt-3">
    {/* Optional content */}
  </div>
)}
```

### Tab Pattern
```tsx
<div className="flex border-b border-gray-200 bg-gray-50">
  <button
    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
      active
        ? 'text-sky-600 border-b-2 border-sky-600 bg-white'
        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
    }`}
  >
    Tab Label
  </button>
</div>
```

### Badge Pattern
```tsx
// Status Badge
<span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
  New
</span>

// Tag Badge
<span className="px-2 py-0.5 text-xs bg-gray-100 text-stone-700 rounded">
  Tag
</span>
```

## 📱 Responsive Considerations

### Mobile-First Approach
```tsx
// Hide text on mobile, show on desktop
<span className="hidden sm:inline">Desktop Text</span>

// Stack on mobile, row on desktop
<div className="flex flex-col sm:flex-row gap-2">

// Full width on mobile, constrained on desktop
<div className="w-full max-w-4xl mx-auto">
```

### Touch-Friendly Sizes
```css
Minimum Button Height: 44px (py-2 with text)
Minimum Touch Target: 44px x 44px
Icon Buttons: w-8 h-8 or larger
Input Fields: py-2 (minimum 40px height)
```

## 🎯 Accessibility

### Color Contrast
- Text on white: `text-stone-900` (AAA)
- Secondary text: `text-stone-700` (AA)
- Muted text: `text-stone-600` (AA large)
- Icons: `text-stone-400` (decorative only)

### Focus States
```css
Always include: focus:outline-none focus:ring-2 focus:ring-sky-500
Never remove focus indicators without replacement
```

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order should follow visual order
- Enter/Space should activate buttons
- Escape should close modals/dialogs

## 🚀 Performance Tips

1. **Use Tailwind Classes** - They're optimized and purged
2. **Avoid Inline Styles** - Use Tailwind utilities
3. **Minimize Custom CSS** - Stick to the design system
4. **Reuse Components** - Don't duplicate patterns

## 📚 Quick Reference

### Color Token Map
```typescript
const colors = {
  background: '#F5F5F0',
  card: 'white',

  text: {
    primary: 'stone-900',
    body: 'stone-700',
    secondary: 'stone-600',
    muted: 'stone-500',
    icon: 'stone-400'
  },

  action: {
    primary: 'sky-500',
    primaryHover: 'sky-600',
    active: 'sky-600'
  },

  structure: {
    border: 'gray-200',
    inputBorder: 'gray-300',
    divider: 'gray-100',
    bg: 'gray-50'
  }
};
```

## ✅ Final Checklist Before Commit

- [ ] All text uses `stone-*` colors
- [ ] All structure uses `gray-*` colors
- [ ] All buttons have consistent styling
- [ ] All inputs have focus rings
- [ ] All icons have consistent sizing
- [ ] All cards have shadows and borders
- [ ] All hover states are defined
- [ ] All disabled states are styled
- [ ] Responsive classes added where needed
- [ ] Accessibility requirements met

---

**Remember:** Consistency is key! Follow these guidelines for every new component to maintain a cohesive, professional UI throughout the application.
