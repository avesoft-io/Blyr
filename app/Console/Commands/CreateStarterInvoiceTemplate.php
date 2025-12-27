<?php

namespace App\Console\Commands;

use App\Models\Page;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Command to create a starter invoice template
 * Matches the structure of the existing invoice template
 */
class CreateStarterInvoiceTemplate extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'template:create-starter-invoice {--force : Overwrite existing template}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a starter invoice template matching the current invoice structure';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        // Check if template already exists
        $existing = Page::where('template_type', 'invoice')
            ->where('slug', 'like', 'default-invoice-template%')
            ->first();

        if ($existing && !$this->option('force')) {
            $this->error('Starter invoice template already exists. Use --force to overwrite.');
            return 1;
        }

        // Create the starter template structure
        $elements = $this->getStarterTemplateElements();

        // Generate the Blade HTML
        $html = $this->generateStarterTemplateHtml();

        if ($existing) {
            $existing->update([
                'title' => 'Default Invoice Template',
                'content' => $elements,
                'html' => $html,
                'template_data' => [
                    'description' => 'Starter invoice template matching the current invoice structure',
                    'version' => '1.0'
                ]
            ]);
            $this->info('Starter invoice template updated successfully!');
        } else {
            Page::create([
                'title' => 'Default Invoice Template',
                'slug' => 'default-invoice-template-' . time(),
                'template_type' => 'invoice',
                'content' => $elements,
                'html' => $html,
                'is_published' => false,
                'template_data' => [
                    'description' => 'Starter invoice template matching the current invoice structure',
                    'version' => '1.0'
                ]
            ]);
            $this->info('Starter invoice template created successfully!');
        }

        return 0;
    }

    /**
     * Get the starter template element structure
     * Matches the current invoice template layout
     * 
     * @return array
     */
    private function getStarterTemplateElements(): array
    {
        return [
            // Invoice Header
            [
                'id' => time() + 1,
                'type' => 'invoice-header',
                'content' => [
                    'title' => 'Invoice',
                    'showUserInfo' => true
                ],
                'styles' => [
                    'margin-bottom' => '20px',
                    'padding-bottom' => '10px',
                    'border-bottom' => '3px solid #000'
                ]
            ],
            // Invoice Info Table
            [
                'id' => time() + 2,
                'type' => 'invoice-info-table',
                'content' => [
                    'showClientInfo' => true,
                    'showInvoiceDetails' => true
                ],
                'styles' => [
                    'margin-bottom' => '20px'
                ]
            ],
            // Items Table
            [
                'id' => time() + 3,
                'type' => 'invoice-items-table',
                'content' => [
                    'columns' => ['description', 'amount'],
                    'loopVariable' => 'invoice.other_expenses'
                ],
                'styles' => []
            ],
            // Totals Section
            [
                'id' => time() + 4,
                'type' => 'invoice-totals',
                'content' => [
                    'showSubtotal' => true,
                    'showTotal' => true
                ],
                'styles' => []
            ],
            // Payment Info (wrapped in conditional)
            [
                'id' => time() + 5,
                'type' => 'invoice-payment-info',
                'content' => [
                    'wrappedInConditional' => true
                ],
                'styles' => [
                    'margin-top' => '20px'
                ]
            ]
        ];
    }

    /**
     * Generate the complete Blade template HTML
     * Matches the current invoice template exactly
     * 
     * @return string
     */
    private function generateStarterTemplateHtml(): string
    {
        return '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $invoice->invoice_no }}</title>
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
<body>
    <div class="header">
        <div class="invoice-title">Invoice</div>
        <div class="info">
            <strong>{{ $user->name }}</strong><br>
            {{ $user->address }}
        </div>
    </div>

    <table style="margin-bottom: 20px;">
        <tr>
            <td>
                @php
                    $client = \App\Models\Client::find($invoice->client_id);
                @endphp
                <div class="bold" style="color: darkred;">Invoice To:</div>
                <div class="bold">{{ $client->name }}</div>
                <div>{{ $client->address }}</div>
                @if(!empty($client->tax))
                    <div>{{ $client->tax }}</div>
                @endif
            </td>
            <td class="text-right">
                <div><strong>Invoice #:</strong> {{ $invoice->invoice_no }}</div>
                <div><strong>Date:</strong> {{ \Carbon\Carbon::parse($invoice->invoice_date)->format("d/m/Y") }}</div>
                <div><strong>Due:</strong> {{ \Carbon\Carbon::parse($invoice->due_date)->format("d/m/Y") }}</div>
            </td>
        </tr>
    </table>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Amount USD</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $invoice->description }} {{ \Carbon\Carbon::parse($invoice->invoice_date)->format("d/m/Y") }} - {{ \Carbon\Carbon::parse($invoice->due_date)->format("d/m/Y") }}</td>
                <td class="text-right">${{ number_format($invoice->amount, 2) }}</td>
            </tr>
            @php
                $expenses = is_array($invoice->other_expenses) ? $invoice->other_expenses : json_decode($invoice->other_expenses, true);
            @endphp

            @if(!empty($expenses))
                @foreach($expenses as $expense)
                    <tr>
                        <td>{{ $expense["label"] ?? $expense->label ?? "" }}</td>
                        <td class="text-right">${{ number_format($expense["amount"] ?? $expense->amount ?? 0, 2) }}</td>
                    </tr>
                @endforeach
            @endif
            <tr>
                <td class="bold">Sub-Total:</td>
                <td class="text-right">${{ number_format($invoice->total, 2) }}</td>
            </tr>
            <tr>
                <td class="bold">Total USD:</td>
                <td class="text-right bold">${{ number_format($invoice->total, 2) }}</td>
            </tr>
        </tbody>
    </table>

    <div style="margin-top: 20px;">
        <div class="bold">Payment Options:</div>
        @if($bankInfo)
            <table style="margin-top: 10px;">
                <tr><td><b>Bank Country:</b></td><td>{{ $bankInfo->bank_country }}</td></tr>
                <tr><td><b>Bank:</b></td><td>{{ $bankInfo->bank_name }}</td></tr>
                <tr><td><b>SWIFT/BIC Code:</b></td><td>{{ $bankInfo->bank_swift }}</td></tr>
                <tr><td><b>Account Number:</b></td><td>{{ $bankInfo->bank_account }}</td></tr>
                <tr><td><b>Account Name:</b></td><td>{{ $user->name }}</td></tr>
                <tr><td><b>Address:</b></td><td>{{ $user->address }}</td></tr>
                <tr><td><b>Phone:</b></td><td>{{ $user->phone }}</td></tr>
            </table>
        @else
            <p><em>No bank information assigned to this client.</em></p>
        @endif
    </div>
</body>
</html>';
    }
}
