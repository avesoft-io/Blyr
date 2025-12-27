@extends('layouts.app')

@section('title', 'Pages')

@section('content')
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Pages & Templates</h1>
        <div class="flex space-x-2">
            <button id="create-page-btn" class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all">
                Create New Page
            </button>
        </div>
    </div>

    @if(session('success'))
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {{ session('success') }}
        </div>
    @endif

    <div class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTML File</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                @forelse($pages as $page)
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">{{ $page->title }}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-500">{{ $page->slug }}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            @if($page->is_published)
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Published
                                </span>
                            @else
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Draft
                                </span>
                            @endif
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            @php
                                $htmlFile = storage_path('app/public/page-html/page-' . $page->id . '.html');
                                $hasHtml = file_exists($htmlFile);
                            @endphp
                            @if($hasHtml)
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                    ✓ Saved
                                </span>
                            @else
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    Not Saved
                                </span>
                            @endif
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {{ $page->created_at->format('M d, Y') }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a href="{{ route('builder.edit', $page->id) }}" class="text-blue-600 hover:text-blue-900 mr-3">Edit</a>
                            <a href="{{ route('pages.html', $page->id) }}" target="_blank" class="text-purple-600 hover:text-purple-900 mr-3">View HTML</a>
                            @if($page->is_published)
                                <a href="{{ route('page.show', $page->slug) }}" target="_blank" class="text-green-600 hover:text-green-900 mr-3">View</a>
                            @endif
                            <form action="{{ route('pages.destroy', $page->id) }}" method="POST" class="inline">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-red-600 hover:text-red-900" onclick="return confirm('Are you sure?')">Delete</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                            No pages found. <a href="{{ route('builder.create') }}" class="text-blue-600 hover:underline">Create one</a>
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>
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
    const createPageBtn = document.getElementById('create-page-btn');
    const pageNameModal = document.getElementById('page-name-modal');
    const modalPageTitle = document.getElementById('modal-page-title');
    const modalCreateBtn = document.getElementById('modal-create-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    
    if (createPageBtn && pageNameModal) {
        createPageBtn.addEventListener('click', () => {
            pageNameModal.style.display = 'flex';
            modalPageTitle.focus();
        });
        
        modalPageTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleCreate();
            }
        });
        
        modalCreateBtn.addEventListener('click', handleCreate);
        
        modalCancelBtn.addEventListener('click', () => {
            pageNameModal.style.display = 'none';
            modalPageTitle.value = '';
        });
        
        function handleCreate() {
            const title = modalPageTitle.value.trim();
            if (title) {
                window.location.href = '{{ route("builder.create") }}?title=' + encodeURIComponent(title);
            } else {
                alert('Please enter a page name');
                modalPageTitle.focus();
            }
        }
    }
});
</script>
@endpush
@endsection

