<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('pages.index');
});

// Page builder routes
Route::resource('pages', PageController::class);
Route::get('/builder', [PageController::class, 'create'])->name('builder.create');
Route::get('/builder/{id}', [PageController::class, 'edit'])->name('builder.edit');

// Public page display
Route::get('/page/{slug}', [PageController::class, 'show'])->name('page.show');

// API routes for saving/loading
Route::post('/api/pages/save', [PageController::class, 'saveContent'])->name('api.pages.save');
Route::post('/api/pages/{id}/save', [PageController::class, 'saveContent'])->name('api.pages.update');
Route::get('/api/pages/{id}/load', [PageController::class, 'loadContent'])->name('api.pages.load');
Route::post('/api/pages/upload-image', [PageController::class, 'uploadImage'])->name('api.pages.upload-image');

// View saved HTML files
Route::get('/pages/{id}/html', [PageController::class, 'viewHtml'])->name('pages.html');
