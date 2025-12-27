# Landing Page Builder - Architecture Guide

## Overview

This Laravel application implements a drag-and-drop landing page builder where clients can:
1. Drag components (text, images, buttons, etc.) from a sidebar
2. Drop them into a canvas area to design their landing page
3. Save the page structure as JSON
4. Render the final HTML output for use in the application

## Architecture Components

### 1. Database Layer

**Migration**: `database/migrations/xxxx_create_pages_table.php`
- Stores page metadata and content
- Fields:
  - `title`: Page title
  - `slug`: URL-friendly identifier
  - `content`: JSON structure of page elements
  - `html`: Rendered HTML output (optional, can be generated on-the-fly)
  - `is_published`: Publication status

**Model**: `app/Models/Page.php`
- Handles page data with JSON casting for the `content` field
- Provides easy access to page structure

### 2. Backend (Laravel)

**Controller**: `app/Http/Controllers/PageController.php`
- **CRUD Operations**:
  - `index()`: List all pages
  - `create()`: Show builder interface
  - `store()`: Save new page
  - `edit()`: Show builder with existing page
  - `update()`: Update existing page
  - `show()`: Display published page
  - `destroy()`: Delete page

- **API Endpoints**:
  - `POST /api/pages/save`: Save new page
  - `POST /api/pages/{id}/save`: Update existing page
  - `GET /api/pages/{id}/load`: Load page data

### 3. Frontend (Blade Templates + JavaScript)

**Views**:
- `resources/views/layouts/app.blade.php`: Main layout
- `resources/views/pages/index.blade.php`: Page listing
- `resources/views/pages/builder.blade.php`: Drag-and-drop builder interface
- `resources/views/pages/show.blade.php`: Public page display

**Builder Interface Structure**:
```
┌─────────────────────────────────────────┐
│  Header (Navigation)                     │
├──────────────┬──────────────────────────┤
│              │                           │
│  Sidebar    │      Canvas Area          │
│  (Components)│      (Drop Zone)          │
│              │                           │
│  - Text      │  [Dragged Elements]      │
│  - Heading   │                           │
│  - Image     │                           │
│  - Button    │                           │
│              │                           │
└──────────────┴──────────────────────────┘
```

### 4. Data Flow

#### Creating a Page:
1. User visits `/builder` (create route)
2. Drags components from sidebar to canvas
3. JavaScript captures drag events and adds elements to array
4. User clicks "Save"
5. JavaScript sends POST request with:
   - `title`: Page title
   - `content`: Array of element objects
   - `html`: Generated HTML string
6. Laravel saves to database
7. Redirects to edit page with ID

#### Element Structure:
```json
{
  "id": 1234567890,
  "type": "text|heading|image|button",
  "content": "Text content" // or object for complex types
}
```

#### Rendering:
- **In Builder**: Elements are rendered with edit controls (delete buttons, contenteditable)
- **In Public View**: Elements are rendered as clean HTML without builder controls

### 5. Drag-and-Drop Implementation

**HTML5 Drag API**:
- Components in sidebar have `draggable="true"`
- `dragstart` event captures component type
- Canvas has `dragover` and `drop` handlers
- JavaScript creates element objects and renders them

**Key JavaScript Functions**:
- `addElement(type)`: Creates new element object
- `renderElement(element, index)`: Renders element in DOM
- `generateHTML()`: Converts element array to HTML string
- `updateIndices()`: Maintains correct element indices after deletion

### 6. Routes

```php
// Public routes
GET  /                    → Redirects to pages index
GET  /pages               → List all pages
GET  /page/{slug}         → Display published page

// Builder routes
GET  /builder             → Create new page
GET  /builder/{id}       → Edit existing page

// API routes
POST /api/pages/save      → Save new page
POST /api/pages/{id}/save → Update page
GET  /api/pages/{id}/load → Load page data
```

## How It Works - Step by Step

### Step 1: User Opens Builder
- Visits `/builder` route
- Sees sidebar with components and empty canvas
- If editing, existing elements are loaded from database

### Step 2: Drag Component
- User drags "Text" component from sidebar
- JavaScript `dragstart` event fires
- Component type is stored in `dataTransfer`

### Step 3: Drop on Canvas
- User drops component on canvas
- JavaScript `drop` event fires
- New element object is created:
  ```javascript
  {
    id: 1234567890,
    type: 'text',
    content: 'Text content'
  }
  ```
- Element is added to `elements` array
- Element is rendered in DOM with edit controls

### Step 4: Edit Content
- User clicks on element text
- `contenteditable` allows inline editing
- On blur, element content is updated in array

### Step 5: Save Page
- User clicks "Save" button
- JavaScript generates HTML from elements array
- POST request sent to Laravel API
- Laravel saves:
  - JSON structure in `content` field
  - Generated HTML in `html` field
- Page is saved/updated in database

### Step 6: Display Page
- User visits `/page/{slug}`
- Laravel loads page from database
- If `html` exists, it's rendered directly
- Otherwise, elements are rendered from `content` JSON

## Extending the Builder

### Adding New Component Types:

1. **Add to Sidebar** (`builder.blade.php`):
```html
<div class="component-item" draggable="true" data-type="video">
    <span>Video</span>
</div>
```

2. **Add Default Content** (JavaScript):
```javascript
const defaults = {
    // ... existing
    video: { src: '', autoplay: false }
};
```

3. **Add Rendering Logic**:
```javascript
else if (element.type === 'video') {
    content = `<video src="${element.content.src}" controls></video>`;
}
```

4. **Add Display Logic** (`show.blade.php`):
```blade
@elseif($element['type'] === 'video')
    <video src="{{ $element['content']['src'] }}" controls></video>
@endif
```

## Best Practices

1. **Data Structure**: Keep element structure consistent
2. **Validation**: Validate element types on backend
3. **Sanitization**: Sanitize HTML output to prevent XSS
4. **Performance**: Consider lazy loading for large pages
5. **Versioning**: Store page versions for rollback capability
6. **Preview**: Always provide preview before publishing

## Security Considerations

- Sanitize user input before saving
- Validate element types on backend
- Use CSRF protection for all POST requests
- Escape HTML in contenteditable fields
- Consider using a WYSIWYG editor library for better security

## Future Enhancements

- Undo/Redo functionality
- Component templates
- Responsive preview (mobile/tablet/desktop)
- Export to static HTML
- Import from JSON
- Component library with custom components
- Real-time collaboration
- Version history


