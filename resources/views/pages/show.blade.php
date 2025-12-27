<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $page->title }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h2 {
            font-size: 2rem;
            margin: 20px 0;
            font-weight: bold;
        }
        p {
            margin: 10px 0;
            font-size: 1rem;
        }
        img {
            max-width: 100%;
            height: auto;
            margin: 20px 0;
        }
        button {
            background: #3b82f6;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            margin: 10px 0;
        }
        button:hover {
            background: #2563eb;
        }
    </style>
</head>
<body>
    <h1>{{ $page->title }}</h1>
    
    @if($page->html)
        {!! $page->html !!}
    @else
        <div class="page-content">
            @foreach($page->content as $element)
                @php
                    $styles = isset($element['styles']) ? buildStyles($element['styles']) : '';
                    $styleAttr = $styles ? ' style="' . $styles . '"' : '';
                @endphp
                @if($element['type'] === 'text')
                    <p{!! $styleAttr !!}>{{ $element['content'] ?? '' }}</p>
                @elseif($element['type'] === 'heading')
                    <h2{!! $styleAttr !!}>{{ $element['content'] ?? '' }}</h2>
                @elseif($element['type'] === 'image')
                    <img src="{{ $element['content']['src'] ?? 'https://via.placeholder.com/400x200' }}" alt="{{ $element['content']['alt'] ?? '' }}"{!! $styleAttr !!}>
                @elseif($element['type'] === 'button')
                    <a href="{{ $element['content']['link'] ?? '#' }}"{!! $styleAttr !!}>
                        <button style="background-color: {{ $element['styles']['background-color'] ?? '#3b82f6' }}; color: {{ $element['styles']['color'] ?? '#ffffff' }};">
                            {{ $element['content']['text'] ?? 'Button' }}
                        </button>
                    </a>
                @endif
            @endforeach
        </div>
    @endif

@php
function buildStyles($styles) {
    if (!is_array($styles)) return '';
    $css = [];
    foreach ($styles as $prop => $value) {
        if ($value !== null && $value !== '') {
            $css[] = $prop . ': ' . $value;
        }
    }
    return implode('; ', $css);
}
@endphp
</body>
</html>

