/**
 * Page Builder Variables Module
 * Dynamically loads variables from Laravel config
 * Provides utilities for working with variables in dot notation
 */
class PageBuilderVariables {
    constructor(config) {
        // config should be an object with variable_categories structure
        this.categories = config.variable_categories || {};
        this.mockData = config.mock_data || {};
    }

    /**
     * Get all variables as a flat array with category information
     * @returns {Array} All variables with category information
     */
    getAllVariables() {
        const all = [];
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            if (category.variables && Array.isArray(category.variables)) {
                category.variables.forEach(variable => {
                    all.push({
                        ...variable,
                        category: categoryKey,
                        categoryLabel: category.label || categoryKey
                    });
                });
            }
        });
        return all;
    }

    /**
     * Get variable by path
     * @param {string} path - Variable path (e.g., 'invoice.invoice_no')
     * @returns {Object|null} Variable object or null if not found
     */
    getVariableByPath(path) {
        const all = this.getAllVariables();
        return all.find(v => v.path === path) || null;
    }

    /**
     * Convert dot notation to Blade syntax
     * @param {string} path - Variable path (e.g., 'invoice.invoice_no')
     * @returns {string} Blade syntax (e.g., '{{ $invoice->invoice_no }}')
     */
    pathToBlade(path) {
        const parts = path.split('.');
        if (parts.length === 0) return '';
        
        let bladePath = '$' + parts[0];
        for (let i = 1; i < parts.length; i++) {
            bladePath += '->' + parts[i];
        }
        return `{{ ${bladePath} }}`;
    }

    /**
     * Get mock data for preview
     * @returns {Object} Mock data object matching variable structure
     */
    getMockData() {
        return this.mockData;
    }

    /**
     * Replace variables in text with mock data
     * @param {string} text - Text containing variable paths
     * @param {Object} customMockData - Optional custom mock data
     * @returns {string} Text with variables replaced
     */
    replaceVariables(text, customMockData = null) {
        const mockData = customMockData || this.mockData;
        
        // Find all variable patterns {{ variable.path }}
        const variablePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
        
        return text.replace(variablePattern, (match, path) => {
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
            const variable = this.getVariableByPath(path);
            if (variable && variable.type === 'currency') {
                return `$${Number(value).toFixed(2)}`;
            }
            
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Get categories for dropdown
     * @returns {Object} Categories object
     */
    getCategories() {
        return this.categories;
    }
}

// Make available globally
window.PageBuilderVariables = PageBuilderVariables;


