<?php

/**
 * Page Builder Configuration
 * 
 * Configure variable categories and their variables that will populate
 * the variable dropdown in the page builder.
 * 
 * Each variable should have:
 * - path: Dot notation path (e.g., 'invoice.invoice_no')
 * - displayName: Human-readable name shown in dropdown
 * - example: Example value for preview
 * - type: Variable type (text, date, currency, array, etc.)
 * - description: Help text for the variable
 */
return [
    // Variable categories - each category appears as a group in the dropdown
    'variable_categories' => [
        'invoice' => [
            'label' => 'Invoice Variables',
            'variables' => [
                [
                    'path' => 'invoice.invoice_no',
                    'displayName' => 'Invoice Number',
                    'example' => 'INV-2024-001',
                    'type' => 'text',
                    'description' => 'The unique invoice number'
                ],
                [
                    'path' => 'invoice.invoice_date',
                    'displayName' => 'Invoice Date',
                    'example' => '2024-01-15',
                    'type' => 'date',
                    'description' => 'Date when invoice was created'
                ],
                [
                    'path' => 'invoice.due_date',
                    'displayName' => 'Due Date',
                    'example' => '2024-02-15',
                    'type' => 'date',
                    'description' => 'Date when payment is due'
                ],
                [
                    'path' => 'invoice.amount',
                    'displayName' => 'Invoice Amount',
                    'example' => '1500.00',
                    'type' => 'currency',
                    'description' => 'Base invoice amount'
                ],
                [
                    'path' => 'invoice.total',
                    'displayName' => 'Invoice Total',
                    'example' => '1500.00',
                    'type' => 'currency',
                    'description' => 'Total amount including all expenses'
                ],
                [
                    'path' => 'invoice.description',
                    'displayName' => 'Invoice Description',
                    'example' => 'Monthly Services',
                    'type' => 'text',
                    'description' => 'Description of services/products'
                ],
                [
                    'path' => 'invoice.other_expenses',
                    'displayName' => 'Other Expenses (Array)',
                    'example' => '[{label: "Fee", amount: 100}]',
                    'type' => 'array',
                    'description' => 'Array of additional expenses'
                ]
            ]
        ],
        'user' => [
            'label' => 'User/Company Information',
            'variables' => [
                [
                    'path' => 'user.name',
                    'displayName' => 'User Name',
                    'example' => 'John Doe',
                    'type' => 'text',
                    'description' => 'Name of the invoice sender'
                ],
                [
                    'path' => 'user.address',
                    'displayName' => 'User Address',
                    'example' => '123 Main St, City, State 12345',
                    'type' => 'text',
                    'description' => 'Address of the invoice sender'
                ],
                [
                    'path' => 'user.phone',
                    'displayName' => 'User Phone',
                    'example' => '+1 234-567-8900',
                    'type' => 'text',
                    'description' => 'Phone number of the invoice sender'
                ]
            ]
        ],
        'client' => [
            'label' => 'Client Information',
            'variables' => [
                [
                    'path' => 'client.name',
                    'displayName' => 'Client Name',
                    'example' => 'ABC Company',
                    'type' => 'text',
                    'description' => 'Name of the client being invoiced'
                ],
                [
                    'path' => 'client.address',
                    'displayName' => 'Client Address',
                    'example' => '456 Business Ave, City, State 67890',
                    'type' => 'text',
                    'description' => 'Address of the client'
                ],
                [
                    'path' => 'client.tax',
                    'displayName' => 'Client Tax ID',
                    'example' => 'TAX-123456',
                    'type' => 'text',
                    'description' => 'Tax identification number'
                ]
            ]
        ],
        'bankInfo' => [
            'label' => 'Bank Information',
            'variables' => [
                [
                    'path' => 'bankInfo.bank_country',
                    'displayName' => 'Bank Country',
                    'example' => 'United States',
                    'type' => 'text',
                    'description' => 'Country where bank is located'
                ],
                [
                    'path' => 'bankInfo.bank_name',
                    'displayName' => 'Bank Name',
                    'example' => 'Example Bank',
                    'type' => 'text',
                    'description' => 'Name of the bank'
                ],
                [
                    'path' => 'bankInfo.bank_swift',
                    'displayName' => 'SWIFT/BIC Code',
                    'example' => 'EXMPUS33',
                    'type' => 'text',
                    'description' => 'Bank SWIFT or BIC code'
                ],
                [
                    'path' => 'bankInfo.bank_account',
                    'displayName' => 'Account Number',
                    'example' => '1234567890',
                    'type' => 'text',
                    'description' => 'Bank account number'
                ]
            ]
        ]
    ],

    /**
     * Generate mock data for preview
     * Used when previewing templates with variables
     */
    'mock_data' => [
        'invoice' => [
            'invoice_no' => 'INV-2024-001',
            'invoice_date' => '2024-01-15',
            'due_date' => '2024-02-15',
            'amount' => 1500.00,
            'total' => 1625.00,
            'description' => 'Monthly Services January 2024',
            'other_expenses' => [
                ['label' => 'Setup Fee', 'amount' => 100.00],
                ['label' => 'Processing Fee', 'amount' => 25.00]
            ]
        ],
        'user' => [
            'name' => 'John Doe',
            'address' => '123 Main Street, New York, NY 10001',
            'phone' => '+1 234-567-8900'
        ],
        'client' => [
            'name' => 'ABC Company',
            'address' => '456 Business Avenue, Los Angeles, CA 90001',
            'tax' => 'TAX-123456789'
        ],
        'bankInfo' => [
            'bank_country' => 'United States',
            'bank_name' => 'Example Bank',
            'bank_swift' => 'EXMPUS33',
            'bank_account' => '1234567890'
        ]
    ]
];

