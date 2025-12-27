@extends('layouts.app')

@section('title', isset($page) ? 'Edit Page' : 'Create Page')

@push('styles')
<style>
    .builder-sidebar {
        width: 280px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        border-right: 1px solid #e2e8f0;
        overflow-y: auto;
        height: calc(100vh - 64px);
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
    }
    .properties-sidebar {
        width: 320px;
        background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        border-left: 1px solid #e2e8f0;
        overflow-y: auto;
        height: calc(100vh - 64px);
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.04);
    }
    .builder-canvas {
        flex: 1;
        background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
        overflow-y: auto;
        height: calc(100vh - 64px);
        position: relative;
    }
    .component-item {
        cursor: move;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .component-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: #cbd5e1;
    }
    .component-item:active {
        transform: translateY(0);
    }
    .drop-zone {
        min-height: 200px;
        border: 2px dashed #cbd5e1;
        padding: 10px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: white;
        margin: 10px;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .drop-zone.drag-over {
        border-color: #3b82f6;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-style: solid;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        transform: scale(1.01);
    }
    .column-content.drag-over {
        border-color: #3b82f6;
        background-color: #eff6ff;
        border: 2px solid #3b82f6;
    }
    .layout-column.drag-over {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }
    .builder-element {
        position: relative;
        margin-bottom: 12px;
        padding: 12px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 8px;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    /* For button elements on main canvas, ensure container fits button properly */
    .builder-element[data-type="button"] {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    }
    .builder-element[data-type="button"] button {
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        transition: none !important;
        contain: layout style paint !important;
        margin: 0 !important;
    }
    .builder-element[data-type="button"]:hover button {
        transform: none !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        transition: none !important;
        contain: layout style paint !important;
        margin: 0 !important;
    }
    /* Override builder-element padding for button containers */
    .builder-element.nested-button-container {
        padding: 8px !important;
    }
    .builder-element:hover {
        border-color: #60a5fa;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        transform: translateY(-1px);
    }
    .builder-element.selected {
        border-color: #3b82f6;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 4px 12px rgba(59, 130, 246, 0.2);
    }
    .nested-element {
        position: relative;
        margin-bottom: 12px;
        padding: 12px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        min-height: 30px;
        border-radius: 8px;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        box-sizing: border-box;
        /* Lock dimensions to prevent size changes */
        contain: layout style;
        /* Center content by default */
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }
    /* For button containers, ensure button fits inside properly and is perfectly centered */
    /* Override both .builder-element and .nested-element padding with multiple selectors for higher specificity */
    .nested-element.nested-button-container,
    .builder-element.nested-button-container,
    .nested-element.nested-button-container.builder-element {
        padding: 8px !important;
        justify-content: center !important;
        align-items: center !important;
        /* Container size is set via inline styles (calculated from button size + 16px) */
        /* Ensure perfect centering - both horizontal and vertical */
        display: flex !important;
        /* Ensure container wraps button properly */
        box-sizing: border-box !important;
        /* Ensure button stays inside - use hidden to clip overflow */
        overflow: hidden !important;
        position: relative;
        /* Remove default margin that might cause offset */
        margin: 0 !important;
        /* Ensure container doesn't stretch */
        flex-shrink: 0;
        flex-grow: 0;
    }
    .nested-element:hover {
        /* Use outline instead of border to prevent box model changes */
        outline: 2px solid #60a5fa;
        outline-offset: -2px;
        border-color: transparent;
        background: rgba(59, 130, 246, 0.05);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        box-sizing: border-box;
        /* Ensure no size changes */
        contain: layout style;
    }
    /* Prevent builder-element hover styles from affecting nested elements */
    .nested-element.builder-element:hover {
        transform: none;
    }
    .nested-element button:not(.delete-nested-element) {
        box-sizing: border-box !important;
        display: block !important;
        position: relative !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        /* Prevent any transitions that could cause size changes */
        transition: none !important;
        /* Lock the button's layout to prevent recalculation */
        contain: layout style paint !important;
        /* Remove margin and ensure perfect alignment */
        margin: 0 !important;
        /* Override any Tailwind padding that might interfere */
        padding: 0.5rem 1.5rem !important;
        /* Button width/height are set via inline styles - don't override with CSS */
        max-width: none !important;
        max-height: none !important;
        /* Ensure button aligns perfectly in flex container */
        align-self: center;
    }
    .nested-element:hover button:not(.delete-nested-element) {
        /* Lock all dimensions - use exact same values as non-hover state */
        /* Don't override width/height - let inline styles handle it */
        transform: none !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        transition: none !important;
        display: block !important;
        /* Lock padding to prevent recalculation */
        padding: 0.5rem 1.5rem !important;
        /* Prevent any layout recalculation */
        contain: layout style paint !important;
        /* Ensure no margin changes */
        margin: 0 !important;
        /* Don't override width/height - preserve inline styles */
        max-width: none !important;
        max-height: none !important;
    }
    .nested-element .delete-nested-element {
        position: absolute !important;
        top: 4px !important;
        right: 4px !important;
        z-index: 100 !important;
    }
    .nested-element.selected {
        border-color: #3b82f6;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 4px 12px rgba(59, 130, 246, 0.2);
    }
    .property-group {
        margin-bottom: 1.5rem;
    }
    .property-label {
        display: block;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 0.5rem;
        letter-spacing: 0.01em;
    }
    .property-input {
        width: 100%;
        padding: 0.625rem;
        border: 1.5px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        background: white;
    }
    .property-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        background: #fafbfc;
    }
    .property-input:hover {
        border-color: #cbd5e1;
    }
    .builder-element {
        transition: all 0.2s ease-in-out;
    }
    .image-preview {
        max-width: 100%;
        max-height: 200px;
        margin-top: 0.5rem;
        border-radius: 0.375rem;
    }
    .upload-area {
        border: 2px dashed #d1d5db;
        border-radius: 0.375rem;
        padding: 1rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
    }
    .upload-area:hover {
        border-color: #3b82f6;
        background-color: #f0f9ff;
    }
    .upload-area.dragover {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }
</style>
@endpush

@section('content')
<div class="flex h-screen" style="margin-top: -64px; padding-top: 64px;">
    <!-- Left Sidebar - Components -->
    <div class="builder-sidebar p-4">
        <div class="mb-4">
            <h2 class="text-xl font-bold text-gray-800 mb-3">Components</h2>
            <!-- Search Bar -->
            <div class="relative mb-4">
                <input type="text" id="component-search" placeholder="Search components..." class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white">
                <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
            </div>
        </div>
        
        <!-- Basic Components -->
        <div id="components-list" class="space-y-2 mb-6">
            <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 group" draggable="true" data-type="text" data-name="Text" title="Text">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mr-3 group-hover:from-blue-200 group-hover:to-blue-300 transition-all">
                        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Text</span>
                </div>
            </div>
            <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 group" draggable="true" data-type="heading" data-name="Heading" title="Heading">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mr-3 group-hover:from-purple-200 group-hover:to-purple-300 transition-all">
                        <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Heading</span>
                </div>
            </div>
            <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 group" draggable="true" data-type="image" data-name="Image" title="Image">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mr-3 group-hover:from-green-200 group-hover:to-green-300 transition-all">
                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Image</span>
                </div>
            </div>
            <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50 group" draggable="true" data-type="button" data-name="Button" title="Button">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center mr-3 group-hover:from-orange-200 group-hover:to-orange-300 transition-all">
                        <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Button</span>
                </div>
            </div>
            <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-indigo-50 hover:to-violet-50 group" draggable="true" data-type="layout" data-name="Layout" title="Layout (Columns)">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center mr-3 group-hover:from-indigo-200 group-hover:to-indigo-300 transition-all">
                        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"></path>
                        </svg>
                    </div>
                    <span class="text-sm font-medium text-gray-700">Layout</span>
                </div>
            </div>
        </div>

        <!-- Advanced Components -->
        <div class="mb-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Advanced</h3>
            <div id="advanced-components-list" class="space-y-2">
                <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-purple-50 hover:to-fuchsia-50 group" draggable="true" data-type="conditional" data-name="If/Else Block" title="If/Else Block">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mr-3 group-hover:from-purple-200 group-hover:to-purple-300 transition-all">
                            <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-gray-700">If/Else Block</span>
                    </div>
                </div>
                <div class="component-item bg-white p-3 rounded-lg cursor-move hover:bg-gradient-to-br hover:from-green-50 hover:to-teal-50 group" draggable="true" data-type="loop" data-name="Loop Block" title="Loop Block">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mr-3 group-hover:from-green-200 group-hover:to-green-300 transition-all">
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-gray-700">Loop Block</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Canvas -->
    <div class="builder-canvas">
        <div class="p-4">
            <div class="mb-4 flex justify-end items-center">
                <div class="flex space-x-3">
                    <button id="preview-btn" class="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-5 py-2.5 rounded-lg hover:from-gray-700 hover:to-gray-800 font-medium shadow-md hover:shadow-lg transition-all">
                        Preview
                    </button>
                    <button id="save-btn" class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all">
                        Save
                    </button>
                </div>
            </div>

            <div id="drop-zone" class="drop-zone" style="min-height: calc(100vh - 200px);">
                <div class="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                    </div>
                    <p class="text-gray-500 font-medium mb-1">Drag components here</p>
                    <p class="text-gray-400 text-sm">to build your page</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Right Sidebar - Properties -->
    <div class="properties-sidebar p-4">
        <div class="mb-6">
            <h2 class="text-xl font-bold text-gray-800 mb-1">Properties</h2>
            <p class="text-xs text-gray-500">Edit selected element</p>
        </div>
        <div id="properties-panel">
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 text-center border border-gray-200">
                <svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                </svg>
                <p class="text-gray-500 text-sm font-medium">Select an element to edit</p>
                <p class="text-gray-400 text-xs mt-1">its properties</p>
            </div>
        </div>
    </div>
</div>

<!-- Page Name Modal -->
<div id="page-name-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center" style="display: none;">
    <div class="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        <h3 class="text-2xl font-bold text-gray-800 mb-2">Create New Page</h3>
        <p class="text-gray-600 mb-6">Enter a name for your page</p>
        <input type="text" id="modal-page-title" placeholder="Page name..." class="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg mb-6" autofocus>
        <div class="flex space-x-3">
            <button id="modal-cancel-btn" class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-all">
                Cancel
            </button>
            <button id="modal-create-btn" class="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all">
                Create
            </button>
        </div>
    </div>
</div>

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables from config
    const variableConfig = @json($variable_config ?? []);
    const pageBuilderVariables = new PageBuilderVariables(variableConfig);
    window.pageBuilderVariables = pageBuilderVariables;

    // Initialize Page Builder
    const pageBuilder = new PageBuilder({
        dropZoneId: 'drop-zone',
        propertiesPanelId: 'properties-panel',
        saveBtnId: 'save-btn',
        previewBtnId: 'preview-btn',
        pageTitleId: null, // No page title input anymore
        elements: @json($page->content ?? []),
        csrfToken: '{{ csrf_token() }}',
        saveUrl: '{{ route("api.pages.save") }}',
        updateUrl: '{{ isset($page) ? route("api.pages.update", $page->id) : null }}',
        uploadImageUrl: '{{ route("api.pages.upload-image") }}',
        redirectUrl: '{{ route("pages.index") }}',
        variables: pageBuilderVariables
    });
    
    // Component search functionality
    const componentSearch = document.getElementById('component-search');
    
    if (componentSearch) {
        componentSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const allComponents = document.querySelectorAll('.component-item');
            
            allComponents.forEach(component => {
                const componentName = component.dataset.name?.toLowerCase() || component.getAttribute('title')?.toLowerCase() || '';
                const componentType = component.dataset.type?.toLowerCase() || '';
                
                if (componentName.includes(searchTerm) || componentType.includes(searchTerm)) {
                    component.style.display = '';
                } else {
                    component.style.display = 'none';
                }
            });
        });
    }

    // Page name modal for new pages
    const pageNameModal = document.getElementById('page-name-modal');
    const modalPageTitle = document.getElementById('modal-page-title');
    const modalCreateBtn = document.getElementById('modal-create-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    let pageTitle = '{{ $page->title ?? $page_title ?? "" }}';
    
    // Set initial title if provided from URL
    if (pageTitle && modalPageTitle) {
        modalPageTitle.value = pageTitle;
    }
    
    // Store page title globally for savePage to access
    window.pageTitle = pageTitle;
    
    // Only show modal if this is a new page (no existing page title)
    @if(!isset($page) || !$page->title)
        if (pageNameModal) {
            if (!pageTitle) {
                // Show modal if no title provided
                pageNameModal.style.display = 'flex';
                modalPageTitle.focus();
            } else {
                // Hide modal if title already provided
                pageNameModal.style.display = 'none';
            }
            
            // Handle Enter key
            modalPageTitle.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleModalCreate();
                }
            });
            
            // Handle create button
            modalCreateBtn.addEventListener('click', handleModalCreate);
            
            // Handle cancel button
            modalCancelBtn.addEventListener('click', () => {
                window.location.href = '{{ route("pages.index") }}';
            });
            
            function handleModalCreate() {
                const title = modalPageTitle.value.trim();
                if (title) {
                    pageTitle = title;
                    window.pageTitle = title;
                    pageNameModal.style.display = 'none';
                } else {
                    alert('Please enter a page name');
                    modalPageTitle.focus();
                }
            }
        }
    @endif

});
</script>
@endpush
@endsection
