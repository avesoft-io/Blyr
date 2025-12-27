/**
 * Page Builder JavaScript Module
 * Handles drag-and-drop page building functionality
 */
class PageBuilder {
    constructor(options) {
        this.dropZone = document.getElementById(options.dropZoneId || 'drop-zone');
        this.propertiesPanel = document.getElementById(options.propertiesPanelId || 'properties-panel');
        this.saveBtn = document.getElementById(options.saveBtnId || 'save-btn');
        this.previewBtn = document.getElementById(options.previewBtnId || 'preview-btn');
        this.pageTitle = options.pageTitleId ? document.getElementById(options.pageTitleId) : null;
        this.elements = options.elements || [];
        this.selectedElementIndex = null;
        this.csrfToken = options.csrfToken;
        this.saveUrl = options.saveUrl;
        this.updateUrl = options.updateUrl;
        this.uploadImageUrl = options.uploadImageUrl;
        this.redirectUrl = options.redirectUrl;
        
        // Initialize variables from config
        this.variables = options.variables || null;
        
        // Debounce timers for property updates
        this.propertyUpdateTimers = new Map();
        this.nestedPropertyUpdateTimers = new Map();
        
        // Flag to prevent duplicate drop handling
        this.isProcessingDrop = false;

        this.init();
    }
    
    /**
     * Debounce utility function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 500) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    init() {
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.initializeExistingElements();
    }

    setupDragAndDrop() {
        const componentItems = document.querySelectorAll('.component-item');
        
        componentItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
            });
        });

        this.dropZone.addEventListener('dragover', (e) => {
            // Don't handle dragover if we're over a column
            if (e.target.closest('.column-content') || e.target.closest('.layout-column')) {
                return; // Let the column handle it
            }
            
            // Check if we're dragging over a layout container (but not in a column)
            const layoutContainer = e.target.closest('.layout-container');
            if (layoutContainer && !e.target.closest('.column-content') && !e.target.closest('.layout-column')) {
                // Check if we're actually inside the layout container's bounds
                const layoutRect = layoutContainer.getBoundingClientRect();
                const dragY = e.clientY;
                const dragX = e.clientX;
                
                // Check if drag is within the layout's bounding box
                const isInsideLayout = dragY >= layoutRect.top && 
                                      dragY <= layoutRect.bottom && 
                                      dragX >= layoutRect.left && 
                                      dragX <= layoutRect.right;
                
                // Only ignore if we're actually dragging over the layout container
                // (not below it or outside it)
                if (isInsideLayout) {
                    // Dragging over the layout container itself (not in a column) - don't show drop zone highlight
                    return;
                }
                // Otherwise, dragging below or outside the layout, allow drop zone highlight
            }
            
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            // Check if drop is on a layout column - if so, let the column handle it
            const columnContent = e.target.closest('.column-content');
            const layoutColumn = e.target.closest('.layout-column');
            
            if (columnContent || layoutColumn) {
                // Don't handle this drop - let the column handle it
                console.log('Main dropZone: Ignoring drop on column');
                return;
            }
            
            // Check if we're dropping inside a layout container (but not in a column)
            // Only ignore if we're actually dropping on the layout container's grid area
            const layoutContainer = e.target.closest('.layout-container');
            if (layoutContainer && !columnContent && !layoutColumn) {
                // Check if the drop point is actually inside the layout's content area
                const layoutRect = layoutContainer.getBoundingClientRect();
                const dropY = e.clientY;
                const dropX = e.clientX;
                
                // Check if drop is within the layout's bounding box
                const isInsideLayout = dropY >= layoutRect.top && 
                                      dropY <= layoutRect.bottom && 
                                      dropX >= layoutRect.left && 
                                      dropX <= layoutRect.right;
                
                // Only ignore if we're actually dropping inside the layout container
                // (not below it or outside it)
                if (isInsideLayout) {
                    // Dropping on the layout container itself (not in a column) - ignore
                    return;
                }
                // Otherwise, drop is below or outside the layout, proceed with normal drop handling
            }
            
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling to other handlers
            this.dropZone.classList.remove('drag-over');
            
            const componentType = e.dataTransfer.getData('text/plain');
            if (componentType) {
                // Guard: Check if we're already processing this drop to prevent duplicates
                if (this.isProcessingDrop) {
                    console.warn('Drop already being processed, ignoring duplicate');
                    return;
                }
                
                this.isProcessingDrop = true;
                
                // Calculate insertion index based on drop position
                const insertIndex = this.calculateInsertIndex(e);
                this.addElement(componentType, insertIndex);
                
                // Reset flag after a short delay to allow the element to be added
                setTimeout(() => {
                    this.isProcessingDrop = false;
                }, 100);
            }
        }, false); // Use bubbling phase (default) so column handlers in capture phase fire first
    }

    setupEventListeners() {
        this.saveBtn.addEventListener('click', () => this.savePage());
        this.previewBtn.addEventListener('click', () => this.showPreview());
    }

    /**
     * Calculate the insertion index based on drop position
     * @param {DragEvent} e - The drop event
     * @returns {number} - The index where the element should be inserted
     */
    calculateInsertIndex(e) {
        const dropY = e.clientY;
        const existingElements = Array.from(this.dropZone.querySelectorAll('.builder-element'));
        
        // If no elements exist, insert at the beginning
        if (existingElements.length === 0) {
            return 0;
        }
        
        // Find which element the drop point is above or below
        for (let i = 0; i < existingElements.length; i++) {
            const element = existingElements[i];
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top;
            const elementBottom = rect.bottom;
            const elementMiddle = elementTop + (rect.height / 2);
            
            // If drop is above the middle of this element, insert before it
            if (dropY < elementMiddle) {
                return i;
            }
            
            // If drop is below this element's bottom, continue to next element
            // (This handles tall elements like layouts where drop might be below the element)
            if (dropY > elementBottom) {
                // Check if this is the last element
                if (i === existingElements.length - 1) {
                    return existingElements.length;
                }
                // Otherwise, continue checking next element
                continue;
            }
        }
        
        // If we get here, drop is below all elements
        return existingElements.length;
    }

    addElement(type, insertIndex = null) {
        const elementId = Date.now();
        const element = {
            id: elementId,
            type: type,
            content: this.getDefaultContent(type),
            styles: this.getDefaultStyles(type)
        };
        
        // If insertIndex is provided, insert at that position; otherwise append
        if (insertIndex !== null && insertIndex >= 0 && insertIndex <= this.elements.length) {
            this.elements.splice(insertIndex, 0, element);
            // Re-render all elements to update indices
            this.reRenderAllElements();
            this.selectElement(insertIndex);
        } else {
            // Append to end (backward compatibility)
            this.elements.push(element);
            this.renderElement(element, this.elements.length - 1);
            this.selectElement(this.elements.length - 1);
        }
    }
    
    /**
     * Re-render all elements to update their indices after insertion
     */
    reRenderAllElements() {
        // Save nested content from all layouts before re-rendering
        this.elements.forEach((element, index) => {
            if (element.type === 'layout') {
                this.saveNestedElementsContent(index);
            }
        });
        
        // Remove all builder elements
        const builderElements = this.dropZone.querySelectorAll('.builder-element');
        builderElements.forEach(el => el.remove());
        
        // Re-render all elements with correct indices
        this.elements.forEach((element, index) => {
            try {
                this.renderElement(element, index);
            } catch (error) {
                console.error(`Error rendering element at index ${index}:`, error);
                // Continue rendering other elements even if one fails
            }
        });
        
        // If no elements, show placeholder
        if (this.elements.length === 0) {
            const placeholder = this.dropZone.querySelector('p.text-gray-400, .drop-zone > div');
            if (!placeholder) {
                // Add placeholder if it doesn't exist
                const placeholderDiv = document.createElement('div');
                placeholderDiv.className = 'flex flex-col items-center justify-center h-full min-h-[400px]';
                placeholderDiv.innerHTML = `
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                    </div>
                    <p class="text-gray-500 font-medium mb-1">Drag components here</p>
                    <p class="text-gray-400 text-sm">to build your page</p>
                `;
                this.dropZone.appendChild(placeholderDiv);
            }
        }
    }

    getDefaultContent(type) {
        // Create factory functions to ensure each call returns a NEW object (not a shared reference)
        const defaults = {
            text: () => 'Text content',
            heading: () => 'Heading',
            image: () => ({ src: 'https://via.placeholder.com/400x200', alt: 'Image' }),
            button: () => ({ text: 'Button', link: '#' }),
            layout: () => ({ 
                columns: 2, 
                columnElements: Array.from({ length: 2 }, () => []) // Create new arrays each time
            }),
            // Invoice template components
            variable: () => ({ path: '', displayName: '' }),
            conditional: () => ({ condition: '', trueContent: [], falseContent: [], showElse: false }),
            loop: () => ({ loopVariable: '', itemVariable: 'item', content: [] }),
            'invoice-header': () => ({ title: 'Invoice', showUserInfo: true }),
            'invoice-info-table': () => ({ showClientInfo: true, showInvoiceDetails: true }),
            'invoice-items-table': () => ({ columns: ['description', 'amount'], loopVariable: 'invoice.other_expenses' }),
            'invoice-totals': () => ({ showSubtotal: true, showTotal: true }),
            'invoice-payment-info': () => ({ wrappedInConditional: true })
        };
        
        const factory = defaults[type];
        // If factory exists, call it to get a new object; otherwise return empty string
        return factory ? factory() : '';
    }

    getDefaultStyles(type) {
        // Base default styles
        const baseStyles = {
            margin: '0',
            padding: '10px',
            'text-align': 'left',
            'font-size': '',
            color: '#000000',
            'background-color': '',
            width: '',
            height: '',
            'border-radius': '0',
            'font-weight': 'normal'
        };

        // Type-specific defaults
        const typeDefaults = {
            text: {
                ...baseStyles,
                'font-size': '14px',
                padding: '10px',
                margin: '0 0 10px 0'
            },
            heading: {
                ...baseStyles,
                'font-size': '24px',
                'font-weight': 'bold',
                padding: '10px',
                margin: '0 0 15px 0'
            },
            image: {
                ...baseStyles,
                width: '100%',
                'max-width': '100%',
                height: 'auto',
                margin: '0 0 15px 0',
                padding: '0'
            },
            button: {
                ...baseStyles,
                'background-color': '#3b82f6',
                color: '#ffffff',
                padding: '10px 20px',
                'border-radius': '4px',
                'font-size': '14px',
                margin: '0 0 10px 0',
                'text-align': 'center',
                width: '150px',
                height: '40px'
            }
        };

        return typeDefaults[type] || baseStyles;
    }

