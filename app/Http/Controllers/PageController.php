<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PageController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $pages = Page::latest()->get();
        return view('pages.index', compact('pages'));
    }

    /**
     * Show the form for creating a new resource.
     * Unified builder - no template type distinction
     */
    public function create(Request $request)
    {
        // Load variable configuration from config file
        $variableConfig = config('page-builder', []);
        
        // Get page title from query parameter if provided
        $pageTitle = $request->query('title', '');
        
        return view('pages.builder', [
            'variable_config' => $variableConfig,
            'page_title' => $pageTitle
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|array',
            'html' => 'nullable|string',
        ]);

        $page = Page::create([
            'title' => $validated['title'],
            'slug' => Str::slug($validated['title']) . '-' . time(),
            'content' => $validated['content'],
            'html' => $request->input('html'),
            'is_published' => $request->input('is_published', false),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Page saved successfully',
            'page' => $page,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $slug)
    {
        $page = Page::where('slug', $slug)->firstOrFail();
        
        if (!$page->is_published) {
            abort(404);
        }

        return view('pages.show', compact('page'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        $page = Page::findOrFail($id);
        // Load variable configuration from config file
        $variableConfig = config('page-builder', []);
        return view('pages.builder', compact('page', 'variable_config'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $page = Page::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|array',
            'html' => 'nullable|string',
        ]);

        $page->update([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'html' => $request->input('html'),
            'is_published' => $request->input('is_published', false),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Page updated successfully',
            'page' => $page,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $page = Page::findOrFail($id);
        $page->delete();

        return redirect()->route('pages.index')
            ->with('success', 'Page deleted successfully');
    }

    /**
     * API endpoint to save page content
     * Unified builder - generates HTML from content structure
     */
    public function saveContent(Request $request, $id = null)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|array',
            'html' => 'nullable|string',
        ]);
        
        // Generate full HTML with styles
        $fullHtml = $this->generateFullHtml($validated['content'], $validated['title']);

        if ($id) {
            $page = Page::findOrFail($id);
            $page->update([
                'title' => $validated['title'],
                'content' => $validated['content'],
                'html' => $fullHtml,
            ]);
        } else {
            $page = Page::create([
                'title' => $validated['title'],
                'slug' => Str::slug($validated['title']) . '-' . time(),
                'content' => $validated['content'],
                'html' => $fullHtml,
            ]);
        }

        // Save HTML to file
        $htmlFilePath = $this->saveHtmlToFile($page->id, $fullHtml);

        return response()->json([
            'success' => true,
            'page' => $page,
            'html_file' => $htmlFilePath,
            'redirect' => route('pages.index'),
        ]);
    }

    /**
     * View saved HTML file
     */
    public function viewHtml($id)
    {
        $page = Page::findOrFail($id);
        $htmlFilePath = storage_path('app/public/page-html/page-' . $id . '.html');
        
        if (file_exists($htmlFilePath)) {
            return response()->file($htmlFilePath);
        }

        // If file doesn't exist, generate it
        if ($page->html) {
            $this->saveHtmlToFile($page->id, $page->html);
            return response()->file($htmlFilePath);
        }

        abort(404, 'HTML file not found');
    }

    /**
     * Generate full HTML with styles
     */
    private function generateFullHtml(array $content, string $title): string
    {
        $html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . htmlspecialchars($title) . '</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
            min-height: 100vh;
        }
        .page-content {
            max-width: 1200px;
            margin: 0 auto;
            background-color: #fff;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .page-content > * {
            margin-bottom: 15px;
        }
        .page-content > *:last-child {
            margin-bottom: 0;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
        }
        button, a button {
            cursor: pointer;
            border: none;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="page-content">';

        foreach ($content as $element) {
            $styles = $this->buildStyles($element['styles'] ?? []);
            $styleAttr = $styles ? ' style="' . htmlspecialchars($styles) . '"' : '';

            if ($element['type'] === 'text') {
                $html .= '<p' . $styleAttr . '>' . htmlspecialchars($element['content'] ?? '') . '</p>';
            } elseif ($element['type'] === 'heading') {
                $html .= '<h2' . $styleAttr . '>' . htmlspecialchars($element['content'] ?? '') . '</h2>';
            } elseif ($element['type'] === 'image') {
                $src = $element['content']['src'] ?? 'https://via.placeholder.com/400x200';
                $alt = htmlspecialchars($element['content']['alt'] ?? '');
                $html .= '<img src="' . htmlspecialchars($src) . '" alt="' . $alt . '"' . $styleAttr . '>';
            } elseif ($element['type'] === 'button') {
                $link = $element['content']['link'] ?? '#';
                $text = htmlspecialchars($element['content']['text'] ?? 'Button');
                $bgColor = $element['styles']['background-color'] ?? '#3b82f6';
                $textColor = $element['styles']['color'] ?? '#ffffff';
                $html .= '<a href="' . htmlspecialchars($link) . '"' . $styleAttr . '>';
                $html .= '<button style="background-color: ' . htmlspecialchars($bgColor) . '; color: ' . htmlspecialchars($textColor) . '; padding: 10px 20px; border-radius: 4px;">' . $text . '</button>';
                $html .= '</a>';
            }
        }

        $html .= '
    </div>
</body>
</html>';

        return $html;
    }

    /**
     * Build CSS styles string from array
     */
    private function buildStyles(array $styles): string
    {
        $css = [];
        foreach ($styles as $prop => $value) {
            if ($value !== null && $value !== '') {
                $css[] = $prop . ': ' . $value;
            }
        }
        return implode('; ', $css);
    }

    /**
     * Generate invoice template with Blade syntax
     * Converts visual structure to Blade template code
     * @param array $content - Element structure from builder
     * @param string $title - Template title
     * @return string - Complete Blade template HTML
     */
    private function generateInvoiceTemplate(array $content, string $title): string
    {
        $html = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_no ?? "Invoice" }}</title>
    <style>
        body {
            font-family: Times New Roman, serif;
            padding: 40px;
            font-size: 12px;
            color: #000;
            background-color: #fff;
        }
        .header {
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .invoice-title {
            font-size: 2rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .info {
            margin-top: 5px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        th, td {
            border: 1px solid #000;
            padding: 6px;
        }
        th {
            background: #e6e6e6;
        }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
    </style>
</head>
<body>';

        // Process each element and convert to Blade
        foreach ($content as $element) {
            $html .= $this->processElementToBlade($element);
        }

        $html .= '
</body>
</html>';

        return $html;
    }

    /**
     * Process a single element and convert to Blade syntax
     * @param array $element - Element data structure
     * @return string - Blade/HTML code
     */
    private function processElementToBlade(array $element): string
    {
        $styles = $this->buildStyles($element['styles'] ?? []);
        $styleAttr = $styles ? ' style="' . htmlspecialchars($styles) . '"' : '';

        switch ($element['type']) {
            case 'text':
                $content = $this->processVariableContent($element['content'] ?? '');
                return '<p' . $styleAttr . '>' . $content . '</p>';

            case 'heading':
                $content = $this->processVariableContent($element['content'] ?? '');
                return '<h2' . $styleAttr . '>' . $content . '</h2>';

            case 'variable':
                $path = $element['content']['path'] ?? '';
                if ($path) {
                    return $this->pathToBlade($path);
                }
                return '{{ variable }}';

            case 'conditional':
                $condition = $element['content']['condition'] ?? '';
                if (!$condition) return '';
                
                $bladeCondition = $this->pathToBladeVariable($condition);
                $html = '@if(' . $bladeCondition . ')' . "\n";
                
                // Process true content
                if (isset($element['content']['trueContent']) && is_array($element['content']['trueContent'])) {
                    foreach ($element['content']['trueContent'] as $subElement) {
                        $html .= $this->processElementToBlade($subElement);
                    }
                }
                
                // Process else content if enabled
                if (!empty($element['content']['showElse'])) {
                    $html .= '@else' . "\n";
                    if (isset($element['content']['falseContent']) && is_array($element['content']['falseContent'])) {
                        foreach ($element['content']['falseContent'] as $subElement) {
                            $html .= $this->processElementToBlade($subElement);
                        }
                    }
                }
                
                $html .= '@endif' . "\n";
                return $html;

            case 'loop':
                $loopVar = $element['content']['loopVariable'] ?? '';
                $itemVar = $element['content']['itemVariable'] ?? 'item';
                if (!$loopVar) return '';
                
                $bladeLoopVar = $this->pathToBladeVariable($loopVar);
                $html = '@foreach(' . $bladeLoopVar . ' as $' . $itemVar . ')' . "\n";
                
                // Process loop content
                if (isset($element['content']['content']) && is_array($element['content']['content'])) {
                    foreach ($element['content']['content'] as $subElement) {
                        $html .= $this->processElementToBlade($subElement);
                    }
                }
                
                $html .= '@endforeach' . "\n";
                return $html;

            case 'invoice-header':
                $title = $element['content']['title'] ?? 'Invoice';
                $showUserInfo = !empty($element['content']['showUserInfo']);
                $html = '<div class="header">';
                $html .= '<div class="invoice-title">' . htmlspecialchars($title) . '</div>';
                if ($showUserInfo) {
                    $html .= '<div class="info">';
                    $html .= '<strong>{{ $user->name }}</strong><br>';
                    $html .= '{{ $user->address }}';
                    $html .= '</div>';
                }
                $html .= '</div>';
                return $html;

            case 'invoice-info-table':
                $showClient = !empty($element['content']['showClientInfo']);
                $showDetails = !empty($element['content']['showInvoiceDetails']);
                $html = '<table style="margin-bottom: 20px;">';
                $html .= '<tr>';
                if ($showClient) {
                    $html .= '<td>';
                    $html .= '<div class="bold" style="color: darkred;">Invoice To:</div>';
                    $html .= '<div class="bold">{{ $client->name }}</div>';
                    $html .= '<div>{{ $client->address }}</div>';
                    $html .= '@if(!empty($client->tax))';
                    $html .= '<div>{{ $client->tax }}</div>';
                    $html .= '@endif';
                    $html .= '</td>';
                }
                if ($showDetails) {
                    $html .= '<td class="text-right">';
                    $html .= '<div><strong>Invoice #:</strong> {{ $invoice->invoice_no }}</div>';
                    $html .= '<div><strong>Date:</strong> {{ \Carbon\Carbon::parse($invoice->invoice_date)->format("d/m/Y") }}</div>';
                    $html .= '<div><strong>Due:</strong> {{ \Carbon\Carbon::parse($invoice->due_date)->format("d/m/Y") }}</div>';
                    $html .= '</td>';
                }
                $html .= '</tr></table>';
                return $html;

            case 'invoice-items-table':
                $loopVar = $element['content']['loopVariable'] ?? 'invoice.other_expenses';
                $columns = $element['content']['columns'] ?? ['description', 'amount'];
                $bladeLoopVar = $this->pathToBladeVariable($loopVar);
                
                $html = '<table>';
                $html .= '<thead><tr>';
                if (in_array('description', $columns)) {
                    $html .= '<th>Description</th>';
                }
                if (in_array('amount', $columns)) {
                    $html .= '<th>Amount USD</th>';
                }
                $html .= '</tr></thead>';
                $html .= '<tbody>';
                $html .= '@foreach(' . $bladeLoopVar . ' as $item)';
                $html .= '<tr>';
                if (in_array('description', $columns)) {
                    $html .= '<td>{{ $item["label"] ?? $item->label ?? "" }}</td>';
                }
                if (in_array('amount', $columns)) {
                    $html .= '<td class="text-right">${{ number_format($item["amount"] ?? $item->amount ?? 0, 2) }}</td>';
                }
                $html .= '</tr>';
                $html .= '@endforeach';
                $html .= '</tbody></table>';
                return $html;

            case 'invoice-totals':
                $showSubtotal = !empty($element['content']['showSubtotal']);
                $showTotal = !empty($element['content']['showTotal']);
                $html = '<table>';
                $html .= '<tbody>';
                if ($showSubtotal) {
                    $html .= '<tr>';
                    $html .= '<td class="bold">Sub-Total:</td>';
                    $html .= '<td class="text-right">${{ number_format($invoice->total, 2) }}</td>';
                    $html .= '</tr>';
                }
                if ($showTotal) {
                    $html .= '<tr>';
                    $html .= '<td class="bold">Total USD:</td>';
                    $html .= '<td class="text-right bold">${{ number_format($invoice->total, 2) }}</td>';
                    $html .= '</tr>';
                }
                $html .= '</tbody></table>';
                return $html;

            case 'invoice-payment-info':
                $html = '<div style="margin-top: 20px;">';
                $html .= '<div class="bold">Payment Options:</div>';
                $html .= '@if($bankInfo)';
                $html .= '<table style="margin-top: 10px;">';
                $html .= '<tr><td><b>Bank Country:</b></td><td>{{ $bankInfo->bank_country }}</td></tr>';
                $html .= '<tr><td><b>Bank:</b></td><td>{{ $bankInfo->bank_name }}</td></tr>';
                $html .= '<tr><td><b>SWIFT/BIC Code:</b></td><td>{{ $bankInfo->bank_swift }}</td></tr>';
                $html .= '<tr><td><b>Account Number:</b></td><td>{{ $bankInfo->bank_account }}</td></tr>';
                $html .= '<tr><td><b>Account Name:</b></td><td>{{ $user->name }}</td></tr>';
                $html .= '<tr><td><b>Address:</b></td><td>{{ $user->address }}</td></tr>';
                $html .= '<tr><td><b>Phone:</b></td><td>{{ $user->phone }}</td></tr>';
                $html .= '</table>';
                $html .= '@else';
                $html .= '<p><em>No bank information assigned to this client.</em></p>';
                $html .= '@endif';
                $html .= '</div>';
                return $html;

            default:
                return '';
        }
    }

    /**
     * Process content string to convert variable paths to Blade syntax
     * @param string $content - Content that may contain variables
     * @return string - Content with Blade variables
     */
    private function processVariableContent(string $content): string
    {
        // Convert dot notation paths to Blade syntax
        // Pattern: variable.path or {{ variable.path }}
        $pattern = '/\b([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+)\b/';
        
        return preg_replace_callback($pattern, function($matches) {
            $path = $matches[1];
            return $this->pathToBlade($path);
        }, $content);
    }

    /**
     * Convert dot notation path to Blade variable syntax
     * @param string $path - Variable path (e.g., 'invoice.invoice_no')
     * @return string - Blade syntax (e.g., '{{ $invoice->invoice_no }}')
     */
    private function pathToBlade(string $path): string
    {
        $parts = explode('.', $path);
        if (count($parts) === 0) return '';
        
        $bladePath = '$' . $parts[0];
        for ($i = 1; $i < count($parts); $i++) {
            $bladePath .= '->' . $parts[$i];
        }
        return '{{ ' . $bladePath . ' }}';
    }

    /**
     * Convert dot notation path to Blade variable (without {{ }})
     * @param string $path - Variable path
     * @return string - Blade variable (e.g., '$invoice->invoice_no')
     */
    private function pathToBladeVariable(string $path): string
    {
        $parts = explode('.', $path);
        if (count($parts) === 0) return '';
        
        $bladePath = '$' . $parts[0];
        for ($i = 1; $i < count($parts); $i++) {
            $bladePath .= '->' . $parts[$i];
        }
        return $bladePath;
    }

    /**
     * Save HTML to file
     * @param int $pageId - Page ID
     * @param string $html - HTML content
     * @return string - Relative file path
     */
    private function saveHtmlToFile(int $pageId, string $html): string
    {
        $directory = storage_path('app/public/page-html');
        if (!file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        $filename = 'page-' . $pageId . '.html';
        $filePath = $directory . '/' . $filename;
        file_put_contents($filePath, $html);

        return 'storage/page-html/' . $filename;
    }

    /**
     * API endpoint to load page content
     */
    public function loadContent($id)
    {
        $page = Page::findOrFail($id);
        return response()->json([
            'success' => true,
            'page' => $page,
        ]);
    }

    /**
     * Upload image for page builder
     */
    public function uploadImage(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ]);

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $filename = time() . '_' . uniqid() . '.' . $image->getClientOriginalExtension();
            $path = $image->storeAs('page-images', $filename, 'public');
            
            return response()->json([
                'success' => true,
                'url' => asset('storage/' . $path),
                'path' => $path,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'No image uploaded',
        ], 400);
    }
}