    renderElement(element, index) {
        // If re-rendering, remove the old element first
        const oldElement = this.dropZone.querySelector(`[data-index="${index}"]`);
        if (oldElement) {
            oldElement.remove();
        }
        
        const elementDiv = document.createElement('div');
        elementDiv.className = 'builder-element';
        elementDiv.dataset.index = index;
        elementDiv.dataset.type = element.type;
        
        // For buttons, calculate container size to fit button + padding (12px on each side = 24px total)
        // This ensures the button fits properly inside the container
        if (element.type === 'button') {
            const buttonWidth = element.styles?.['width'] || '150px';
            const buttonHeight = element.styles?.['height'] || '40px';
            // Container needs to be button size + 24px (12px padding on each side from .builder-element)
            const containerWidth = `calc(${buttonWidth} + 24px)`;
            const containerHeight = `calc(${buttonHeight} + 24px)`;
            // Start with container sizing
            let containerStyles = `width: ${containerWidth}; min-width: ${containerWidth}; height: ${containerHeight}; min-height: ${containerHeight}; display: flex; align-items: center; justify-content: center;`;
            // Add other element styles if they exist (excluding width/height)
            if (element.styles) {
                const otherStylesObj = {};
                Object.keys(element.styles).forEach(key => {
                    if (key !== 'width' && key !== 'height') {
                        otherStylesObj[key] = element.styles[key];
                    }
                });
                const otherStylesStr = this.buildStylesFromObject(otherStylesObj);
                if (otherStylesStr) {
                    containerStyles += ` ${otherStylesStr}`;
                }
            }
            elementDiv.style.cssText = containerStyles;
        } else {
            // Apply styles normally for non-button elements
            if (element.styles) {
                elementDiv.style.cssText = this.buildStylesFromObject(element.styles);
            }
        }

        let content = '';
        if (element.type === 'text') {
            // Support variables in text content using ((variable.path)) syntax
            // Preserve line breaks by converting newlines to <br> tags
            const textContent = this.processVariableContentForEditor(element.content);
            const htmlContent = this.convertNewlinesToBr(textContent);
            content = `<p contenteditable="true" class="text-gray-700 variable-editable whitespace-pre-wrap" data-index="${index}">${htmlContent}</p>`;
        } else if (element.type === 'heading') {
            // Support variables in heading content using ((variable.path)) syntax
            const headingContent = this.processVariableContentForEditor(element.content);
            const htmlContent = this.convertNewlinesToBr(headingContent);
            content = `<h2 contenteditable="true" class="text-2xl font-bold text-gray-900 variable-editable whitespace-pre-wrap" data-index="${index}">${htmlContent}</h2>`;
        } else if (element.type === 'image') {
            const imgStyles = {};
            if (element.styles?.['image-width']) imgStyles['width'] = element.styles['image-width'];
            if (element.styles?.['image-height']) imgStyles['height'] = element.styles['image-height'];
            const imgStyleAttr = Object.keys(imgStyles).length > 0 ? ` style="${this.buildStylesFromObject(imgStyles)}"` : '';
            content = `<img src="${element.content.src || 'https://via.placeholder.com/400x200'}" alt="${element.content.alt || ''}"${imgStyleAttr}>`;
        } else if (element.type === 'button') {
            const btnStyles = {};
            if (element.styles?.['background-color']) btnStyles['background-color'] = element.styles['background-color'];
            if (element.styles?.['color']) btnStyles['color'] = element.styles['color'];
            if (element.styles?.['padding']) btnStyles['padding'] = element.styles['padding'];
            if (element.styles?.['border']) btnStyles['border'] = element.styles['border'];
            if (element.styles?.['border-radius']) btnStyles['border-radius'] = element.styles['border-radius'];
            // Apply width and height (use defaults if not set)
            const buttonWidth = element.styles?.['width'] || '150px';
            const buttonHeight = element.styles?.['height'] || '40px';
            btnStyles['width'] = buttonWidth;
            btnStyles['height'] = buttonHeight;
            // Set default padding if not specified
            if (!element.styles?.['padding']) {
                btnStyles['padding'] = '0.5rem 1.5rem';
            }
            const btnStyleAttr = Object.keys(btnStyles).length > 0 ? ` style="${this.buildStylesFromObject(btnStyles)}"` : '';
            // Add styles to prevent button from resizing on hover - lock dimensions explicitly
            const preventResizeStyles = `flex-shrink: 0; flex-grow: 0; box-sizing: border-box; transition: none; contain: layout style paint; width: ${buttonWidth}; height: ${buttonHeight};`;
            const finalBtnStyle = btnStyleAttr ? btnStyleAttr.replace('style="', `style="${preventResizeStyles}`) : ` style="${preventResizeStyles}"`;
            // Remove Tailwind padding classes - padding is now in inline styles
            content = `<button class="rounded-md resizable-button"${finalBtnStyle}>${element.content.text || 'Button'}</button>`;
        } else if (element.type === 'variable') {
            // Variable component - displays variable name inline and compact
            const variable = this.variables?.getVariableByPath(element.content?.path);
            const displayText = variable ? variable.displayName : (element.content?.displayName || 'Variable (Not Selected)');
            const bladeSyntax = this.variables?.pathToBlade(element.content?.path) || '{{ variable }}';
            content = `<span class="variable-display inline-block bg-blue-100 border border-blue-300 px-2 py-1 rounded text-sm align-middle">
                <span class="font-medium text-blue-900">${displayText}</span>
                <span class="text-xs text-blue-600 ml-1 font-mono">${bladeSyntax}</span>
            </span>`;
        } else if (element.type === 'conditional') {
            // Conditional block - visual wrapper for @if statements
            const conditionVar = element.content.condition || 'variable';
            const conditionDisplay = this.variables?.getVariableByPath(conditionVar);
            const conditionText = conditionDisplay ? conditionDisplay.displayName : conditionVar;
            content = `
                <div class="conditional-block border-2 border-purple-300 bg-purple-50 p-3 rounded">
                    <div class="conditional-header flex items-center mb-2">
                        <span class="bg-purple-600 text-white px-2 py-1 rounded text-xs mr-2">IF</span>
                        <span class="text-sm font-semibold">${conditionText} exists</span>
                    </div>
                    <div class="conditional-true-content min-h-20 p-2 bg-white border border-purple-200 rounded mb-2">
                        <p class="text-xs text-gray-500 mb-1">Show if true:</p>
                        <div class="conditional-content-area" data-type="true-content"></div>
                    </div>
                    ${element.content.showElse ? `
                    <div class="conditional-false-content min-h-20 p-2 bg-white border border-purple-200 rounded">
                        <p class="text-xs text-gray-500 mb-1">Show if false:</p>
                        <div class="conditional-content-area" data-type="false-content"></div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else if (element.type === 'loop') {
            // Loop block - visual wrapper for @foreach statements
            const loopVar = element.content.loopVariable || 'array';
            const itemVar = element.content.itemVariable || 'item';
            const loopDisplay = this.variables?.getVariableByPath(loopVar);
            const loopText = loopDisplay ? loopDisplay.displayName : loopVar;
            content = `
                <div class="loop-block border-2 border-green-300 bg-green-50 p-3 rounded">
                    <div class="loop-header flex items-center mb-2">
                        <span class="bg-green-600 text-white px-2 py-1 rounded text-xs mr-2">LOOP</span>
                        <span class="text-sm font-semibold">${loopText} (as ${itemVar})</span>
                    </div>
                    <div class="loop-content min-h-20 p-2 bg-white border border-green-200 rounded">
                        <p class="text-xs text-gray-500 mb-1">Repeat for each item:</p>
                        <div class="loop-content-area" data-type="loop-content"></div>
                    </div>
                </div>
            `;
        } else if (element.type === 'layout') {
            // Layout component with columns
            const columns = element.content.columns || 2;
            const columnElements = element.content.columnElements || [[], []];
            const gap = element.styles?.gap || '20px';
            
            // Build grid columns style
            const gridColumns = `repeat(${columns}, 1fr)`;
            
            content = `
                <div class="layout-container" style="display: grid; grid-template-columns: ${gridColumns}; gap: ${gap}; padding: 10px; min-height: 100px;">
                    ${Array.from({ length: columns }, (_, colIndex) => {
                        const colElements = columnElements[colIndex] || [];
                        return `
                            <div class="layout-column drop-zone-column" data-layout-index="${index}" data-column-index="${colIndex}" style="min-height: 50px; padding: 5px; background: #ffffff; border: 2px dashed #d1d5db; border-radius: 4px;">
                                <div class="column-header text-xs text-gray-500 mb-1">Column ${colIndex + 1}</div>
                                <div class="column-content drop-zone" data-layout-index="${index}" data-column-index="${colIndex}" style="min-height: 30px; position: relative; padding: 5px;">
                                    ${colElements.map((colElement, colElIndex) => {
                                        // Render nested element as full editable component
                                        return this.renderNestedElement(colElement, index, colIndex, colElIndex);
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (element.type === 'invoice-header') {
            // Pre-built invoice header component
            content = `
                <div class="invoice-header border-b-2 border-black pb-2 mb-4">
                    <div class="invoice-title text-2xl font-bold uppercase">${element.content.title || 'Invoice'}</div>
                    ${element.content.showUserInfo ? `
                    <div class="user-info mt-2">
                        <strong>[User Name]</strong><br>
                        [User Address]
                    </div>
                    ` : ''}
                </div>
            `;
        } else if (element.type === 'invoice-info-table') {
            // Pre-built invoice info table
            content = `
                <table class="w-full mb-4 border-collapse">
                    <tr>
                        ${element.content.showClientInfo ? `
                        <td class="border p-2">
                            <div class="font-bold text-red-800">Invoice To:</div>
                            <div class="font-bold">[Client Name]</div>
                            <div>[Client Address]</div>
                            [Client Tax]
                        </td>
                        ` : '<td></td>'}
                        ${element.content.showInvoiceDetails ? `
                        <td class="border p-2 text-right">
                            <div><strong>Invoice #:</strong> [Invoice Number]</div>
                            <div><strong>Date:</strong> [Invoice Date]</div>
                            <div><strong>Due:</strong> [Due Date]</div>
                        </td>
                        ` : '<td></td>'}
                    </tr>
                </table>
            `;
        } else if (element.type === 'invoice-items-table') {
            // Pre-built items table with loop support
            const loopVar = element.content.loopVariable || 'invoice.other_expenses';
            content = `
                <table class="w-full border-collapse">
                    <thead>
                        <tr>
                            ${element.content.columns.includes('description') ? '<th class="border p-2 bg-gray-200">Description</th>' : ''}
                            ${element.content.columns.includes('amount') ? '<th class="border p-2 bg-gray-200 text-right">Amount</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="loop-row" data-loop="${loopVar}">
                            ${element.content.columns.includes('description') ? '<td class="border p-2">[Item Label]</td>' : ''}
                            ${element.content.columns.includes('amount') ? '<td class="border p-2 text-right">$[Item Amount]</td>' : ''}
                        </tr>
                    </tbody>
                </table>
            `;
        } else if (element.type === 'invoice-totals') {
            // Pre-built totals section
            content = `
                <table class="w-full border-collapse mt-4">
                    <tbody>
                        ${element.content.showSubtotal ? `
                        <tr>
                            <td class="border p-2 font-bold">Sub-Total:</td>
                            <td class="border p-2 text-right">$[Invoice Total]</td>
                        </tr>
                        ` : ''}
                        ${element.content.showTotal ? `
                        <tr>
                            <td class="border p-2 font-bold">Total USD:</td>
                            <td class="border p-2 text-right font-bold">$[Invoice Total]</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        } else if (element.type === 'invoice-payment-info') {
            // Pre-built payment info table (wrapped in conditional)
            content = `
                <div class="payment-info mt-4">
                    <div class="font-bold mb-2">Payment Options:</div>
                    <div class="conditional-wrapper" data-condition="bankInfo">
                        <table class="w-full border-collapse mt-2">
                            <tr><td class="border p-2"><b>Bank Country:</b></td><td class="border p-2">[Bank Country]</td></tr>
                            <tr><td class="border p-2"><b>Bank:</b></td><td class="border p-2">[Bank Name]</td></tr>
                            <tr><td class="border p-2"><b>SWIFT/BIC Code:</b></td><td class="border p-2">[SWIFT Code]</td></tr>
                            <tr><td class="border p-2"><b>Account Number:</b></td><td class="border p-2">[Account Number]</td></tr>
                            <tr><td class="border p-2"><b>Account Name:</b></td><td class="border p-2">[User Name]</td></tr>
                            <tr><td class="border p-2"><b>Address:</b></td><td class="border p-2">[User Address]</td></tr>
                            <tr><td class="border p-2"><b>Phone:</b></td><td class="border p-2">[User Phone]</td></tr>
                        </table>
                        <div class="conditional-else" style="display: none;">
                            <p><em>No bank information assigned to this client.</em></p>
                        </div>
                    </div>
                </div>
            `;
        }

        elementDiv.innerHTML = content + '<button class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs delete-element shadow-lg" style="z-index: 10; font-size: 14px; line-height: 1;" title="Delete">×</button>';
        
        // Remove placeholder if exists
        const placeholder = this.dropZone.querySelector('.flex.flex-col.items-center.justify-center');
        if (placeholder) {
            placeholder.remove();
        }

        // Insert element at the correct position based on index
        // Get all existing builder elements sorted by their data-index attribute
        const existingElements = Array.from(this.dropZone.querySelectorAll('.builder-element'))
            .filter(el => {
                const elIndex = parseInt(el.dataset.index);
                return !isNaN(elIndex) && elIndex >= 0;
            })
            .sort((a, b) => {
                return parseInt(a.dataset.index) - parseInt(b.dataset.index);
            });
        
        // Find the element that should come after this one (element with index >= current index)
        const nextElement = existingElements.find(el => {
            const elIndex = parseInt(el.dataset.index);
            return !isNaN(elIndex) && elIndex >= index && this.dropZone.contains(el);
        });
        
        if (nextElement && this.dropZone.contains(nextElement)) {
            // Insert before the next element
            this.dropZone.insertBefore(elementDiv, nextElement);
        } else {
            // Append to end
            this.dropZone.appendChild(elementDiv);
        }

        // Apply initial styles
        this.updateElementInDOM(index);

        // Add click handler to select element
        elementDiv.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-element') && !e.target.closest('.nested-element')) {
                this.selectElement(index);
            }
        });

        // Add delete functionality
        const deleteBtn = elementDiv.querySelector('.delete-element');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedElementIndex === index) {
                    this.selectedElementIndex = null;
                    this.showEmptyProperties();
                }
                // Remove from array
                this.elements.splice(index, 1);
                // Re-render all elements to ensure proper cleanup and index synchronization
                this.reRenderAllElements();
            });
        }

        // If it's a layout, setup column drop zones and nested element handlers
        if (element.type === 'layout') {
            // Use a small delay to ensure DOM is ready
            setTimeout(() => {
                this.setupLayoutColumns(elementDiv, index);
                this.setupNestedElements(elementDiv, index);
            }, 0);
        }

        // Update content on edit and add variable autocomplete
        const editable = elementDiv.querySelector('[contenteditable="true"]');
        if (editable) {
            // Handle blur to save content
            // Preserve line breaks by converting <br> tags and divs to newlines
            editable.addEventListener('blur', () => {
                // Get HTML content and convert <br> tags and block elements to newlines
                const htmlContent = editable.innerHTML;
                // Convert <br> tags to newlines, and <div> elements to newlines
                const textContent = htmlContent
                    .replace(/<br\s*\/?>/gi, '\n')  // Convert <br> to newline
                    .replace(/<\/div>/gi, '\n')      // Convert closing div to newline
                    .replace(/<div[^>]*>/gi, '')     // Remove opening div tags
                    .replace(/<\/p>/gi, '\n')        // Convert closing p to newline
                    .replace(/<p[^>]*>/gi, '')       // Remove opening p tags
                    .replace(/&nbsp;/gi, ' ')         // Convert &nbsp; to space
                    .trim();
                
                // Strip HTML tags but preserve newlines
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = textContent;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                
                this.elements[index].content = plainText;
            });
            
            // Add variable autocomplete when typing (( in text/heading elements
            if (editable.classList.contains('variable-editable')) {
                this.setupVariableAutocomplete(editable, index);
            }
        }
    }

    selectElement(index) {
        // Remove previous selection
        document.querySelectorAll('.builder-element').forEach(el => {
            el.classList.remove('selected');
        });

        // Add selection to current element
        const elementDiv = this.dropZone.querySelector(`[data-index="${index}"]`);
        if (elementDiv) {
            elementDiv.classList.add('selected');
            this.selectedElementIndex = index;
            this.showPropertiesPanel(index);
        }
    }

    showPropertiesPanel(index) {
        const element = this.elements[index];
        if (!element) return;

        let html = '<div class="space-y-4">';
        
        // Common properties
        html += '<div class="property-group">';
        html += '<label class="property-label">Margin</label>';
        html += `<input type="text" class="property-input" data-property="margin" value="${element.styles?.margin || ''}" placeholder="e.g., 10px 20px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Padding</label>';
        html += `<input type="text" class="property-input" data-property="padding" value="${element.styles?.padding || ''}" placeholder="e.g., 10px 20px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Border</label>';
        html += `<input type="text" class="property-input" data-property="border" value="${element.styles?.border || ''}" placeholder="e.g., 1px solid #000">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Border Radius</label>';
        html += `<input type="text" class="property-input" data-property="border-radius" value="${element.styles?.['border-radius'] || ''}" placeholder="e.g., 8px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Text Align</label>';
        html += `<select class="property-input" data-property="text-align">`;
        html += `<option value="left" ${element.styles?.['text-align'] === 'left' ? 'selected' : ''}>Left</option>`;
        html += `<option value="center" ${element.styles?.['text-align'] === 'center' ? 'selected' : ''}>Center</option>`;
        html += `<option value="right" ${element.styles?.['text-align'] === 'right' ? 'selected' : ''}>Right</option>`;
        html += `<option value="justify" ${element.styles?.['text-align'] === 'justify' ? 'selected' : ''}>Justify</option>`;
        html += `</select>`;
        html += '</div>';

        // Width property - skip for buttons as they have their own width property
        if (element.type !== 'button') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="width" value="${element.styles?.width || ''}" placeholder="e.g., 100%, 500px">`;
            html += '</div>';
        }

        // Type-specific properties
        if (element.type === 'text' || element.type === 'heading') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Font Size</label>';
            html += `<input type="text" class="property-input" data-property="font-size" value="${element.styles?.['font-size'] || ''}" placeholder="e.g., 16px, 1.5rem">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Font Weight</label>';
            html += `<select class="property-input" data-property="font-weight">`;
            html += `<option value="normal" ${element.styles?.['font-weight'] === 'normal' ? 'selected' : ''}>Normal</option>`;
            html += `<option value="bold" ${element.styles?.['font-weight'] === 'bold' ? 'selected' : ''}>Bold</option>`;
            html += `<option value="300" ${element.styles?.['font-weight'] === '300' ? 'selected' : ''}>Light</option>`;
            html += `<option value="600" ${element.styles?.['font-weight'] === '600' ? 'selected' : ''}>Semi-bold</option>`;
            html += `</select>`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Text Color</label>';
            html += `<input type="color" class="property-input" data-property="color" value="${element.styles?.color || '#000000'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Background Color</label>';
            html += `<input type="color" class="property-input" data-property="background-color" value="${element.styles?.['background-color'] || '#ffffff'}">`;
            html += '</div>';
        }

        if (element.type === 'image') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Image Upload</label>';
            html += '<div class="upload-area" id="image-upload-area">';
            html += '<input type="file" id="image-upload-input" accept="image/*" style="display: none;">';
            html += '<p class="text-sm text-gray-600">Click or drag to upload</p>';
            html += '</div>';
            if (element.content.src && element.content.src !== 'https://via.placeholder.com/400x200') {
                html += `<img src="${element.content.src}" alt="Preview" class="image-preview" id="image-preview">`;
            }
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Image Alt Text</label>';
            html += `<input type="text" class="property-input" data-property="alt" value="${element.content.alt || ''}" placeholder="Alt text">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Image URL</label>';
            html += `<input type="text" class="property-input" data-property="src" value="${element.content.src || ''}" placeholder="Image URL">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="image-width" value="${element.styles?.['image-width'] || ''}" placeholder="e.g., 100%, 500px">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Height</label>';
            html += `<input type="text" class="property-input" data-property="image-height" value="${element.styles?.['image-height'] || ''}" placeholder="e.g., auto, 300px">`;
            html += '</div>';
        }

        if (element.type === 'layout') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Number of Columns</label>';
            html += `<select class="property-input" data-property="columns" id="layout-columns-select">`;
            for (let i = 1; i <= 4; i++) {
                html += `<option value="${i}" ${(element.content?.columns || 2) === i ? 'selected' : ''}>${i} Column${i > 1 ? 's' : ''}</option>`;
            }
            html += `</select>`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Gap Between Columns</label>';
            html += `<input type="text" class="property-input" data-property="gap" value="${element.styles?.gap || '20px'}" placeholder="e.g., 20px, 1rem">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Background Color</label>';
            html += `<input type="color" class="property-input" data-property="background-color" value="${element.styles?.['background-color'] || '#f9fafb'}">`;
            html += '</div>';
        }

        if (element.type === 'button') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Button Text</label>';
            html += `<input type="text" class="property-input" data-property="button-text" value="${element.content.text || 'Button'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Button Link</label>';
            html += `<input type="text" class="property-input" data-property="button-link" value="${element.content.link || '#'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="width" value="${element.styles?.width || '150px'}" placeholder="e.g., 150px, 100%">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Height</label>';
            html += `<input type="text" class="property-input" data-property="height" value="${element.styles?.height || '40px'}" placeholder="e.g., 40px, auto">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Background Color</label>';
            html += `<input type="color" class="property-input" data-property="background-color" value="${element.styles?.['background-color'] || '#2563eb'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Text Color</label>';
            html += `<input type="color" class="property-input" data-property="color" value="${element.styles?.color || '#ffffff'}">`;
            html += '</div>';
        }

        // Show variable hint for text and heading elements
        if ((element.type === 'text' || element.type === 'heading') && this.variables) {
            html += '<div class="property-group bg-blue-50 p-3 rounded mb-3 border border-blue-200">';
            html += '<label class="property-label text-sm font-semibold text-blue-900 mb-2 block">💡 Variable Hint</label>';
            html += '<p class="text-xs text-blue-700 mb-2">Type <code class="bg-blue-100 px-1 rounded">((</code> in the text to see available variables</p>';
            html += '<div class="text-xs text-blue-600 max-h-32 overflow-y-auto space-y-1">';
            const allVars = this.variables.getAllVariables();
            allVars.slice(0, 5).forEach(variable => {
                html += `<div class="mb-1"><code class="text-xs bg-blue-100 px-1 rounded">((${variable.path}))</code> - ${variable.displayName}</div>`;
            });
            if (allVars.length > 5) {
                html += `<div class="text-xs text-blue-500 mt-1 italic">... and ${allVars.length - 5} more variables</div>`;
            }
            html += '</div>';
            html += '</div>';
        }

        if (element.type === 'conditional') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Condition Variable</label>';
            html += '<select class="property-input" data-property="condition">';
            html += '<option value="">-- Select Variable --</option>';
            
            if (this.variables) {
                const allVars = this.variables.getAllVariables();
                allVars.forEach(variable => {
                    const selected = element.content.condition === variable.path ? 'selected' : '';
                    html += `<option value="${variable.path}" ${selected}>${variable.displayName}</option>`;
                });
            }
            
            html += '</select>';
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showElse" ${element.content.showElse ? 'checked' : ''}>`;
            html += ' Show else content';
            html += '</label>';
            html += '</div>';
        }

        if (element.type === 'loop') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Loop Variable (Array)</label>';
            html += '<select class="property-input" data-property="loopVariable">';
            html += '<option value="">-- Select Array Variable --</option>';
            
            if (this.variables) {
                const arrayVars = this.variables.getAllVariables().filter(v => v.type === 'array');
                arrayVars.forEach(variable => {
                    const selected = element.content.loopVariable === variable.path ? 'selected' : '';
                    html += `<option value="${variable.path}" ${selected}>${variable.displayName}</option>`;
                });
            }
            
            html += '</select>';
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Item Variable Name</label>';
            html += `<input type="text" class="property-input" data-property="itemVariable" value="${element.content.itemVariable || 'item'}" placeholder="e.g., expense, item">`;
            html += '</div>';
        }

        if (element.type === 'invoice-header') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Invoice Title</label>';
            html += `<input type="text" class="property-input" data-property="title" value="${element.content.title || 'Invoice'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showUserInfo" ${element.content.showUserInfo ? 'checked' : ''}>`;
            html += ' Show User Information';
            html += '</label>';
            html += '</div>';
        }

        if (element.type === 'invoice-info-table') {
            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showClientInfo" ${element.content.showClientInfo ? 'checked' : ''}>`;
            html += ' Show Client Information';
            html += '</label>';
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showInvoiceDetails" ${element.content.showInvoiceDetails ? 'checked' : ''}>`;
            html += ' Show Invoice Details';
            html += '</label>';
            html += '</div>';
        }

        if (element.type === 'invoice-items-table') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Loop Variable</label>';
            html += '<select class="property-input" data-property="loopVariable">';
            html += '<option value="">-- Select Array Variable --</option>';
            
            if (this.variables) {
                const arrayVars = this.variables.getAllVariables().filter(v => v.type === 'array');
                arrayVars.forEach(variable => {
                    const selected = element.content.loopVariable === variable.path ? 'selected' : '';
                    html += `<option value="${variable.path}" ${selected}>${variable.displayName}</option>`;
                });
            }
            
            html += '</select>';
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Table Columns</label>';
            html += '<div class="space-y-2">';
            html += `<label><input type="checkbox" data-column="description" ${element.content.columns?.includes('description') ? 'checked' : ''}> Description</label><br>`;
            html += `<label><input type="checkbox" data-column="amount" ${element.content.columns?.includes('amount') ? 'checked' : ''}> Amount</label>`;
            html += '</div>';
            html += '</div>';
        }

        if (element.type === 'invoice-totals') {
            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showSubtotal" ${element.content.showSubtotal ? 'checked' : ''}>`;
            html += ' Show Sub-Total';
            html += '</label>';
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">';
            html += `<input type="checkbox" data-property="showTotal" ${element.content.showTotal ? 'checked' : ''}>`;
            html += ' Show Total';
            html += '</label>';
            html += '</div>';
        }

        html += '</div>';

        this.propertiesPanel.innerHTML = html;

        // Attach event listeners
        this.attachPropertyListeners(index);

        // Image upload handling
        if (element.type === 'image') {
            this.setupImageUpload(index);
        }
    }

    attachPropertyListeners(index) {
        const inputs = this.propertiesPanel.querySelectorAll('.property-input');
        inputs.forEach(input => {
            // Check if it's a text input or color input (needs debounce)
            const isTextInput = input.type === 'text' || input.type === 'color' || input.tagName === 'INPUT';
            const isSelect = input.tagName === 'SELECT';
            
            if (isTextInput && !isSelect) {
                // Create or get debounced update function for this input
                const timerKey = `${index}-${input.dataset.property}`;
                if (!this.propertyUpdateTimers.has(timerKey)) {
                    const debouncedUpdate = this.debounce((prop, val) => {
                        this.updateProperty(index, prop, val);
                    }, 500);
                    this.propertyUpdateTimers.set(timerKey, debouncedUpdate);
                }
                
                const debouncedUpdate = this.propertyUpdateTimers.get(timerKey);
                
                // Use debounced update for input events
                input.addEventListener('input', () => {
                    debouncedUpdate(input.dataset.property, input.value);
                });
                
                // Still update immediately on blur (when user leaves the field)
                input.addEventListener('blur', () => {
                    // Update immediately when user leaves the field
                    this.updateProperty(index, input.dataset.property, input.value);
                });
            } else {
                // For selects, update immediately
                input.addEventListener('change', () => {
                    this.updateProperty(index, input.dataset.property, input.value);
                });
            }
        });

        // Handle checkboxes
        const checkboxes = this.propertiesPanel.querySelectorAll('input[type="checkbox"][data-property]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateProperty(index, checkbox.dataset.property, checkbox.checked);
            });
        });

        // Handle layout columns change
        const layoutColumnsSelect = this.propertiesPanel.querySelector('#layout-columns-select');
        if (layoutColumnsSelect) {
            layoutColumnsSelect.addEventListener('change', (e) => {
                const newColumns = parseInt(e.target.value);
                this.updateLayoutColumns(index, newColumns);
            });
        }


        // Handle column checkboxes for invoice-items-table
        const columnCheckboxes = this.propertiesPanel.querySelectorAll('input[type="checkbox"][data-column]');
        if (columnCheckboxes.length > 0) {
            columnCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    if (!this.elements[index].content.columns) {
                        this.elements[index].content.columns = [];
                    }
                    const column = checkbox.dataset.column;
                    if (checkbox.checked) {
                        if (!this.elements[index].content.columns.includes(column)) {
                            this.elements[index].content.columns.push(column);
                        }
                    } else {
                        const idx = this.elements[index].content.columns.indexOf(column);
                        if (idx > -1) {
                            this.elements[index].content.columns.splice(idx, 1);
                        }
                    }
                    this.updateElementInDOM(index);
                });
            });
        }
    }

    updateProperty(index, property, value) {
        if (!this.elements[index].styles) {
            this.elements[index].styles = this.getDefaultStyles(this.elements[index].type);
        }

        // Handle layout columns property
        if (property === 'columns' && this.elements[index].type === 'layout') {
            this.updateLayoutColumns(index, parseInt(value));
            return;
        }

        // Handle special properties for content
        if (property === 'alt' || property === 'src' || property === 'button-text' || property === 'button-link') {
            if (property === 'src') {
                this.elements[index].content.src = value;
            } else if (property === 'alt') {
                this.elements[index].content.alt = value;
            } else if (property === 'button-text') {
                this.elements[index].content.text = value;
            } else if (property === 'button-link') {
                this.elements[index].content.link = value;
            }
        } 
        // Handle invoice component properties
        else if (property === 'condition' || property === 'loopVariable' || property === 'itemVariable' || 
                 property === 'title' || property === 'showUserInfo' || property === 'showClientInfo' || 
                 property === 'showInvoiceDetails' || property === 'showSubtotal' || property === 'showTotal' ||
                 property === 'showElse') {
            // These are content properties, not styles
            if (property === 'showUserInfo' || property === 'showClientInfo' || property === 'showInvoiceDetails' ||
                property === 'showSubtotal' || property === 'showTotal' || property === 'showElse') {
                // Boolean properties
                this.elements[index].content[property] = value === true || value === 'true' || value === 'checked';
            } else {
                // String properties
                this.elements[index].content[property] = value;
            }
        }
        else if (property === 'image-width' || property === 'image-height') {
            // Store image-specific dimensions
            this.elements[index].styles[property] = value;
        } else {
            // Regular style properties
            this.elements[index].styles[property] = value;
        }

        // Update element in DOM immediately for live preview
        this.updateElementInDOM(index);
    }

    setupImageUpload(index) {
        const uploadArea = document.getElementById('image-upload-area');
        const uploadInput = document.getElementById('image-upload-input');

        if (!uploadArea || !uploadInput) return;

        uploadArea.addEventListener('click', () => uploadInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadImage(files[0], index);
            }
        });

        uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadImage(e.target.files[0], index);
            }
        });
    }

    uploadImage(file, index) {
        const formData = new FormData();
        formData.append('image', file);

        fetch(this.uploadImageUrl, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': this.csrfToken
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.elements[index].content.src = data.url;
                this.updateElementInDOM(index);
                this.showPropertiesPanel(index); // Refresh properties panel
            } else {
                alert('Error uploading image');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error uploading image');
        });
    }

    updateElementInDOM(index) {
        const element = this.elements[index];
        const elementDiv = this.dropZone.querySelector(`[data-index="${index}"]`);
        if (!elementDiv) return;

        // Build styles object excluding image-specific and button-specific styles
        const containerStyles = {};
        const imageStyles = {};
        const buttonStyles = {};
        
        Object.keys(element.styles || {}).forEach(key => {
            if (key === 'image-width' || key === 'image-height') {
                // Map to standard CSS properties for image
                if (key === 'image-width') imageStyles['width'] = element.styles[key];
                if (key === 'image-height') imageStyles['height'] = element.styles[key];
            } else if (key === 'background-color' && element.type === 'button') {
                buttonStyles['background-color'] = element.styles[key];
            } else if (key === 'color' && element.type === 'button') {
                buttonStyles['color'] = element.styles[key];
            } else {
                containerStyles[key] = element.styles[key];
            }
        });

        // Apply container styles
        elementDiv.style.cssText = this.buildStylesFromObject(containerStyles);

        // Update content based on type
        if (element.type === 'text') {
            const p = elementDiv.querySelector('p');
            if (p) {
                // Process variables in text content for display (keep ((variable.path)) syntax)
                const textContent = this.processVariableContentForEditor(element.content);
                p.textContent = textContent;
                // Apply text-specific styles to the paragraph
                const textStyles = {};
                if (element.styles?.['font-size']) textStyles['font-size'] = element.styles['font-size'];
                if (element.styles?.['font-weight']) textStyles['font-weight'] = element.styles['font-weight'];
                if (element.styles?.['color']) textStyles['color'] = element.styles['color'];
                if (element.styles?.['text-align']) textStyles['text-align'] = element.styles['text-align'];
                if (element.styles?.['background-color']) textStyles['background-color'] = element.styles['background-color'];
                p.style.cssText = this.buildStylesFromObject(textStyles);
            }
        } else if (element.type === 'heading') {
            const h2 = elementDiv.querySelector('h2');
            if (h2) {
                // Process variables in heading content for display (keep ((variable.path)) syntax)
                // Preserve line breaks by converting newlines to <br> tags
                const headingContent = this.processVariableContentForEditor(element.content);
                const htmlContent = this.convertNewlinesToBr(headingContent);
                h2.innerHTML = htmlContent;
                // Apply heading-specific styles
                const headingStyles = {};
                if (element.styles?.['font-size']) headingStyles['font-size'] = element.styles['font-size'];
                if (element.styles?.['font-weight']) headingStyles['font-weight'] = element.styles['font-weight'];
                if (element.styles?.['color']) headingStyles['color'] = element.styles['color'];
                if (element.styles?.['text-align']) headingStyles['text-align'] = element.styles['text-align'];
                if (element.styles?.['background-color']) headingStyles['background-color'] = element.styles['background-color'];
                h2.style.cssText = this.buildStylesFromObject(headingStyles);
            }
        } else if (element.type === 'image') {
            const img = elementDiv.querySelector('img');
            if (img) {
                img.src = element.content.src || 'https://via.placeholder.com/400x200';
                img.alt = element.content.alt || '';
                // Apply image-specific styles (width, height, border, etc.)
                const imgStyles = Object.assign({}, imageStyles);
                if (element.styles?.['border']) imgStyles['border'] = element.styles['border'];
                if (element.styles?.['border-radius']) imgStyles['border-radius'] = element.styles['border-radius'];
                if (element.styles?.['object-fit']) imgStyles['object-fit'] = element.styles['object-fit'];
                img.style.cssText = this.buildStylesFromObject(imgStyles);
            }
        } else if (element.type === 'button') {
            const button = elementDiv.querySelector('button:not(.delete-element)');
            if (button) {
                button.textContent = element.content.text || 'Button';
                // Apply button-specific styles
                const btnStyles = Object.assign({}, buttonStyles);
                if (element.styles?.['padding']) btnStyles['padding'] = element.styles['padding'];
                if (element.styles?.['border']) btnStyles['border'] = element.styles['border'];
                if (element.styles?.['border-radius']) btnStyles['border-radius'] = element.styles['border-radius'];
                if (element.styles?.['font-size']) btnStyles['font-size'] = element.styles['font-size'];
                if (element.styles?.['font-weight']) btnStyles['font-weight'] = element.styles['font-weight'];
                // Apply width and height (use defaults if not set)
                const buttonWidth = element.styles?.['width'] || '150px';
                const buttonHeight = element.styles?.['height'] || '40px';
                btnStyles['width'] = buttonWidth;
                btnStyles['height'] = buttonHeight;
                // Set default padding if not specified
                if (!element.styles?.['padding']) {
                    btnStyles['padding'] = '0.5rem 1.5rem';
                }
                // Lock button dimensions
                btnStyles['flex-shrink'] = '0';
                btnStyles['flex-grow'] = '0';
                btnStyles['box-sizing'] = 'border-box';
                btnStyles['transition'] = 'none';
                btnStyles['contain'] = 'layout style paint';
                btnStyles['margin'] = '0';
                button.style.cssText = this.buildStylesFromObject(btnStyles);
                
                // Update container size to fit button + padding (12px on each side = 24px total)
                const containerWidth = `calc(${buttonWidth} + 24px)`;
                const containerHeight = `calc(${buttonHeight} + 24px)`;
                elementDiv.style.width = containerWidth;
                elementDiv.style.minWidth = containerWidth;
                elementDiv.style.height = containerHeight;
                elementDiv.style.minHeight = containerHeight;
                elementDiv.style.display = 'flex';
                elementDiv.style.alignItems = 'center';
                elementDiv.style.justifyContent = 'center';
            }
        } else if (element.type === 'variable') {
            // Variable component - update display with variable name (inline and compact)
            const variableDisplay = elementDiv.querySelector('.variable-display');
            if (variableDisplay && this.variables && element.content && element.content.path) {
                const variable = this.variables.getVariableByPath(element.content.path);
                if (variable) {
                    const bladeSyntax = this.variables.pathToBlade(element.content.path);
                    variableDisplay.innerHTML = `
                        <span class="font-medium text-blue-900">${variable.displayName}</span>
                        <span class="text-xs text-blue-600 ml-1 font-mono">${bladeSyntax}</span>
                    `;
                }
            } else if (variableDisplay && (!element.content || !element.content.path)) {
                // Show placeholder if no variable selected
                variableDisplay.innerHTML = `
                    <span class="font-medium text-gray-500">Variable (Not Selected)</span>
                    <span class="text-xs text-gray-400 ml-1 font-mono">{{ variable }}</span>
                `;
            }
        } else if (element.type === 'conditional') {
            // Update conditional block condition display
            const conditionText = elementDiv.querySelector('.conditional-header span:last-child');
            if (conditionText && this.variables && element.content.condition) {
                const variable = this.variables.getVariableByPath(element.content.condition);
                if (variable) {
                    conditionText.textContent = variable.displayName + ' exists';
                } else {
                    conditionText.textContent = element.content.condition + ' exists';
                }
            }
        } else if (element.type === 'loop') {
            // Update loop block variable display
            const loopText = elementDiv.querySelector('.loop-header span:last-child');
            if (loopText && this.variables && element.content.loopVariable) {
                const variable = this.variables.getVariableByPath(element.content.loopVariable);
                const itemVar = element.content.itemVariable || 'item';
                if (variable) {
                    loopText.textContent = variable.displayName + ' (as ' + itemVar + ')';
                } else {
                    loopText.textContent = element.content.loopVariable + ' (as ' + itemVar + ')';
                }
            }
        }
    }

    buildStylesFromObject(styles) {
        if (!styles) return '';
        return Object.entries(styles)
            .filter(([key, value]) => value !== null && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ');
    }

    showEmptyProperties() {
        this.propertiesPanel.innerHTML = '<p class="text-gray-500 text-sm">Select an element to edit its properties</p>';
    }

    updateIndices() {
        const allElements = this.dropZone.querySelectorAll('.builder-element');
        allElements.forEach((el, index) => {
            el.dataset.index = index;
        });
    }

    initializeExistingElements() {
        if (this.elements.length === 0) return;

        // Clear placeholder
        const placeholder = this.dropZone.querySelector('p.text-gray-400');
        if (placeholder) {
            placeholder.remove();
        }
        
        this.elements.forEach((element, index) => {
            if (!element.styles) {
                element.styles = this.getDefaultStyles(element.type);
            }
            this.renderElement(element, index);
        });
    }

    /**
     * Generate HTML from elements array
     * Converts visual structure to Blade template syntax for invoice templates
     * @returns {string} Generated HTML/Blade template
     */
    generateHTML() {
        let html = '';
        this.elements.forEach(element => {
            html += this.generateElementHTML(element);
        });
        return html;
    }

    /**
     * Generate HTML for preview with variables replaced with actual values
     * @returns {string} Generated HTML with variable values
     */
    generatePreviewHTML() {
        let html = '';
        this.elements.forEach(element => {
            html += this.generatePreviewElementHTML(element);
        });
        return html;
    }

    /**
     * Generate preview HTML for a single element with variables replaced
     * @param {Object} element - Element object
     * @returns {string} Generated HTML with variable values
     */
    generatePreviewElementHTML(element) {
        const styles = this.buildStylesFromObject(element.styles || {});
        const styleAttr = styles ? ` style="${this.escapeHtml(styles)}"` : '';
        
        if (element.type === 'text') {
            // Process content and replace ((variable.path)) with actual values
            const content = this.processVariableContent(element.content || '', true);
            // Convert newlines to <br> tags for preview display
            const htmlContent = this.convertNewlinesToBr(content);
            return `<p${styleAttr}>${htmlContent}</p>`;
        } else if (element.type === 'heading') {
            // Process content and replace ((variable.path)) with actual values
            const content = this.processVariableContent(element.content || '', true);
            // Convert newlines to <br> tags for preview display
            const htmlContent = this.convertNewlinesToBr(content);
            return `<h2${styleAttr}>${htmlContent}</h2>`;
        } else if (element.type === 'image') {
            const src = element.content?.src || 'https://via.placeholder.com/400x200';
            const alt = this.escapeHtml(element.content?.alt || '');
            return `<img src="${src}" alt="${alt}"${styleAttr}>`;
        } else if (element.type === 'button') {
            const link = element.content?.link || '#';
            const text = this.processVariableContent(element.content?.text || 'Button', true);
            // Convert newlines to <br> tags for preview display
            const htmlText = this.convertNewlinesToBr(text);
            
            // Build button-specific styles (width, height, colors, padding, border-radius)
            const btnStyles = {};
            if (element.styles?.['background-color']) btnStyles['background-color'] = element.styles['background-color'];
            if (element.styles?.['color']) btnStyles['color'] = element.styles['color'];
            if (element.styles?.['padding']) btnStyles['padding'] = element.styles['padding'];
            if (element.styles?.['border']) btnStyles['border'] = element.styles['border'];
            if (element.styles?.['border-radius']) btnStyles['border-radius'] = element.styles['border-radius'];
            // Apply width and height (use defaults if not set)
            btnStyles['width'] = element.styles?.['width'] || '150px';
            btnStyles['height'] = element.styles?.['height'] || '40px';
            if (element.styles?.['text-align']) btnStyles['text-align'] = element.styles['text-align'];
            
            const btnStyleAttr = Object.keys(btnStyles).length > 0 ? ` style="${this.escapeHtml(this.buildStylesFromObject(btnStyles))}"` : '';
            return `<a href="${link}"><button${btnStyleAttr}>${htmlText}</button></a>`;
        } else if (element.type === 'layout') {
            // Generate layout HTML for preview with columns
            const columns = element.content.columns || 2;
            const columnElements = element.content.columnElements || [[], []];
            const gap = element.styles?.gap || '20px';
            const gridColumns = `repeat(${columns}, 1fr)`;
            
            let layoutHtml = `<div class="layout-container" style="display: grid; grid-template-columns: ${gridColumns}; gap: ${gap};"${styleAttr}>`;
            
            columnElements.forEach((colElements, colIndex) => {
                layoutHtml += `<div class="layout-column">`;
                colElements.forEach((colElement) => {
                    layoutHtml += this.generatePreviewElementHTML(colElement);
                });
                layoutHtml += `</div>`;
            });
            
            layoutHtml += `</div>`;
            return layoutHtml;
        }
        
        // For other element types, generate regular HTML (they don't have inline variables)
        return this.generateElementHTML(element);
    }

    /**
     * Generate HTML for a single element
     * Handles conversion to Blade syntax for invoice templates
     * @param {Object} element - Element object
     * @returns {string} Generated HTML/Blade code
     */
    generateElementHTML(element) {
        const styles = this.buildStylesFromObject(element.styles || {});
        const styleAttr = styles ? ` style="${this.escapeHtml(styles)}"` : '';
        
        if (element.type === 'text') {
            // Process variables in text content
            const content = this.processContentForBlade(element.content);
            return `<p${styleAttr}>${content}</p>`;
        } else if (element.type === 'heading') {
            const content = this.processContentForBlade(element.content);
            return `<h2${styleAttr}>${content}</h2>`;
        } else if (element.type === 'image') {
            const src = this.processContentForBlade(element.content.src || '');
            const alt = this.escapeHtml(element.content.alt || '');
            return `<img src="${src}" alt="${alt}"${styleAttr}>`;
        } else if (element.type === 'button') {
            const link = this.processContentForBlade(element.content.link || '#');
            const text = this.processContentForBlade(element.content.text || 'Button');
            return `<a href="${link}"${styleAttr}><button>${text}</button></a>`;
        } else if (element.type === 'layout') {
            // Generate layout HTML with columns
            const columns = element.content.columns || 2;
            const columnElements = element.content.columnElements || [[], []];
            const gap = element.styles?.gap || '20px';
            const gridColumns = `repeat(${columns}, 1fr)`;
            
            let layoutHtml = `<div class="layout-container" style="display: grid; grid-template-columns: ${gridColumns}; gap: ${gap};"${styleAttr}>`;
            
            columnElements.forEach((colElements, colIndex) => {
                layoutHtml += `<div class="layout-column">`;
                colElements.forEach((colElement) => {
                    layoutHtml += this.generateElementHTML(colElement);
                });
                layoutHtml += `</div>`;
            });
            
            layoutHtml += `</div>`;
            return layoutHtml;
        } else if (element.type === 'variable') {
            // Convert variable path to Blade syntax
            if (this.variables && element.content.path) {
                return this.variables.pathToBlade(element.content.path);
            }
            return '{{ variable }}';
        } else if (element.type === 'conditional') {
            // Generate conditional block with Blade syntax
            const condition = element.content.condition || 'variable';
            const bladeCondition = this.variables ? 
                this.variables.pathToBlade(condition).replace('{{ ', '').replace(' }}', '') : 
                condition;
            
            let conditionalHtml = `@if(${bladeCondition})\n`;
            // Generate true content
            if (element.content.trueContent && Array.isArray(element.content.trueContent)) {
                element.content.trueContent.forEach(subElement => {
                    conditionalHtml += this.generateElementHTML(subElement);
                });
            }
            // Generate else content if enabled
            if (element.content.showElse) {
                conditionalHtml += `@else\n`;
                if (element.content.falseContent && Array.isArray(element.content.falseContent)) {
                    element.content.falseContent.forEach(subElement => {
                        conditionalHtml += this.generateElementHTML(subElement);
                    });
                }
            }
            conditionalHtml += `@endif\n`;
            return conditionalHtml;
        } else if (element.type === 'loop') {
            // Generate loop block with Blade syntax
            const loopVar = element.content.loopVariable || 'array';
            const itemVar = element.content.itemVariable || 'item';
            const bladeLoopVar = this.variables ? 
                this.variables.pathToBlade(loopVar).replace('{{ ', '').replace(' }}', '') : 
                loopVar;
            
            let loopHtml = `@foreach(${bladeLoopVar} as $${itemVar})\n`;
            // Generate loop content
            if (element.content.content && Array.isArray(element.content.content)) {
                element.content.content.forEach(subElement => {
                    loopHtml += this.generateElementHTML(subElement);
                });
            }
            loopHtml += `@endforeach\n`;
            return loopHtml;
        } else if (element.type === 'invoice-header') {
            // Pre-built invoice header - already contains Blade syntax
            return element.content.html || '';
        } else if (element.type === 'invoice-info-table') {
            // Pre-built table - already contains Blade syntax
            return element.content.html || '';
        } else if (element.type === 'invoice-items-table') {
            // Pre-built items table with loop
            const loopVar = element.content.loopVariable || 'invoice.other_expenses';
            const bladeLoopVar = this.invoiceVariables ? 
                this.invoiceVariables.pathToBlade(loopVar).replace('{{ ', '').replace(' }}', '') : 
                loopVar;
            
            let tableHtml = '<table class="w-full border-collapse">\n';
            tableHtml += '<thead><tr>\n';
            if (element.content.columns?.includes('description')) {
                tableHtml += '<th class="border p-2 bg-gray-200">Description</th>\n';
            }
            if (element.content.columns?.includes('amount')) {
                tableHtml += '<th class="border p-2 bg-gray-200 text-right">Amount</th>\n';
            }
            tableHtml += '</tr></thead>\n<tbody>\n';
            tableHtml += `@foreach(${bladeLoopVar} as $item)\n<tr>\n`;
            if (element.content.columns?.includes('description')) {
                tableHtml += '<td class="border p-2">{{ $item->label }}</td>\n';
            }
            if (element.content.columns?.includes('amount')) {
                tableHtml += '<td class="border p-2 text-right">${{ number_format($item->amount, 2) }}</td>\n';
            }
            tableHtml += '</tr>\n@endforeach\n';
            tableHtml += '</tbody></table>\n';
            return tableHtml;
        } else if (element.type === 'invoice-totals') {
            // Pre-built totals - already contains Blade syntax
            return element.content.html || '';
        } else if (element.type === 'invoice-payment-info') {
            // Pre-built payment info - wrapped in conditional
            return element.content.html || '';
        }
        
        return '';
    }

    /**
     * Process content string to convert variable paths to Blade syntax
     * @param {string} content - Content string that may contain variables
     * @returns {string} Content with variables converted to Blade syntax
     */
    processContentForBlade(content) {
        if (typeof content !== 'string') {
            content = String(content);
        }
        
        if (!this.variables) {
            return this.escapeHtml(content);
        }
        
        // Find variable patterns: ((variable.path)) and convert to Blade syntax
        const variablePattern = /\(\(([a-zA-Z_][a-zA-Z0-9_.]*)\)\)/g;
        
        return content.replace(variablePattern, (match, path) => {
            const variable = this.variables.getVariableByPath(path);
            if (variable) {
                return this.variables.pathToBlade(path);
            }
            return match; // Return original if variable not found
        });
    }

    /**
     * Setup variable autocomplete for contenteditable elements
     * Shows dropdown when user types (( to suggest available variables
     */
    setupVariableAutocomplete(editable, elementIndex) {
        let autocompleteDiv = null;
        let currentMatches = [];
        let selectedIndex = 0;

        editable.addEventListener('input', (e) => {
            // Small delay to ensure DOM is updated after innerHTML changes
            setTimeout(() => {
                // Get text content, handling both textContent and innerText for line breaks
                // Use innerText to properly handle <br> tags as newlines
                const text = editable.innerText || editable.textContent || '';
                const cursorPos = this.getCaretPosition(editable);
                
                if (cursorPos === 0 && text.length > 0) {
                    // If cursor position is 0 but there's text, try to get it from selection
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        // Try alternative method to get cursor position
                        const tempRange = range.cloneRange();
                        tempRange.selectNodeContents(editable);
                        tempRange.setEnd(range.endContainer, range.endOffset);
                        const textBeforeCursor = tempRange.toString();
                        const cursorPosAlt = textBeforeCursor.length;
                        
                        if (cursorPosAlt > 0) {
                            const textBefore = text.substring(0, Math.min(cursorPosAlt, text.length));
                            const match = textBefore.match(/\(\(([a-zA-Z0-9_.]*)$/);
                            
                            if (match) {
                                const searchTerm = match[1].toLowerCase();
                                
                                if (this.variables) {
                                    const allVars = this.variables.getAllVariables();
                                    currentMatches = allVars.filter(v => 
                                        v.path.toLowerCase().includes(searchTerm) || 
                                        v.displayName.toLowerCase().includes(searchTerm)
                                    ).slice(0, 10);
                                    
                                    if (currentMatches.length > 0) {
                                        this.showAutocomplete(editable, currentMatches, cursorPosAlt);
                                        selectedIndex = 0;
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
                
                const textBeforeCursor = text.substring(0, cursorPos);
                
                // Check if user is typing ((variable pattern
                const match = textBeforeCursor.match(/\(\(([a-zA-Z0-9_.]*)$/);
                
                if (match) {
                    const searchTerm = match[1].toLowerCase();
                    
                    // Get all variables and filter by search term
                    if (this.variables) {
                        const allVars = this.variables.getAllVariables();
                        currentMatches = allVars.filter(v => 
                            v.path.toLowerCase().includes(searchTerm) || 
                            v.displayName.toLowerCase().includes(searchTerm)
                        ).slice(0, 10); // Limit to 10 results
                        
                        if (currentMatches.length > 0) {
                            this.showAutocomplete(editable, currentMatches, cursorPos);
                            selectedIndex = 0;
                        } else {
                            this.hideAutocomplete();
                        }
                    }
                } else {
                    this.hideAutocomplete();
                }
            }, 10);
        });

        editable.addEventListener('keydown', (e) => {
            const autocomplete = document.getElementById('variable-autocomplete');
            if (autocomplete && autocomplete.style.display !== 'none') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, currentMatches.length - 1);
                    this.highlightAutocompleteItem(selectedIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    this.highlightAutocompleteItem(selectedIndex);
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    if (currentMatches[selectedIndex]) {
                        this.insertVariableFromAutocomplete(editable, currentMatches[selectedIndex], elementIndex);
                    }
                } else if (e.key === 'Escape') {
                    this.hideAutocomplete();
                }
            }
        });

        // Hide autocomplete when clicking outside
        // Use a named function so we can remove it later
        const clickOutsideHandler = (e) => {
            const autocomplete = document.getElementById('variable-autocomplete');
            if (autocomplete && !autocomplete.contains(e.target) && e.target !== editable && !editable.contains(e.target)) {
                this.hideAutocomplete();
            }
        };
        
        // Use mousedown instead of click to catch it before blur
        document.addEventListener('mousedown', clickOutsideHandler);
        
        // Also hide on blur, but with a small delay to allow clicks on autocomplete
        editable.addEventListener('blur', (e) => {
            // Small delay to allow click events on autocomplete to fire first
            setTimeout(() => {
                const autocomplete = document.getElementById('variable-autocomplete');
                if (autocomplete && !autocomplete.contains(document.activeElement)) {
                    this.hideAutocomplete();
                }
            }, 200);
        });
    }

    /**
     * Show autocomplete dropdown
     */
    showAutocomplete(editable, matches, cursorPos) {
        // Remove existing autocomplete if any
        const existing = document.getElementById('variable-autocomplete');
        if (existing) {
            existing.remove();
        }

        const autocompleteDiv = document.createElement('div');
        autocompleteDiv.id = 'variable-autocomplete';
        autocompleteDiv.className = 'absolute bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto';
        autocompleteDiv.style.minWidth = '300px';
        autocompleteDiv.style.zIndex = '9999'; // Ensure it's on top
        autocompleteDiv.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur on editable element when clicking dropdown
        });

        matches.forEach((variable, index) => {
            const item = document.createElement('div');
            item.className = `px-3 py-2 cursor-pointer hover:bg-blue-50 ${index === 0 ? 'bg-blue-50' : ''}`;
            item.dataset.index = index;
            item.innerHTML = `
                <div class="font-medium text-gray-900">${variable.displayName}</div>
                <div class="text-xs text-gray-500 font-mono">${variable.path}</div>
            `;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur on editable element
                e.stopPropagation();
                // Insert variable immediately on mousedown to avoid blur issues
                // Check if it's a nested element (has data-nested-id) or main element (has data-index)
                let idx = elementIndex;
                if (editable.dataset.nestedId) {
                    // It's a nested element - find the parent container with data attributes
                    const container = editable.closest('[data-layout-index]');
                    if (container) {
                        idx = `nested-${container.dataset.layoutIndex}-${container.dataset.columnIndex}-${container.dataset.elementIndex}`;
                    } else {
                        // Fallback: parse from nested-id format: layout-X-col-Y-el-Z
                        const match = editable.dataset.nestedId.match(/layout-(\d+)-col-(\d+)-el-(\d+)/);
                        if (match) {
                            idx = `nested-${match[1]}-${match[2]}-${match[3]}`;
                        }
                    }
                } else if (editable.dataset.index !== undefined) {
                    // It's a main element
                    idx = parseInt(editable.dataset.index);
                }
                this.insertVariableFromAutocomplete(editable, variable, idx);
            });
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Backup in case mousedown didn't fire
                if (!editable.textContent.includes(`((${variable.path}))`)) {
                    // Check if it's a nested element (has data-nested-id) or main element (has data-index)
                    let idx = elementIndex;
                    if (editable.dataset.nestedId) {
                        // It's a nested element - find the parent container with data attributes
                        const container = editable.closest('[data-layout-index]');
                        if (container) {
                            idx = `nested-${container.dataset.layoutIndex}-${container.dataset.columnIndex}-${container.dataset.elementIndex}`;
                        } else {
                            // Fallback: parse from nested-id format: layout-X-col-Y-el-Z
                            const match = editable.dataset.nestedId.match(/layout-(\d+)-col-(\d+)-el-(\d+)/);
                            if (match) {
                                idx = `nested-${match[1]}-${match[2]}-${match[3]}`;
                            }
                        }
                    } else if (editable.dataset.index !== undefined) {
                        // It's a main element
                        idx = parseInt(editable.dataset.index);
                    }
                    this.insertVariableFromAutocomplete(editable, variable, idx);
                }
            });
            autocompleteDiv.appendChild(item);
        });

        document.body.appendChild(autocompleteDiv);
        
        // Position autocomplete near cursor
        const range = window.getSelection().getRangeAt(0);
        const rect = range.getBoundingClientRect();
        autocompleteDiv.style.left = rect.left + 'px';
        autocompleteDiv.style.top = (rect.bottom + 5) + 'px';
    }

    /**
     * Hide autocomplete dropdown
     */
    hideAutocomplete() {
        const autocomplete = document.getElementById('variable-autocomplete');
        if (autocomplete) {
            autocomplete.remove();
        }
    }

    /**
     * Highlight autocomplete item
     */
    highlightAutocompleteItem(index) {
        const autocomplete = document.getElementById('variable-autocomplete');
        if (autocomplete) {
            const items = autocomplete.querySelectorAll('div[data-index]');
            items.forEach((item, i) => {
                if (i === index) {
                    item.classList.add('bg-blue-50');
                } else {
                    item.classList.remove('bg-blue-50');
                }
            });
        }
    }

    /**
     * Insert variable from autocomplete
     */
    insertVariableFromAutocomplete(editable, variable, elementIndex) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
            this.hideAutocomplete();
            return;
        }
        
        const range = selection.getRangeAt(0);
        
        // Get the current text content using innerText to handle <br> tags
        const text = editable.innerText || editable.textContent || '';
        const cursorPos = this.getCaretPosition(editable);
        const textBeforeCursor = text.substring(0, cursorPos);
        const textAfterCursor = text.substring(cursorPos);
        
        // Find the start of (( pattern
        const match = textBeforeCursor.match(/\(\(([a-zA-Z0-9_.]*)$/);
        if (!match) {
            this.hideAutocomplete();
            return;
        }
        
        const startPos = cursorPos - match[0].length;
        const variableText = `((${variable.path}))`;
        const newText = textBeforeCursor.substring(0, startPos) + 
                      variableText + 
                      textAfterCursor;
        
        // Instead of replacing all innerHTML, try to preserve the DOM structure
        // by only updating the text content and maintaining cursor position
        const textNode = range.startContainer;
        
        // Check if we're in a text node and can modify it directly
        if (textNode && textNode.nodeType === Node.TEXT_NODE && textNode.parentNode === editable) {
            // We're directly in a text node within the editable element
            // This is the simple case - just replace the text
            const nodeOffset = range.startOffset;
            const textBeforeInNode = textNode.textContent.substring(0, nodeOffset - match[0].length);
            const textAfterInNode = textNode.textContent.substring(nodeOffset);
            
            // Replace the ((pattern with the full variable
            textNode.textContent = textBeforeInNode + variableText + textAfterInNode;
            
            // Set cursor after the inserted variable
            const newOffset = textBeforeInNode.length + variableText.length;
            range.setStart(textNode, newOffset);
            range.setEnd(textNode, newOffset);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Complex case: might have <br> tags or nested elements
            // Replace the entire content but be more careful about cursor position
            editable.innerHTML = this.convertNewlinesToBr(newText);
            
            // Calculate new cursor position
            const newCursorPos = startPos + variableText.length;
            
            // Ensure element has focus
            editable.focus();
            
            // Use requestAnimationFrame for better timing
            requestAnimationFrame(() => {
                this.setCaretPosition(editable, newCursorPos);
                
                // Double-check focus
                if (document.activeElement !== editable) {
                    editable.focus();
                    requestAnimationFrame(() => {
                        this.setCaretPosition(editable, newCursorPos);
                    });
                }
            });
        }
        
        // Update the stored content - check if it's a nested element or main element
        if (typeof elementIndex === 'string' && elementIndex.startsWith('nested-')) {
            // This is a nested element - parse the index string
            const parts = elementIndex.replace('nested-', '').split('-');
            if (parts.length === 3) {
                const layoutIndex = parseInt(parts[0]);
                const columnIndex = parseInt(parts[1]);
                const nestedElementIndex = parseInt(parts[2]);
                
                // Update nested element content
                if (this.elements[layoutIndex] && 
                    this.elements[layoutIndex].type === 'layout' &&
                    this.elements[layoutIndex].content?.columnElements &&
                    this.elements[layoutIndex].content.columnElements[columnIndex] &&
                    this.elements[layoutIndex].content.columnElements[columnIndex][nestedElementIndex]) {
                    this.elements[layoutIndex].content.columnElements[columnIndex][nestedElementIndex].content = newText;
                }
            }
        } else {
            // This is a main element
            const index = parseInt(elementIndex);
            if (this.elements[index]) {
                this.elements[index].content = newText;
            }
        }
        
        this.hideAutocomplete();
    }

    /**
     * Get caret position in contenteditable element
     * Handles <br> tags and line breaks correctly
     */
    getCaretPosition(element) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return 0;
        
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        
        // Use innerText to get text with <br> converted to newlines
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(preCaretRange.cloneContents());
        return tempDiv.innerText.length;
    }

    /**
     * Set caret position in contenteditable element
     * Handles <br> tags and line breaks correctly
     */
    setCaretPosition(element, position) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Use a walker to traverse nodes and count characters
        // This handles <br> tags correctly by treating them as single characters
        let charCount = 0;
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    // Accept text nodes and <br> elements
                    if (node.nodeType === Node.TEXT_NODE) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'BR' || node.tagName === 'br')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        let node;
        let foundStart = false;
        
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent.length;
                const nextCharCount = charCount + textLength;
                
                if (position <= nextCharCount) {
                    // Position is within this text node
                    range.setStart(node, position - charCount);
                    range.setEnd(node, position - charCount);
                    foundStart = true;
                    break;
                }
                charCount = nextCharCount;
            } else if (node.nodeType === Node.ELEMENT_NODE && 
                      (node.tagName === 'BR' || node.tagName === 'br')) {
                // <br> tag counts as 1 character (like a newline)
                const nextCharCount = charCount + 1;
                
                if (position <= nextCharCount) {
                    // Position is at or right after this <br>
                    if (position === charCount) {
                        // Position is right before the <br>
                        range.setStartBefore(node);
                        range.setEndBefore(node);
                    } else {
                        // Position is right after the <br>
                        range.setStartAfter(node);
                        range.setEndAfter(node);
                    }
                    foundStart = true;
                    break;
                }
                charCount = nextCharCount;
            }
        }
        
        // If position is at the end, place cursor at the end of the element
        if (!foundStart) {
            const lastNode = this.getLastTextOrBrNode(element);
            if (lastNode) {
                if (lastNode.nodeType === Node.TEXT_NODE) {
                    range.setStart(lastNode, lastNode.textContent.length);
                    range.setEnd(lastNode, lastNode.textContent.length);
                } else if (lastNode.nodeType === Node.ELEMENT_NODE && 
                          (lastNode.tagName === 'BR' || lastNode.tagName === 'br')) {
                    range.setStartAfter(lastNode);
                    range.setEndAfter(lastNode);
                }
                foundStart = true;
            }
        }
        
        if (foundStart) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Get the last text node or <br> element in the element tree
     */
    getLastTextOrBrNode(element) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'BR' || node.tagName === 'br')) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        let lastNode = null;
        let node;
        while (node = walker.nextNode()) {
            lastNode = node;
        }
        return lastNode;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Convert newlines in text to <br> tags for HTML display
     * @param {string} text - Text that may contain newlines
     * @returns {string} HTML with newlines converted to <br> tags
     */
    convertNewlinesToBr(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        // Escape HTML first, then convert newlines to <br>
        const escaped = this.escapeHtml(text);
        return escaped.replace(/\n/g, '<br>');
    }

    /**
     * Process content to replace variable paths with display names or mock values
     * @param {string|Object} content - Content that may contain variables
     * @returns {string} Processed content with variables replaced
     */
    /**
     * Process content for editor - shows ((variable.path)) syntax
     * @param {string} content - Content that may contain variables
     * @returns {string} Content with variable syntax preserved
     */
    processVariableContentForEditor(content) {
        if (typeof content !== 'string') {
            content = String(content);
        }
        // Return as-is, variables are shown as ((variable.path)) in editor
        return this.escapeHtml(content);
    }

    /**
     * Process content to replace ((variable.path)) with display names for editor
     * or actual values for preview
     * @param {string} content - Content that may contain variables
     * @param {boolean} forPreview - If true, replace with actual values; if false, show display names
     * @returns {string} Processed content
     */
    processVariableContent(content, forPreview = false) {
        if (typeof content !== 'string') {
            content = String(content);
        }
        
        if (!this.variables) {
            return content;
        }
        
        // Find variable patterns: ((variable.path))
        const variablePattern = /\(\(([a-zA-Z_][a-zA-Z0-9_.]*)\)\)/g;
        
        return content.replace(variablePattern, (match, path) => {
            const variable = this.variables.getVariableByPath(path);
            if (variable) {
                if (forPreview) {
                    // Replace with actual value from mock data
                    const mockData = this.variables.getMockData();
                    const parts = path.split('.');
                    let value = mockData;
                    
                    for (const part of parts) {
                        if (value && typeof value === 'object' && part in value) {
                            value = value[part];
                        } else {
                            return match; // Return original if path not found
                        }
                    }
                    
                    // Format based on type
                    if (variable.type === 'currency') {
                        return `$${Number(value).toFixed(2)}`;
                    }
                    
                    return value !== undefined ? String(value) : match;
                } else {
                    // Show display name in editor
                    return `((${path}))`;
                }
            }
            return match;
        });
    }

    /**
     * Insert variable into selected element or at cursor position
     * @param {string} variablePath - Variable path (e.g., 'invoice.invoice_no')
     */
    /**
     * Insert variable into selected element or at cursor position
     * @param {string} variablePath - Variable path (e.g., 'invoice.invoice_no')
     */
    insertVariable(variablePath) {
        if (!this.variables) return;
        
        const variable = this.variables.getVariableByPath(variablePath);
        if (!variable) return;

        // If an element is selected and it's text/heading, insert variable
        if (this.selectedElementIndex !== null) {
            const element = this.elements[this.selectedElementIndex];
            if (element.type === 'text' || element.type === 'heading') {
                // Insert variable into content
                const bladeSyntax = this.variables.pathToBlade(variablePath);
                element.content += ` ${bladeSyntax}`;
                this.updateElementInDOM(this.selectedElementIndex);
                this.showPropertiesPanel(this.selectedElementIndex);
            } else if (element.type === 'variable') {
                // Update variable component
                element.content.path = variablePath;
                element.content.displayName = variable.displayName;
                this.updateElementInDOM(this.selectedElementIndex);
                this.showPropertiesPanel(this.selectedElementIndex);
            }
        }
    }

    /**
     * Save page or template
     * Sends data to server including template type
     */
    savePage() {
        // Get title from pageTitle element or global variable
        let title = '';
        if (this.pageTitle && this.pageTitle.value) {
            title = this.pageTitle.value;
        } else if (window.pageTitle) {
            title = window.pageTitle;
        } else {
            title = prompt('Enter page title:');
            if (!title) {
                return; // User cancelled
            }
        }
        
        const html = this.generateHTML();
        
        const data = {
            title: title,
            content: this.elements,
            html: html,
            _token: this.csrfToken
        };

        const url = this.updateUrl || this.saveUrl;

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Page saved successfully!');
                // Redirect to pages list
                window.location.href = data.redirect || this.redirectUrl;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error saving page');
        });
    }

    /**
     * Show preview with mock data
     * Replaces variables with sample data for preview
     */
    showPreview() {
        // Generate HTML with variables replaced for preview (not Blade syntax)
        let previewHtml = this.generatePreviewHTML();
        
        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Template Preview</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body { 
                        font-family: Times New Roman, serif;
                        font-size: 12px;
                        color: #000;
                        background-color: #f5f5f5;
                        padding: 20px;
                        min-height: 100vh;
                    }
                    .page-container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background-color: #fff;
                        padding: 40px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .page-container > * {
                        margin-bottom: 15px;
                    }
                    .page-container > *:last-child {
                        margin-bottom: 0;
                    }
                    h2 { font-size: 2rem; margin: 20px 0; }
                    p { margin: 10px 0; line-height: 1.6; }
                    img { max-width: 100%; height: auto; display: block; }
                    button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #000; padding: 6px; }
                    th { background: #e6e6e6; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="page-container">
                    ${previewHtml}
                </div>
            </body>
            </html>
        `);
    }

    /**
     * Setup drag and drop for layout columns
     */
    setupLayoutColumns(layoutElement, layoutIndex) {
        const columns = layoutElement.querySelectorAll('.layout-column');
        
        columns.forEach((column, colIndex) => {
            const columnContent = column.querySelector('.column-content');
            if (!columnContent) return;
            
            // Remove any existing event listeners by cloning (clean slate)
            const newColumnContent = columnContent.cloneNode(true);
            columnContent.parentNode.replaceChild(newColumnContent, columnContent);
            
            // Setup drag over - must prevent default to allow drop
            newColumnContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Prevent parent handlers
                newColumnContent.classList.add('drag-over');
                column.classList.add('drag-over');
            });
            
            // Setup drag enter
            newColumnContent.addEventListener('dragenter', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Prevent parent handlers
                newColumnContent.classList.add('drag-over');
                column.classList.add('drag-over');
            });
            
            // Setup drag leave
            newColumnContent.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only remove drag-over if we're actually leaving the column content area
                const rect = newColumnContent.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;
                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    newColumnContent.classList.remove('drag-over');
                    column.classList.remove('drag-over');
                }
            });
            
            // Setup drop - use capture phase to handle before main dropZone
            newColumnContent.addEventListener('drop', (e) => {
                console.log('=== COLUMN DROP EVENT FIRED ===', colIndex, layoutIndex);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Prevent parent handlers from firing
                newColumnContent.classList.remove('drag-over');
                column.classList.remove('drag-over');
                
                const componentType = e.dataTransfer.getData('text/plain');
                console.log('Component type:', componentType);
                if (componentType) {
                    console.log('Calling addElementToColumn with:', layoutIndex, colIndex, componentType);
                    this.addElementToColumn(layoutIndex, colIndex, componentType);
                } else {
                    console.warn('No component type in dataTransfer');
                }
                return false; // Additional prevention
            }, true); // Use capture phase to fire before bubbling handlers
            
            console.log('Drop zone set up for column', colIndex, 'Layout:', layoutIndex);
        });
    }

    /**
     * Add element to a specific column in a layout
     */
    addElementToColumn(layoutIndex, columnIndex, componentType) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }
        
        // Initialize columnElements if needed
        if (!layoutElement.content.columnElements) {
            const columns = layoutElement.content.columns || 2;
            layoutElement.content.columnElements = Array.from({ length: columns }, () => []);
        }
        
        // Save current content from all nested elements before re-rendering
        this.saveNestedElementsContent(layoutIndex);
        
        // Create new element
        const elementId = Date.now();
        const newElement = {
            id: elementId,
            type: componentType,
            content: this.getDefaultContent(componentType),
            styles: this.getDefaultStyles(componentType)
        };
        
        // Add to column
        if (!layoutElement.content.columnElements[columnIndex]) {
            layoutElement.content.columnElements[columnIndex] = [];
        }
        layoutElement.content.columnElements[columnIndex].push(newElement);
        
        // Find and remove the old layout element from DOM before re-rendering
        const oldLayoutElement = this.dropZone.querySelector(`[data-index="${layoutIndex}"]`);
        if (oldLayoutElement) {
            oldLayoutElement.remove();
        }
        
        // Re-render the layout (this will call setupLayoutColumns and setupNestedElements automatically)
        this.renderElement(layoutElement, layoutIndex);
    }

    /**
     * Save content from all nested elements in a layout before re-rendering
     */
    saveNestedElementsContent(layoutIndex) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }

        const columnElements = layoutElement.content.columnElements || [];
        
        columnElements.forEach((colElements, colIndex) => {
            colElements.forEach((element, elIndex) => {
                // Find the DOM element
                const nestedEl = document.querySelector(
                    `[data-layout-index="${layoutIndex}"][data-column-index="${colIndex}"][data-element-index="${elIndex}"]`
                );
                
                if (nestedEl) {
                    // If it's a text or heading element, save the contenteditable content
                    const editable = nestedEl.querySelector('[contenteditable="true"]');
                    if (editable && (element.type === 'text' || element.type === 'heading')) {
                        const htmlContent = editable.innerHTML;
                        const textContent = htmlContent
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/div>/gi, '\n')
                            .replace(/<div[^>]*>/gi, '')
                            .replace(/<\/p>/gi, '\n')
                            .replace(/<p[^>]*>/gi, '')
                            .replace(/&nbsp;/gi, ' ')
                            .trim();
                        
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = textContent;
                        const plainText = tempDiv.textContent || tempDiv.innerText || '';
                        
                        element.content = plainText;
                    }
                }
            });
        });
    }

    /**
     * Render a nested element inside a layout column as a fully editable component
     */
    renderNestedElement(element, layoutIndex, columnIndex, elementIndex) {
        if (!element) return '';
        
        const nestedId = `layout-${layoutIndex}-col-${columnIndex}-el-${elementIndex}`;
        let content = '';
        
        if (element.type === 'text') {
            const textContent = this.processVariableContentForEditor(element.content || 'Text');
            const htmlContent = this.convertNewlinesToBr(textContent);
            content = `<p contenteditable="true" class="text-gray-700 variable-editable whitespace-pre-wrap nested-editable" data-nested-id="${nestedId}">${htmlContent}</p>`;
        } else if (element.type === 'heading') {
            const headingContent = this.processVariableContentForEditor(element.content || 'Heading');
            const htmlContent = this.convertNewlinesToBr(headingContent);
            content = `<h2 contenteditable="true" class="text-2xl font-bold text-gray-900 variable-editable whitespace-pre-wrap nested-editable" data-nested-id="${nestedId}">${htmlContent}</h2>`;
        } else if (element.type === 'image') {
            const imgStyles = {};
            if (element.styles?.['image-width']) imgStyles['width'] = element.styles['image-width'];
            if (element.styles?.['image-height']) imgStyles['height'] = element.styles['image-height'];
            const imgStyleAttr = Object.keys(imgStyles).length > 0 ? ` style="${this.buildStylesFromObject(imgStyles)}"` : '';
            content = `<img src="${element.content?.src || 'https://via.placeholder.com/400x200'}" alt="${element.content?.alt || ''}"${imgStyleAttr} class="nested-editable" data-nested-id="${nestedId}">`;
        } else if (element.type === 'button') {
            const btnStyles = {};
            if (element.styles?.['background-color']) btnStyles['background-color'] = element.styles['background-color'];
            if (element.styles?.['color']) btnStyles['color'] = element.styles['color'];
            if (element.styles?.['padding']) btnStyles['padding'] = element.styles['padding'];
            if (element.styles?.['border']) btnStyles['border'] = element.styles['border'];
            if (element.styles?.['border-radius']) btnStyles['border-radius'] = element.styles['border-radius'];
            // Apply width and height (use defaults if not set)
            // Note: These are the button's intrinsic dimensions, not the container
            const buttonWidth = element.styles?.['width'] || '150px';
            const buttonHeight = element.styles?.['height'] || '40px';
            btnStyles['width'] = buttonWidth;
            btnStyles['height'] = buttonHeight;
            // Set default padding if not specified (equivalent to py-2 px-6)
            if (!element.styles?.['padding']) {
                btnStyles['padding'] = '0.5rem 1.5rem';
            }
            const btnStyleAttr = Object.keys(btnStyles).length > 0 ? ` style="${this.buildStylesFromObject(btnStyles)}"` : '';
            // Add styles to prevent button from resizing on hover - lock dimensions explicitly
            const preventResizeStyles = `flex-shrink: 0; flex-grow: 0; box-sizing: border-box; transition: none; contain: layout style paint; width: ${buttonWidth}; height: ${buttonHeight};`;
            const finalBtnStyle = btnStyleAttr ? btnStyleAttr.replace('style="', `style="${preventResizeStyles}`) : ` style="${preventResizeStyles}"`;
            // Remove Tailwind padding classes (px-6 py-2) to avoid conflicts - padding is now in inline styles
            content = `<button class="rounded-md nested-editable resizable-button"${finalBtnStyle} data-nested-id="${nestedId}">${element.content?.text || 'Button'}</button>`;
        } else {
            content = `<div class="text-xs text-gray-500 nested-editable" data-nested-id="${nestedId}">${element.type}</div>`;
        }
        
        // Apply element styles
        const elementStyles = element.styles || {};
        let styleAttr = Object.keys(elementStyles).length > 0 ? ` style="${this.buildStylesFromObject(elementStyles)}"` : '';
        
        // Add type-specific class for styling
        const typeClass = element.type === 'button' ? 'nested-button-container' : '';
        
        // For buttons, calculate container size to fit button + padding (8px on each side = 16px total)
        if (element.type === 'button') {
            const buttonWidth = element.styles?.['width'] || '150px';
            const buttonHeight = element.styles?.['height'] || '40px';
            // Container needs to be button size + 16px (8px padding on each side)
            const containerWidth = `calc(${buttonWidth} + 16px)`;
            const containerHeight = `calc(${buttonHeight} + 16px)`;
            const containerStyles = `width: ${containerWidth}; min-width: ${containerWidth}; height: ${containerHeight}; min-height: ${containerHeight};`;
            styleAttr = styleAttr ? 
                styleAttr.replace('style="', `style="${containerStyles}`) : 
                ` style="${containerStyles}"`;
        }
        
        return `
            <div class="nested-element builder-element ${typeClass}" 
                 data-nested-id="${nestedId}"
                 data-layout-index="${layoutIndex}"
                 data-column-index="${columnIndex}"
                 data-element-index="${elementIndex}"
                 ${styleAttr}>
                ${content}
                <button class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs delete-nested-element shadow-lg" style="z-index: 10; font-size: 14px; line-height: 1;" title="Delete">×</button>
            </div>
        `;
    }

    /**
     * Get preview text for nested element (used in other contexts)
     */
    getNestedElementPreview(element) {
        if (!element) return '';
        
        switch (element.type) {
            case 'text':
                return `<p class="text-sm">${element.content || 'Text'}</p>`;
            case 'heading':
                return `<h3 class="text-sm font-bold">${element.content || 'Heading'}</h3>`;
            case 'image':
                return `<img src="${element.content?.src || 'https://via.placeholder.com/100x50'}" alt="${element.content?.alt || ''}" style="max-width: 100px;">`;
            case 'button':
                return `<button class="text-xs px-2 py-1 bg-blue-500 text-white rounded">${element.content?.text || 'Button'}</button>`;
            default:
                return `<div class="text-xs text-gray-500">${element.type}</div>`;
        }
    }

    /**
     * Setup event handlers for nested elements in layout columns
     */
    setupNestedElements(layoutElement, layoutIndex) {
        const nestedElements = layoutElement.querySelectorAll('.nested-element');
        
        nestedElements.forEach(nestedEl => {
            const layoutIdx = parseInt(nestedEl.dataset.layoutIndex || nestedEl.getAttribute('data-layout-index') || layoutIndex);
            const columnIdx = parseInt(nestedEl.dataset.columnIndex || nestedEl.getAttribute('data-column-index') || '0');
            const elementIdx = parseInt(nestedEl.dataset.elementIndex || nestedEl.getAttribute('data-element-index') || '0');
            
            // Make it selectable
            nestedEl.style.position = 'relative';
            nestedEl.style.cursor = 'pointer';
            
            // Click handler to select nested element
            nestedEl.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-nested-element') && !e.target.closest('.delete-nested-element')) {
                    e.stopPropagation(); // Prevent layout element selection
                    this.selectNestedElement(layoutIdx, columnIdx, elementIdx);
                }
            });
            
            // Delete button handler
            const deleteBtn = nestedEl.querySelector('.delete-nested-element');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteNestedElement(layoutIdx, columnIdx, elementIdx);
                });
            }
            
            // Setup contenteditable handlers for text/heading
            const editable = nestedEl.querySelector('[contenteditable="true"]');
            if (editable) {
                // Handle blur to save content
                editable.addEventListener('blur', () => {
                    const htmlContent = editable.innerHTML;
                    const textContent = htmlContent
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/div>/gi, '\n')
                        .replace(/<div[^>]*>/gi, '')
                        .replace(/<\/p>/gi, '\n')
                        .replace(/<p[^>]*>/gi, '')
                        .replace(/&nbsp;/gi, ' ')
                        .trim();
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = textContent;
                    const plainText = tempDiv.textContent || tempDiv.innerText || '';
                    
                    // Update the element content
                    const layoutEl = this.elements[layoutIdx];
                    if (layoutEl && layoutEl.type === 'layout' && layoutEl.content.columnElements) {
                        const colElements = layoutEl.content.columnElements[columnIdx];
                        if (colElements && colElements[elementIdx]) {
                            colElements[elementIdx].content = plainText;
                        }
                    }
                });
                
                // Add variable autocomplete for text/heading
                if (editable.classList.contains('variable-editable')) {
                    this.setupVariableAutocomplete(editable, `nested-${layoutIdx}-${columnIdx}-${elementIdx}`);
                }
            }
        });
    }

    /**
     * Select a nested element and show its properties
     */
    selectNestedElement(layoutIndex, columnIndex, elementIndex) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }
        
        const columnElements = layoutElement.content.columnElements || [];
        const colElements = columnElements[columnIndex] || [];
        const nestedElement = colElements[elementIndex];
        
        if (!nestedElement) {
            return;
        }
        
        // Remove previous selections (both regular and nested)
        document.querySelectorAll('.builder-element.selected, .nested-element.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selection to current nested element
        const nestedEl = document.querySelector(`[data-layout-index="${layoutIndex}"][data-column-index="${columnIndex}"][data-element-index="${elementIndex}"]`);
        if (nestedEl) {
            nestedEl.classList.add('selected');
        }
        
        // Show properties panel for nested element
        this.showNestedElementProperties(layoutIndex, columnIndex, elementIndex, nestedElement);
    }

    /**
     * Show properties panel for a nested element
     */
    showNestedElementProperties(layoutIndex, columnIndex, elementIndex, element) {
        let html = '<div class="space-y-4">';
        html += '<div class="property-group bg-blue-50 p-2 rounded mb-2">';
        html += '<p class="text-sm font-semibold text-blue-900">Editing Nested Element</p>';
        html += `<p class="text-xs text-blue-700">Layout: ${layoutIndex + 1}, Column: ${columnIndex + 1}, Element: ${elementIndex + 1}</p>`;
        html += '</div>';
        
        // Common properties (same as main elements)
        html += '<div class="property-group">';
        html += '<label class="property-label">Margin</label>';
        html += `<input type="text" class="property-input" data-property="margin" value="${element.styles?.margin || ''}" placeholder="e.g., 10px 20px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Padding</label>';
        html += `<input type="text" class="property-input" data-property="padding" value="${element.styles?.padding || ''}" placeholder="e.g., 10px 20px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Border</label>';
        html += `<input type="text" class="property-input" data-property="border" value="${element.styles?.border || ''}" placeholder="e.g., 1px solid #000">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Border Radius</label>';
        html += `<input type="text" class="property-input" data-property="border-radius" value="${element.styles?.['border-radius'] || ''}" placeholder="e.g., 8px">`;
        html += '</div>';

        html += '<div class="property-group">';
        html += '<label class="property-label">Text Align</label>';
        html += `<select class="property-input" data-property="text-align">`;
        html += `<option value="left" ${element.styles?.['text-align'] === 'left' ? 'selected' : ''}>Left</option>`;
        html += `<option value="center" ${element.styles?.['text-align'] === 'center' ? 'selected' : ''}>Center</option>`;
        html += `<option value="right" ${element.styles?.['text-align'] === 'right' ? 'selected' : ''}>Right</option>`;
        html += `<option value="justify" ${element.styles?.['text-align'] === 'justify' ? 'selected' : ''}>Justify</option>`;
        html += `</select>`;
        html += '</div>';

        // Width property - skip for buttons as they have their own width property
        if (element.type !== 'button') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="width" value="${element.styles?.width || ''}" placeholder="e.g., 100%, 500px">`;
            html += '</div>';
        }

        // Type-specific properties
        if (element.type === 'text' || element.type === 'heading') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Font Size</label>';
            html += `<input type="text" class="property-input" data-property="font-size" value="${element.styles?.['font-size'] || ''}" placeholder="e.g., 16px, 1.5rem">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Font Weight</label>';
            html += `<select class="property-input" data-property="font-weight">`;
            html += `<option value="normal" ${element.styles?.['font-weight'] === 'normal' ? 'selected' : ''}>Normal</option>`;
            html += `<option value="bold" ${element.styles?.['font-weight'] === 'bold' ? 'selected' : ''}>Bold</option>`;
            html += `<option value="300" ${element.styles?.['font-weight'] === '300' ? 'selected' : ''}>Light</option>`;
            html += `<option value="600" ${element.styles?.['font-weight'] === '600' ? 'selected' : ''}>Semi-bold</option>`;
            html += `</select>`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Text Color</label>';
            html += `<input type="color" class="property-input" data-property="color" value="${element.styles?.color || '#000000'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Background Color</label>';
            html += `<input type="color" class="property-input" data-property="background-color" value="${element.styles?.['background-color'] || '#ffffff'}">`;
            html += '</div>';

            // Show variable hint for text and heading elements
            if (this.variables) {
                html += '<div class="property-group bg-blue-50 p-3 rounded mb-3 border border-blue-200">';
                html += '<label class="property-label text-sm font-semibold text-blue-900 mb-2 block">💡 Variable Hint</label>';
                html += '<p class="text-xs text-blue-700 mb-2">Type <code class="bg-blue-100 px-1 rounded">((</code> in the text to see available variables</p>';
                html += '<div class="text-xs text-blue-600 max-h-32 overflow-y-auto space-y-1">';
                const allVars = this.variables.getAllVariables();
                allVars.slice(0, 5).forEach(variable => {
                    html += `<div class="mb-1"><code class="text-xs bg-blue-100 px-1 rounded">((${variable.path}))</code> - ${variable.displayName}</div>`;
                });
                if (allVars.length > 5) {
                    html += `<div class="text-xs text-blue-500 mt-1 italic">... and ${allVars.length - 5} more variables</div>`;
                }
                html += '</div>';
                html += '</div>';
            }
        }

        if (element.type === 'image') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Image Upload</label>';
            html += '<div class="upload-area" id="nested-image-upload-area">';
            html += '<input type="file" id="nested-image-upload-input" accept="image/*" style="display: none;">';
            html += '<p class="text-sm text-gray-600">Click or drag to upload</p>';
            html += '</div>';
            if (element.content?.src && element.content.src !== 'https://via.placeholder.com/400x200') {
                html += `<img src="${element.content.src}" alt="Preview" class="image-preview" id="nested-image-preview">`;
            }
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Image Alt Text</label>';
            html += `<input type="text" class="property-input" data-property="alt" value="${element.content?.alt || ''}" placeholder="Alt text">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Image URL</label>';
            html += `<input type="text" class="property-input" data-property="src" value="${element.content?.src || ''}" placeholder="Image URL">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="image-width" value="${element.styles?.['image-width'] || ''}" placeholder="e.g., 100%, 500px">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Height</label>';
            html += `<input type="text" class="property-input" data-property="image-height" value="${element.styles?.['image-height'] || ''}" placeholder="e.g., auto, 300px">`;
            html += '</div>';
        }

        if (element.type === 'button') {
            html += '<div class="property-group">';
            html += '<label class="property-label">Button Text</label>';
            html += `<input type="text" class="property-input" data-property="button-text" value="${element.content?.text || 'Button'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Button Link</label>';
            html += `<input type="text" class="property-input" data-property="button-link" value="${element.content?.link || '#'}" placeholder="URL">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Width</label>';
            html += `<input type="text" class="property-input" data-property="width" value="${element.styles?.width || '150px'}" placeholder="e.g., 150px, 100%">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Height</label>';
            html += `<input type="text" class="property-input" data-property="height" value="${element.styles?.height || '40px'}" placeholder="e.g., 40px, auto">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Background Color</label>';
            html += `<input type="color" class="property-input" data-property="background-color" value="${element.styles?.['background-color'] || '#3b82f6'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Text Color</label>';
            html += `<input type="color" class="property-input" data-property="color" value="${element.styles?.color || '#ffffff'}">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Padding</label>';
            html += `<input type="text" class="property-input" data-property="padding" value="${element.styles?.padding || ''}" placeholder="e.g., 10px 20px">`;
            html += '</div>';

            html += '<div class="property-group">';
            html += '<label class="property-label">Border Radius</label>';
            html += `<input type="text" class="property-input" data-property="border-radius" value="${element.styles?.['border-radius'] || ''}" placeholder="e.g., 4px">`;
            html += '</div>';
        }

        html += '</div>';
        this.propertiesPanel.innerHTML = html;

        // Attach property listeners with debounce
        const inputs = this.propertiesPanel.querySelectorAll('.property-input');
        inputs.forEach(input => {
            // Check if it's a text input or color input (needs debounce)
            const isTextInput = input.type === 'text' || input.type === 'color' || (input.tagName === 'INPUT' && input.type !== 'checkbox');
            const isSelect = input.tagName === 'SELECT';
            
            if (isTextInput && !isSelect) {
                // Create or get debounced update function for this nested input
                const timerKey = `nested-${layoutIndex}-${columnIndex}-${elementIndex}-${input.dataset.property}`;
                if (!this.nestedPropertyUpdateTimers.has(timerKey)) {
                    const debouncedUpdate = this.debounce((prop, val) => {
                        this.updateNestedElementProperty(layoutIndex, columnIndex, elementIndex, prop, val);
                    }, 500);
                    this.nestedPropertyUpdateTimers.set(timerKey, debouncedUpdate);
                }
                
                const debouncedUpdate = this.nestedPropertyUpdateTimers.get(timerKey);
                
                // Use debounced update for input events
                input.addEventListener('input', () => {
                    debouncedUpdate(input.dataset.property, input.value);
                });
                
                // Still update immediately on blur (when user leaves the field)
                input.addEventListener('blur', () => {
                    // Update immediately when user leaves the field
                    this.updateNestedElementProperty(layoutIndex, columnIndex, elementIndex, input.dataset.property, input.value);
                });
            } else {
                // For selects, update immediately
                input.addEventListener('change', () => {
                    this.updateNestedElementProperty(layoutIndex, columnIndex, elementIndex, input.dataset.property, input.value);
                });
            }
        });

        // Setup image upload for nested images
        if (element.type === 'image') {
            this.setupNestedImageUpload(layoutIndex, columnIndex, elementIndex);
        }
    }

    /**
     * Setup image upload for nested images in layouts
     */
    setupNestedImageUpload(layoutIndex, columnIndex, elementIndex) {
        const uploadArea = document.getElementById('nested-image-upload-area');
        const uploadInput = document.getElementById('nested-image-upload-input');

        if (!uploadArea || !uploadInput) return;

        uploadArea.addEventListener('click', () => uploadInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadNestedImage(files[0], layoutIndex, columnIndex, elementIndex);
            }
        });

        uploadInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadNestedImage(e.target.files[0], layoutIndex, columnIndex, elementIndex);
            }
        });
    }

    /**
     * Upload image for nested element
     */
    async uploadNestedImage(file, layoutIndex, columnIndex, elementIndex) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(this.uploadImageUrl, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Update the nested element's image src
                    this.updateNestedElementProperty(layoutIndex, columnIndex, elementIndex, 'src', data.url);
                    // Refresh properties panel to show new image
                    const layoutElement = this.elements[layoutIndex];
                    if (layoutElement && layoutElement.type === 'layout') {
                        const columnElements = layoutElement.content.columnElements || [];
                        const colElements = columnElements[columnIndex] || [];
                        const nestedElement = colElements[elementIndex];
                        if (nestedElement) {
                            this.showNestedElementProperties(layoutIndex, columnIndex, elementIndex, nestedElement);
                        }
                    }
                } else {
                    alert('Failed to upload image: ' + (data.message || 'Unknown error'));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Failed to upload image: ' + (errorData.message || 'Server error'));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error uploading image: ' + error.message);
        }
    }

    /**
     * Update a property of a nested element
     */
    updateNestedElementProperty(layoutIndex, columnIndex, elementIndex, property, value) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }

        const columnElements = layoutElement.content.columnElements || [];
        const colElements = columnElements[columnIndex] || [];
        const nestedElement = colElements[elementIndex];

        if (!nestedElement) {
            return;
        }

        // Initialize styles if needed
        if (!nestedElement.styles) {
            nestedElement.styles = this.getDefaultStyles(nestedElement.type);
        }

        // Handle content properties
        if (property === 'src' && nestedElement.type === 'image') {
            nestedElement.content.src = value;
        } else if (property === 'alt' && nestedElement.type === 'image') {
            nestedElement.content.alt = value;
        } else if (property === 'button-text' && nestedElement.type === 'button') {
            nestedElement.content.text = value;
        } else if (property === 'button-link' && nestedElement.type === 'button') {
            nestedElement.content.link = value;
        } else if (property === 'image-width') {
            // Store image-specific dimensions
            nestedElement.styles['image-width'] = value;
        } else if (property === 'image-height') {
            // Store image-specific dimensions
            nestedElement.styles['image-height'] = value;
        } else {
            // Style property
            nestedElement.styles[property] = value;
        }

        // Update the nested element in DOM directly (without re-rendering entire layout)
        // This is more efficient and prevents flickering during typing
        this.updateNestedElementInDOM(layoutIndex, columnIndex, elementIndex, nestedElement, property);
    }
    
    /**
     * Update a nested element in the DOM without re-rendering the entire layout
     * Similar to updateElementInDOM but for nested elements
     */
    updateNestedElementInDOM(layoutIndex, columnIndex, elementIndex, nestedElement, changedProperty = null) {
        const nestedEl = document.querySelector(
            `[data-layout-index="${layoutIndex}"][data-column-index="${columnIndex}"][data-element-index="${elementIndex}"]`
        );
        
        if (!nestedEl) {
            // If element doesn't exist in DOM, fall back to full re-render
            this.saveNestedElementsContent(layoutIndex);
            const oldLayoutElement = this.dropZone.querySelector(`[data-index="${layoutIndex}"]`);
            if (oldLayoutElement) {
                oldLayoutElement.remove();
            }
            this.renderElement(this.elements[layoutIndex], layoutIndex);
            setTimeout(() => {
                this.selectNestedElement(layoutIndex, columnIndex, elementIndex);
            }, 0);
            return;
        }
        
        // Build styles object
        const containerStyles = {};
        const imageStyles = {};
        const buttonStyles = {};
        
        Object.keys(nestedElement.styles || {}).forEach(key => {
            if (key === 'image-width' || key === 'image-height') {
                if (key === 'image-width') imageStyles['width'] = nestedElement.styles[key];
                if (key === 'image-height') imageStyles['height'] = nestedElement.styles[key];
            } else if (key === 'background-color' && nestedElement.type === 'button') {
                buttonStyles['background-color'] = nestedElement.styles[key];
            } else if (key === 'color' && nestedElement.type === 'button') {
                buttonStyles['color'] = nestedElement.styles[key];
            } else {
                containerStyles[key] = nestedElement.styles[key];
            }
        });
        
        // Apply container styles
        nestedEl.style.cssText = this.buildStylesFromObject(containerStyles);
        
        // Update content based on type
        if (nestedElement.type === 'text' || nestedElement.type === 'heading') {
            const editable = nestedEl.querySelector('[contenteditable="true"]');
            if (editable) {
                // Only update if it's not the content property (contenteditable handles its own updates)
                if (changedProperty !== 'content' && changedProperty !== null) {
                    const textContent = this.processVariableContentForEditor(nestedElement.content);
                    const htmlContent = this.convertNewlinesToBr(textContent);
                    // Only update if content actually changed to avoid cursor issues
                    if (editable.innerHTML !== htmlContent) {
                        editable.innerHTML = htmlContent;
                    }
                }
                // Apply text-specific styles
                const textStyles = {};
                if (nestedElement.styles?.['font-size']) textStyles['font-size'] = nestedElement.styles['font-size'];
                if (nestedElement.styles?.['font-weight']) textStyles['font-weight'] = nestedElement.styles['font-weight'];
                if (nestedElement.styles?.['color']) textStyles['color'] = nestedElement.styles['color'];
                if (nestedElement.styles?.['text-align']) textStyles['text-align'] = nestedElement.styles['text-align'];
                if (nestedElement.styles?.['background-color']) textStyles['background-color'] = nestedElement.styles['background-color'];
                editable.style.cssText = this.buildStylesFromObject(textStyles);
            }
        } else if (nestedElement.type === 'image') {
            const img = nestedEl.querySelector('img');
            if (img) {
                if (nestedElement.content?.src) img.src = nestedElement.content.src;
                if (nestedElement.content?.alt) img.alt = nestedElement.content.alt;
                if (Object.keys(imageStyles).length > 0) {
                    img.style.cssText = this.buildStylesFromObject(imageStyles);
                }
            }
        } else if (nestedElement.type === 'button') {
            const btn = nestedEl.querySelector('button');
            if (btn) {
                // Update button text if it changed
                if (changedProperty === 'button-text' || changedProperty === null) {
                    if (nestedElement.content?.text) {
                        btn.textContent = nestedElement.content.text;
                    }
                }
                // Apply button styles
                if (Object.keys(buttonStyles).length > 0) {
                    btn.style.cssText = this.buildStylesFromObject(buttonStyles);
                }
                // Apply other button styles and lock dimensions
                const buttonWidth = nestedElement.styles?.['width'] || '150px';
                const buttonHeight = nestedElement.styles?.['height'] || '40px';
                btn.style.width = buttonWidth;
                btn.style.height = buttonHeight;
                // Apply padding (use default if not set)
                if (nestedElement.styles?.['padding']) {
                    btn.style.padding = nestedElement.styles['padding'];
                } else {
                    btn.style.padding = '0.5rem 1.5rem'; // Default padding
                }
                if (nestedElement.styles?.['border-radius']) btn.style.borderRadius = nestedElement.styles['border-radius'];
                if (nestedElement.styles?.['border']) btn.style.border = nestedElement.styles['border'];
                // Lock button to prevent size changes on hover
                btn.style.flexShrink = '0';
                btn.style.flexGrow = '0';
                btn.style.boxSizing = 'border-box';
                btn.style.transition = 'none';
                btn.style.contain = 'layout style paint';
                // Ensure no margin for perfect alignment
                btn.style.margin = '0';
                // Explicitly prevent any size changes
                btn.style.maxWidth = 'none';
                btn.style.maxHeight = 'none';
                
                // Always update container size to fit button + padding (8px on each side = 16px total)
                const containerWidth = `calc(${buttonWidth} + 16px)`;
                const containerHeight = `calc(${buttonHeight} + 16px)`;
                nestedEl.style.width = containerWidth;
                nestedEl.style.minWidth = containerWidth;
                nestedEl.style.height = containerHeight;
                nestedEl.style.minHeight = containerHeight;
            }
        }
    }

    /**
     * Delete a nested element from a column
     */
    deleteNestedElement(layoutIndex, columnIndex, elementIndex) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }

        const columnElements = layoutElement.content.columnElements || [];
        const colElements = columnElements[columnIndex] || [];
        
        if (colElements[elementIndex]) {
            colElements.splice(elementIndex, 1);
            
            // Re-render the layout
            const oldLayoutElement = this.dropZone.querySelector(`[data-index="${layoutIndex}"]`);
            if (oldLayoutElement) {
                oldLayoutElement.remove();
            }
            this.renderElement(layoutElement, layoutIndex);
            
            // Clear properties panel
            this.showEmptyProperties();
        }
    }

    /**
     * Update layout columns count
     */
    updateLayoutColumns(layoutIndex, newColumns) {
        const layoutElement = this.elements[layoutIndex];
        if (!layoutElement || layoutElement.type !== 'layout') {
            return;
        }

        const oldColumns = layoutElement.content.columns || 2;
        layoutElement.content.columns = newColumns;

        // Initialize columnElements if needed
        if (!layoutElement.content.columnElements) {
            layoutElement.content.columnElements = Array.from({ length: oldColumns }, () => []);
        }

        // Adjust columnElements array to match new column count
        if (newColumns > oldColumns) {
            // Add new empty columns
            for (let i = oldColumns; i < newColumns; i++) {
                layoutElement.content.columnElements.push([]);
            }
        } else if (newColumns < oldColumns) {
            // Remove excess columns (keep their elements for now, user can re-add)
            layoutElement.content.columnElements = layoutElement.content.columnElements.slice(0, newColumns);
        }

        // Update grid-template-columns style
        if (!layoutElement.styles) {
            layoutElement.styles = this.getDefaultStyles('layout');
        }
        layoutElement.styles['grid-template-columns'] = `repeat(${newColumns}, 1fr)`;

        // Save nested elements content before re-rendering
        this.saveNestedElementsContent(layoutIndex);

        // Re-render the layout
        this.renderElement(layoutElement, layoutIndex);
        this.selectElement(layoutIndex);
    }
}

// Make PageBuilder available globally
window.PageBuilder = PageBuilder;

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageBuilder;
}

