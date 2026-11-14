<?php
/**
 * PharmaCare Pro — Hostinger PHP 8.3 + PDO SQLite Backend API
 * Automatically persists all 18 pharmacy ERP tables into api/data/pharmacy.sqlite
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Id, X-User-Role, X-Store-Id');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DATA_CLEAN_VERSION = 'pharmacare_clean_v3';
const DEFAULT_STORE_ID = 'store-1';

$localDataDir = __DIR__ . '/data';
if (!is_dir($localDataDir)) {
    @mkdir($localDataDir, 0755, true);
}
if (!is_dir($localDataDir . '/backups')) {
    @mkdir($localDataDir . '/backups', 0755, true);
}

/**
 * Resolve a persistent storage directory outside `public_html` and `hbuilds`
 * so Hostinger automated deployments (`hbuilds`) never overwrite live store data.
 */
function resolvePersistentDataDir(string $localDataDir): string {
    $candidates = [];
    if (strpos(__DIR__, '/hbuilds/') !== false) {
        $domainRoot = explode('/hbuilds/', __DIR__)[0];
        if ($domainRoot !== '') {
            $candidates[] = $domainRoot . '/pharmacare_storage';
        }
    }
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $docRoot = rtrim((string)$_SERVER['DOCUMENT_ROOT'], '/');
        if (strpos($docRoot, '/hbuilds/') !== false) {
            $domainRoot = explode('/hbuilds/', $docRoot)[0];
            if ($domainRoot !== '') {
                $candidates[] = $domainRoot . '/pharmacare_storage';
            }
        } else {
            $docParent = dirname($docRoot);
            if ($docParent !== '' && $docParent !== '/') {
                $candidates[] = $docParent . '/pharmacare_storage';
            }
        }
    }
    $parent2 = dirname(__DIR__, 2);
    if ($parent2 !== '' && $parent2 !== '/' && basename($parent2) !== 'versions') {
        $candidates[] = $parent2 . '/pharmacare_storage';
    }

    foreach (array_unique($candidates) as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (is_dir($dir) && is_writable($dir)) {
            if (!is_dir($dir . '/backups')) {
                @mkdir($dir . '/backups', 0755, true);
            }
            if (!file_exists($dir . '/pharmacy.sqlite') && file_exists($localDataDir . '/pharmacy.sqlite')) {
                @copy($localDataDir . '/pharmacy.sqlite', $dir . '/pharmacy.sqlite');
            }
            if (!file_exists($dir . '/backups/auto_latest.json') && file_exists($localDataDir . '/backups/auto_latest.json')) {
                @copy($localDataDir . '/backups/auto_latest.json', $dir . '/backups/auto_latest.json');
            }
            return $dir;
        }
    }
    return $localDataDir;
}

$dataDir = resolvePersistentDataDir($localDataDir);
$backupsDir = $dataDir . '/backups';
$sqliteFile = $dataDir . '/pharmacy.sqlite';

function sendJson(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function hashPasswordStr(string $plain): string {
    return hash('sha256', trim($plain));
}

function defaultPermissions(bool $isAdmin = false, string $role = 'staff'): array {
    $isCash = $role === 'cashier';
    return [
        'canMakeSales' => true,
        'canViewInventory' => true,
        'canAddCustomer' => true,
        'canViewReports' => $isAdmin,
        'canAdjustStock' => $isAdmin || !$isCash,
        'canManagePurchases' => $isAdmin || !$isCash,
        'canModifyPrices' => $isAdmin || !$isCash,
    ];
}

function normalizeUserPermissions($rawPerms, string $role = 'staff'): array {
    $base = defaultPermissions($role === 'admin', $role);
    if (!is_array($rawPerms)) {
        return $base;
    }
    return [
        'canMakeSales' => array_key_exists('canMakeSales', $rawPerms) ? (bool)$rawPerms['canMakeSales'] : $base['canMakeSales'],
        'canViewInventory' => array_key_exists('canViewInventory', $rawPerms) ? (bool)$rawPerms['canViewInventory'] : $base['canViewInventory'],
        'canAddCustomer' => array_key_exists('canAddCustomer', $rawPerms) ? (bool)$rawPerms['canAddCustomer'] : $base['canAddCustomer'],
        'canViewReports' => array_key_exists('canViewReports', $rawPerms) ? (bool)$rawPerms['canViewReports'] : $base['canViewReports'],
        'canAdjustStock' => array_key_exists('canAdjustStock', $rawPerms) ? (bool)$rawPerms['canAdjustStock'] : $base['canAdjustStock'],
        'canManagePurchases' => array_key_exists('canManagePurchases', $rawPerms) ? (bool)$rawPerms['canManagePurchases'] : $base['canManagePurchases'],
        'canModifyPrices' => array_key_exists('canModifyPrices', $rawPerms) ? (bool)$rawPerms['canModifyPrices'] : $base['canModifyPrices'],
    ];
}

function acquireDbLock(string $sqliteFile, bool $exclusive = true): void {
    static $lockFp = null;
    if ($lockFp !== null) {
        @flock($lockFp, $exclusive ? LOCK_EX : LOCK_SH);
        return;
    }
    $fp = @fopen($sqliteFile . '.lock', 'c+');
    if ($fp) {
        @flock($fp, $exclusive ? LOCK_EX : LOCK_SH);
        $lockFp = $fp;
        register_shutdown_function(function () use (&$lockFp) {
            if ($lockFp) {
                @flock($lockFp, LOCK_UN);
                @fclose($lockFp);
                $lockFp = null;
            }
        });
    }
}

function acquireDbWriteLock(string $sqliteFile): void {
    acquireDbLock($sqliteFile, true);
}

function getOwnerTemplate(): array {
    return [
        'id' => 'usr-owner-1',
        'storeId' => DEFAULT_STORE_ID,
        'createdBy' => 'usr-owner-1',
        'username' => 'admin',
        'fullName' => 'Dr. Abdul Rehman (Owner)',
        'email' => 'admin@pharmacare.pk',
        'phone' => '',
        'role' => 'admin',
        'pin' => '1234',
        'password' => 'admin',
        'passwordHash' => hashPasswordStr('admin'),
        'designation' => 'Store Owner & Administrator',
        'status' => 'active',
        'joiningDate' => gmdate('Y-m-d'),
        'permissions' => defaultPermissions(true),
    ];
}

function getDefaultSettings(): array {
    return [
        'storeName' => 'PharmaCare Medical & General Store',
        'storeTagline' => 'Quality Medicines • Licensed Pharmacist on Duty • 24/7 Service',
        'storeLogoUrl' => '',
        'storeAddress' => 'Main Commercial Market',
        'city' => 'Pakistan',
        'phone' => '',
        'email' => 'admin@pharmacare.pk',
        'drugLicenseNumber' => 'DRAP-LIC-0001',
        'taxRegistrationNumber' => '',
        'currency' => 'PKR',
        'currencySymbol' => 'Rs.',
        'timezone' => 'Asia/Karachi',
        'taxRatePercentage' => 0,
        'lowStockThresholdDefault' => 20,
        'expiryAlertDays' => 90,
        'invoiceHeader' => 'COMPUTERIZED PHARMACY CASH MEMO',
        'invoiceFooter' => 'Medicines once sold will not be returned without cash memo within 7 days. Cold chain products & cut strips non-returnable.',
        'allowStaffDiscounts' => true,
        'maxStaffDiscountPercentage' => 10,
        'businessOpeningHours' => '08:00 AM',
        'businessClosingHours' => '12:00 AM (Midnight)',
    ];
}

function defaultCategories(): array {
    return [
        'Analgesics & Antipyretics',
        'Antibiotics',
        'Gastrointestinal',
        'Antihistamines & Respiratory',
        'Cardiovascular & Hypertension',
        'Antidiabetics',
        'Vitamins & Supplements',
        'Dermatological',
        'Surgical & First Aid',
    ];
}

function sanitizeStaffAccounts(?array $users): array {
    $legacyIds = ['usr-admin-1', 'usr-pharm-1', 'usr-staff-1', 'usr-staff-2'];
    $owner = getOwnerTemplate();
    if (!is_array($users) || count($users) === 0) {
        return [$owner];
    }

    $byUsername = [];
    $foundOwner = null;

    foreach ($users as $u) {
        if (!is_array($u) || empty($u['id'])) continue;
        $id = (string)$u['id'];
        if ($id === 'usr-owner-1') {
            $foundOwner = $u;
            continue;
        }
        if (in_array($id, $legacyIds, true)) continue;

        $uname = ltrim(strtolower(trim((string)($u['username'] ?? $id))), '@');
        if ($uname === '' || $uname === 'admin') continue;

        $pass = (string)($u['password'] ?? 'seller123');
        $uRole = (string)($u['role'] ?? 'staff');
        $byUsername[$uname] = array_merge($u, [
            'id' => $id,
            'storeId' => $u['storeId'] ?? DEFAULT_STORE_ID,
            'createdBy' => $u['createdBy'] ?? 'usr-owner-1',
            'username' => $uname,
            'fullName' => (string)($u['fullName'] ?? ($u['name'] ?? $uname)),
            'email' => (string)($u['email'] ?? ($uname . '@pharmacare.pk')),
            'phone' => (string)($u['phone'] ?? ''),
            'role' => $uRole,
            'designation' => (string)($u['designation'] ?? 'Staff Dispenser'),
            'status' => ($u['status'] ?? 'active') === 'inactive' ? 'inactive' : 'active',
            'pin' => (string)($u['pin'] ?? '5678'),
            'password' => $pass,
            'passwordHash' => !empty($u['passwordHash']) ? (string)$u['passwordHash'] : hashPasswordStr($pass),
            'permissions' => normalizeUserPermissions($u['permissions'] ?? null, $uRole),
        ]);
    }

    if ($foundOwner) {
        $ownerPass = ($foundOwner['password'] ?? 'admin') === 'password123' ? 'admin' : (string)($foundOwner['password'] ?? 'admin');
        $owner = array_merge($owner, $foundOwner, [
            'id' => 'usr-owner-1',
            'username' => 'admin',
            'password' => $ownerPass,
            'passwordHash' => hashPasswordStr($ownerPass),
            'role' => 'admin',
            'status' => 'active',
            'permissions' => defaultPermissions(true),
        ]);
    }

    return array_merge([$owner], array_values($byUsername));
}

function getInitialDatabase(): array {
    $now = gmdate('c');
    $owner = getOwnerTemplate();
    $settings = getDefaultSettings();
    $cats = [];
    foreach (defaultCategories() as $idx => $name) {
        $cats[] = [
            'id' => 'cat-' . ($idx + 1),
            'storeId' => DEFAULT_STORE_ID,
            'name' => $name,
            'createdBy' => 'usr-owner-1',
            'createdAt' => $now,
        ];
    }

    return [
        'cleanVersion' => DATA_CLEAN_VERSION,
        'stores' => [[
            'id' => DEFAULT_STORE_ID,
            'name' => $settings['storeName'],
            'ownerId' => 'usr-owner-1',
            'drugLicenseNumber' => $settings['drugLicenseNumber'],
            'taxRegistrationNumber' => $settings['taxRegistrationNumber'],
            'address' => $settings['storeAddress'],
            'city' => $settings['city'],
            'phone' => $settings['phone'],
            'email' => $settings['email'],
            'createdAt' => $now,
        ]],
        'users' => [$owner],
        'staffMembers' => [$owner],
        'medicines' => [],
        'categories' => $cats,
        'suppliers' => [],
        'customers' => [],
        'purchases' => [],
        'purchaseItems' => [],
        'sales' => [],
        'saleItems' => [],
        'saleReturns' => [],
        'stockTransactions' => [],
        'adjustments' => [],
        'expenses' => [],
        'payments' => [],
        'cashMemos' => [],
        'auditLogs' => [],
        'notifications' => [],
        'settings' => $settings,
        'staffPermissions' => [[
            'id' => 'perm-usr-owner-1',
            'storeId' => DEFAULT_STORE_ID,
            'userId' => 'usr-owner-1',
            'username' => 'admin',
            'role' => 'admin',
        ] + $owner['permissions']],
        'deletedIds' => [],
        'lastUpdated' => $now,
    ];
}

function isTestOrDummyRecordId(string $id): bool {
    if ($id === '') return true;
    $legacy = [
        'med-1', 'med-2', 'med-3', 'med-4', 'med-5',
        'sup-1', 'sup-2', 'sup-3', 'cust-1', 'cust-2',
        'sal-1001', 'sal-1002', 'pur-501', 'exp-1', 'sal-test-dup',
    ];
    if (in_array($id, $legacy, true)) return true;
    if (strpos($id, '-e2e-') !== false || strpos($id, '-test-') !== false || strpos($id, 'e2estaff') !== false) {
        return true;
    }
    return false;
}

function sanitizeDatabaseState(array $data): array {
    if (!in_array(($data['cleanVersion'] ?? ''), [DATA_CLEAN_VERSION, 'pharmacare_clean_v3', 'pharmacare_clean_v4'], true)) {
        $clean = getInitialDatabase();
        $staff = sanitizeStaffAccounts($data['staffMembers'] ?? null);
        $clean['staffMembers'] = $staff;
        $clean['users'] = $staff;
        return $clean;
    }

    $now = gmdate('c');
    $deletedList = is_array($data['deletedIds'] ?? null) ? array_values(array_unique(array_map('strval', $data['deletedIds']))) : [];
    $deletedSet = array_flip($deletedList);

    $cleanMedicines = [];
    foreach (($data['medicines'] ?? []) as $m) {
        if (!is_array($m) || empty($m['id'])) continue;
        $mid = (string)$m['id'];
        if (isset($deletedSet[$mid]) || isTestOrDummyRecordId($mid)) continue;
        $batches = is_array($m['batches'] ?? null) ? $m['batches'] : [];
        $totalQty = 0;
        foreach ($batches as $b) {
            if (is_array($b)) $totalQty += (float)($b['quantity'] ?? 0);
        }
        $cleanMedicines[] = array_merge($m, [
            'storeId' => $m['storeId'] ?? DEFAULT_STORE_ID,
            'createdBy' => $m['createdBy'] ?? 'usr-owner-1',
            'batches' => $batches,
            'totalQuantity' => count($batches) > 0 ? $totalQty : (float)($m['totalQuantity'] ?? 0),
        ]);
    }

    $cleanStaff = array_values(array_filter(
        sanitizeStaffAccounts($data['staffMembers'] ?? null),
        fn($u) => !isset($deletedSet[(string)$u['id']]) && !isTestOrDummyRecordId((string)$u['id']) && strpos((string)($u['username'] ?? ''), 'e2e') === false
    ));

    $filterByDeleted = function ($arr, string $defaultCreator = 'usr-owner-1') use ($deletedSet): array {
        if (!is_array($arr)) return [];
        $out = [];
        foreach ($arr as $row) {
            if (!is_array($row) || empty($row['id'])) continue;
            $rid = (string)$row['id'];
            if (isset($deletedSet[$rid]) || isTestOrDummyRecordId($rid)) continue;
            $out[] = array_merge($row, [
                'storeId' => $row['storeId'] ?? DEFAULT_STORE_ID,
                'createdBy' => $row['createdBy'] ?? $defaultCreator,
            ]);
        }
        return $out;
    };

    $cleanSuppliers = $filterByDeleted($data['suppliers'] ?? []);
    $cleanCustomers = $filterByDeleted($data['customers'] ?? []);
    $cleanSales = $filterByDeleted($data['sales'] ?? []);
    $cleanPurchases = $filterByDeleted($data['purchases'] ?? []);
    $cleanExpenses = $filterByDeleted($data['expenses'] ?? []);
    $cleanAdjustments = array_values(array_filter(
        is_array($data['adjustments'] ?? null) ? $data['adjustments'] : [],
        fn($a) => is_array($a) && !empty($a['id']) && !isTestOrDummyRecordId((string)$a['id'])
    ));

    $catNames = [];
    foreach (defaultCategories() as $c) $catNames[$c] = true;
    foreach ($cleanMedicines as $m) {
        if (!empty($m['category'])) $catNames[(string)$m['category']] = true;
    }
    $categories = [];
    $idx = 1;
    foreach (array_keys($catNames) as $cName) {
        $categories[] = [
            'id' => 'cat-' . $idx++,
            'storeId' => DEFAULT_STORE_ID,
            'name' => $cName,
            'createdBy' => 'usr-owner-1',
            'createdAt' => $now,
        ];
    }

    $saleItems = [];
    $cashMemos = [];
    foreach ($cleanSales as $sale) {
        $items = is_array($sale['items'] ?? null) ? $sale['items'] : [];
        foreach ($items as $sIdx => $item) {
            if (!is_array($item)) continue;
            $saleItems[] = array_merge($item, [
                'id' => $item['id'] ?? ($sale['id'] . '-item-' . ($sIdx + 1)),
                'saleId' => $sale['id'],
                'storeId' => DEFAULT_STORE_ID,
            ]);
        }
        $cashMemos[] = [
            'id' => 'memo-' . $sale['id'],
            'storeId' => DEFAULT_STORE_ID,
            'saleId' => $sale['id'],
            'invoiceNumber' => $sale['invoiceNumber'] ?? $sale['id'],
            'date' => $sale['date'] ?? gmdate('Y-m-d'),
            'time' => $sale['time'] ?? '12:00:00',
            'createdBy' => $sale['staffId'] ?? 'usr-owner-1',
            'createdByName' => $sale['staffName'] ?? 'Store Dispenser',
            'customerId' => $sale['customerId'] ?? null,
            'customerName' => $sale['customerName'] ?? 'Walk-in Customer',
            'customerPhone' => $sale['customerPhone'] ?? null,
            'subtotal' => (float)($sale['subtotal'] ?? 0),
            'discountTotal' => (float)($sale['discountTotal'] ?? 0),
            'taxTotal' => (float)($sale['taxTotal'] ?? 0),
            'grandTotal' => (float)($sale['grandTotal'] ?? 0),
            'amountPaid' => (float)($sale['amountPaid'] ?? ($sale['grandTotal'] ?? 0)),
            'changeGiven' => (float)($sale['changeGiven'] ?? 0),
            'paymentMethod' => $sale['paymentMethod'] ?? 'Cash',
            'itemsCount' => count($items),
            'status' => $sale['status'] ?? 'completed',
        ];
    }

    $purchaseItems = [];
    foreach ($cleanPurchases as $po) {
        $items = is_array($po['items'] ?? null) ? $po['items'] : [];
        foreach ($items as $pIdx => $item) {
            if (!is_array($item)) continue;
            $purchaseItems[] = array_merge($item, [
                'id' => $item['id'] ?? ($po['id'] . '-pitem-' . ($pIdx + 1)),
                'purchaseId' => $po['id'],
                'storeId' => DEFAULT_STORE_ID,
            ]);
        }
    }

    $settings = array_merge(getDefaultSettings(), is_array($data['settings'] ?? null) ? $data['settings'] : []);
    $stores = [[
        'id' => DEFAULT_STORE_ID,
        'name' => $settings['storeName'],
        'ownerId' => 'usr-owner-1',
        'drugLicenseNumber' => $settings['drugLicenseNumber'],
        'taxRegistrationNumber' => $settings['taxRegistrationNumber'],
        'address' => $settings['storeAddress'],
        'city' => $settings['city'],
        'phone' => $settings['phone'],
        'email' => $settings['email'],
        'createdAt' => $data['stores'][0]['createdAt'] ?? $now,
    ]];

    $staffPermissions = [];
    foreach ($cleanStaff as $u) {
        $staffPermissions[] = array_merge([
            'id' => 'perm-' . $u['id'],
            'storeId' => DEFAULT_STORE_ID,
            'userId' => $u['id'],
            'username' => $u['username'],
            'role' => $u['role'],
        ], is_array($u['permissions'] ?? null) ? $u['permissions'] : []);
    }

    return array_merge($data, [
        'cleanVersion' => DATA_CLEAN_VERSION,
        'stores' => $stores,
        'users' => $cleanStaff,
        'staffMembers' => $cleanStaff,
        'medicines' => $cleanMedicines,
        'categories' => $categories,
        'suppliers' => $cleanSuppliers,
        'customers' => $cleanCustomers,
        'purchases' => $cleanPurchases,
        'purchaseItems' => $purchaseItems,
        'sales' => $cleanSales,
        'saleItems' => $saleItems,
        'saleReturns' => is_array($data['saleReturns'] ?? null) ? $data['saleReturns'] : [],
        'stockTransactions' => is_array($data['stockTransactions'] ?? null) ? $data['stockTransactions'] : [],
        'adjustments' => $cleanAdjustments,
        'expenses' => $cleanExpenses,
        'payments' => is_array($data['payments'] ?? null) ? $data['payments'] : [],
        'cashMemos' => $cashMemos,
        'auditLogs' => is_array($data['auditLogs'] ?? null) ? $data['auditLogs'] : [],
        'notifications' => is_array($data['notifications'] ?? null) ? $data['notifications'] : [],
        'settings' => $settings,
        'staffPermissions' => $staffPermissions,
        'deletedIds' => $deletedList,
        'lastUpdated' => $data['lastUpdated'] ?? $now,
    ]);
}

function getDatabaseConnection(string $sqliteFile): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $pdo = new PDO('sqlite:' . $sqliteFile, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 8000;');
    $pdo->exec('PRAGMA journal_mode = DELETE;');
    $pdo->exec('PRAGMA synchronous = FULL;');
    $pdo->exec('PRAGMA foreign_keys = ON;');

    // Initialize all 18 relational SQL tables + store snapshot table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS stores (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            drug_license_number TEXT,
            tax_registration_number TEXT,
            address TEXT,
            city TEXT,
            phone TEXT,
            email TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            created_by TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS staff_members (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            full_name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT,
            password_hash TEXT,
            pin TEXT,
            role TEXT NOT NULL,
            designation TEXT,
            phone TEXT,
            email TEXT,
            status TEXT NOT NULL,
            joining_date TEXT,
            last_login TEXT,
            permissions_json TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS staff_permissions (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT,
            role TEXT,
            permissions_json TEXT
        );
        CREATE TABLE IF NOT EXISTS medicine_categories (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS medicines (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            code TEXT,
            name TEXT NOT NULL,
            generic_name TEXT,
            brand_name TEXT,
            category TEXT,
            manufacturer TEXT,
            medicine_type TEXT,
            strength TEXT,
            packing_size TEXT,
            barcode TEXT,
            min_stock_level INTEGER DEFAULT 15,
            storage_location TEXT,
            fixed_sale_price REAL DEFAULT 0,
            fixed_purchase_price REAL DEFAULT 0,
            batches_json TEXT,
            total_quantity REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            company_name TEXT NOT NULL,
            contact_person TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            total_purchases REAL DEFAULT 0,
            total_paid REAL DEFAULT 0,
            outstanding_balance REAL DEFAULT 0,
            created_by TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            total_purchases REAL DEFAULT 0,
            outstanding_balance REAL DEFAULT 0,
            created_by TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS purchases (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            purchase_number TEXT,
            supplier_id TEXT,
            supplier_name TEXT,
            invoice_number TEXT,
            purchase_date TEXT,
            total_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            balance_amount REAL DEFAULT 0,
            payment_status TEXT,
            items_json TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS purchase_items (
            id TEXT PRIMARY KEY,
            purchase_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            medicine_id TEXT,
            medicine_name TEXT,
            batch_number TEXT,
            quantity REAL DEFAULT 0,
            purchase_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            total_cost REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            invoice_number TEXT,
            date TEXT,
            time TEXT,
            staff_id TEXT,
            staff_name TEXT,
            customer_id TEXT,
            customer_name TEXT,
            subtotal REAL DEFAULT 0,
            discount_total REAL DEFAULT 0,
            tax_total REAL DEFAULT 0,
            grand_total REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT DEFAULT 'completed',
            items_json TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS sale_items (
            id TEXT PRIMARY KEY,
            sale_id TEXT NOT NULL,
            store_id TEXT NOT NULL,
            medicine_id TEXT,
            medicine_name TEXT,
            batch_id TEXT,
            batch_number TEXT,
            quantity REAL DEFAULT 0,
            unit_price REAL DEFAULT 0,
            purchase_cost REAL DEFAULT 0,
            total_amount REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS stock_transactions (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            medicine_id TEXT,
            batch_id TEXT,
            type TEXT,
            quantity_change REAL DEFAULT 0,
            reference_id TEXT,
            created_by TEXT,
            timestamp TEXT
        );
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            category TEXT,
            description TEXT,
            amount REAL DEFAULT 0,
            date TEXT,
            payment_method TEXT,
            added_by TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            party_type TEXT,
            party_id TEXT,
            reference_id TEXT,
            amount REAL DEFAULT 0,
            payment_method TEXT,
            date TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS cash_memos (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            sale_id TEXT,
            invoice_number TEXT,
            date TEXT,
            customer_name TEXT,
            grand_total REAL DEFAULT 0,
            payment_method TEXT,
            status TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            action TEXT,
            description TEXT,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            timestamp TEXT
        );
        CREATE TABLE IF NOT EXISTS store_settings (
            id TEXT PRIMARY KEY,
            store_id TEXT NOT NULL,
            store_name TEXT,
            state_snapshot TEXT,
            updated_at TEXT
        );
    ");

    return $pdo;
}

function syncNormalizedTables(PDO $pdo, array $clean): void {
    $now = gmdate('c');

    $snapJson = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if (!is_string($snapJson) || $snapJson === '') {
        throw new RuntimeException('Failed to encode state snapshot safely');
    }

    // Sync state_snapshot in store_settings (atomic single source of truth + relational mirrors)
    $stmtSettings = $pdo->prepare('INSERT OR REPLACE INTO store_settings (id, store_id, store_name, state_snapshot, updated_at) VALUES (?, ?, ?, ?, ?)');
    $stmtSettings->execute([
        'settings-1',
        DEFAULT_STORE_ID,
        (string)($clean['settings']['storeName'] ?? 'PharmaCare'),
        $snapJson,
        $now,
    ]);

    // Stores
    $pdo->exec('DELETE FROM stores');
    $stmtStore = $pdo->prepare('INSERT OR REPLACE INTO stores (id, name, owner_id, drug_license_number, tax_registration_number, address, city, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['stores'] ?? []) as $st) {
        $stmtStore->execute([
            (string)$st['id'], (string)$st['name'], (string)$st['ownerId'],
            (string)($st['drugLicenseNumber'] ?? ''), (string)($st['taxRegistrationNumber'] ?? ''),
            (string)($st['address'] ?? ''), (string)($st['city'] ?? ''),
            (string)($st['phone'] ?? ''), (string)($st['email'] ?? ''), (string)($st['createdAt'] ?? $now),
        ]);
    }

    // Users, Staff Members, Staff Permissions
    $pdo->exec('DELETE FROM users');
    $pdo->exec('DELETE FROM staff_members');
    $pdo->exec('DELETE FROM staff_permissions');
    $stmtUser = $pdo->prepare('INSERT OR REPLACE INTO users (id, store_id, username, full_name, role, status, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtStaff = $pdo->prepare('INSERT OR REPLACE INTO staff_members (id, store_id, full_name, username, password, password_hash, pin, role, designation, phone, email, status, joining_date, last_login, permissions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtPerm = $pdo->prepare('INSERT OR REPLACE INTO staff_permissions (id, store_id, user_id, username, role, permissions_json) VALUES (?, ?, ?, ?, ?, ?)');

    foreach (($clean['staffMembers'] ?? []) as $u) {
        $permJson = json_encode($u['permissions'] ?? []);
        $stmtUser->execute([
            (string)$u['id'], DEFAULT_STORE_ID, (string)$u['username'], (string)$u['fullName'],
            (string)$u['role'], (string)$u['status'], (string)($u['createdBy'] ?? 'usr-owner-1'), $now,
        ]);
        $stmtStaff->execute([
            (string)$u['id'], DEFAULT_STORE_ID, (string)$u['fullName'], (string)$u['username'],
            (string)($u['password'] ?? ''), (string)($u['passwordHash'] ?? ''), (string)($u['pin'] ?? '5678'),
            (string)$u['role'], (string)($u['designation'] ?? ''), (string)($u['phone'] ?? ''),
            (string)($u['email'] ?? ''), (string)$u['status'], (string)($u['joiningDate'] ?? ''),
            (string)($u['lastLogin'] ?? ''), $permJson, (string)($u['createdBy'] ?? 'usr-owner-1'),
        ]);
        $stmtPerm->execute([
            'perm-' . $u['id'], DEFAULT_STORE_ID, (string)$u['id'], (string)$u['username'], (string)$u['role'], $permJson,
        ]);
    }

    // Categories
    $pdo->exec('DELETE FROM medicine_categories');
    $stmtCat = $pdo->prepare('INSERT OR REPLACE INTO medicine_categories (id, store_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)');
    foreach (($clean['categories'] ?? []) as $cat) {
        $stmtCat->execute([(string)$cat['id'], DEFAULT_STORE_ID, (string)$cat['name'], 'usr-owner-1', $now]);
    }

    // Medicines
    $pdo->exec('DELETE FROM medicines');
    $stmtMed = $pdo->prepare('INSERT OR REPLACE INTO medicines (id, store_id, code, name, generic_name, brand_name, category, manufacturer, medicine_type, strength, packing_size, barcode, min_stock_level, storage_location, fixed_sale_price, fixed_purchase_price, batches_json, total_quantity, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['medicines'] ?? []) as $m) {
        $stmtMed->execute([
            (string)$m['id'], DEFAULT_STORE_ID, (string)($m['code'] ?? ''), (string)$m['name'],
            (string)($m['genericName'] ?? ''), (string)($m['brandName'] ?? ''), (string)($m['category'] ?? 'General'),
            (string)($m['manufacturer'] ?? ''), (string)($m['medicineType'] ?? 'Tablet'), (string)($m['strength'] ?? ''),
            (string)($m['packingSize'] ?? ''), (string)($m['barcode'] ?? ''), (int)($m['minStockLevel'] ?? 15),
            (string)($m['storageLocation'] ?? ''), (float)($m['fixedSalePrice'] ?? 0), (float)($m['fixedPurchasePrice'] ?? 0),
            json_encode($m['batches'] ?? []), (float)($m['totalQuantity'] ?? 0), (string)($m['status'] ?? 'active'),
            (string)($m['createdBy'] ?? 'usr-owner-1'),
        ]);
    }

    // Suppliers
    $pdo->exec('DELETE FROM suppliers');
    $stmtSup = $pdo->prepare('INSERT OR REPLACE INTO suppliers (id, store_id, company_name, contact_person, phone, email, address, total_purchases, total_paid, outstanding_balance, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['suppliers'] ?? []) as $s) {
        $stmtSup->execute([
            (string)$s['id'], DEFAULT_STORE_ID, (string)($s['companyName'] ?? ''), (string)($s['contactPerson'] ?? ''),
            (string)($s['phone'] ?? ''), (string)($s['email'] ?? ''), (string)($s['address'] ?? ''),
            (float)($s['totalPurchases'] ?? 0), (float)($s['totalPaid'] ?? 0), (float)($s['outstandingBalance'] ?? 0),
            (string)($s['createdBy'] ?? 'usr-owner-1'), (string)($s['createdAt'] ?? $now),
        ]);
    }

    // Customers
    $pdo->exec('DELETE FROM customers');
    $stmtCust = $pdo->prepare('INSERT OR REPLACE INTO customers (id, store_id, name, phone, address, total_purchases, outstanding_balance, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['customers'] ?? []) as $c) {
        $stmtCust->execute([
            (string)$c['id'], DEFAULT_STORE_ID, (string)($c['name'] ?? ''), (string)($c['phone'] ?? ''),
            (string)($c['address'] ?? ''), (float)($c['totalPurchases'] ?? 0), (float)($c['outstandingBalance'] ?? 0),
            (string)($c['createdBy'] ?? 'usr-owner-1'), (string)($c['createdAt'] ?? $now),
        ]);
    }

    // Purchases & Purchase Items
    $pdo->exec('DELETE FROM purchases');
    $pdo->exec('DELETE FROM purchase_items');
    $stmtPur = $pdo->prepare('INSERT OR REPLACE INTO purchases (id, store_id, purchase_number, supplier_id, supplier_name, invoice_number, purchase_date, total_amount, paid_amount, balance_amount, payment_status, items_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtPItem = $pdo->prepare('INSERT OR REPLACE INTO purchase_items (id, purchase_id, store_id, medicine_id, medicine_name, batch_number, quantity, purchase_price, sale_price, total_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['purchases'] ?? []) as $p) {
        $stmtPur->execute([
            (string)$p['id'], DEFAULT_STORE_ID, (string)($p['purchaseNumber'] ?? ''), (string)($p['supplierId'] ?? ''),
            (string)($p['supplierName'] ?? ''), (string)($p['invoiceNumber'] ?? ''), (string)($p['purchaseDate'] ?? ''),
            (float)($p['totalAmount'] ?? 0), (float)($p['paidAmount'] ?? 0), (float)($p['balanceAmount'] ?? 0),
            (string)($p['paymentStatus'] ?? 'Paid'), json_encode($p['items'] ?? []), (string)($p['createdBy'] ?? 'usr-owner-1'),
        ]);
    }
    foreach (($clean['purchaseItems'] ?? []) as $pi) {
        $stmtPItem->execute([
            (string)$pi['id'], (string)$pi['purchaseId'], DEFAULT_STORE_ID, (string)($pi['medicineId'] ?? ''),
            (string)($pi['medicineName'] ?? ''), (string)($pi['batchNumber'] ?? ''), (float)($pi['quantity'] ?? 0),
            (float)($pi['purchasePrice'] ?? 0), (float)($pi['salePrice'] ?? 0), (float)($pi['totalCost'] ?? 0),
        ]);
    }

    // Sales, Sale Items, Cash Memos
    $pdo->exec('DELETE FROM sales');
    $pdo->exec('DELETE FROM sale_items');
    $pdo->exec('DELETE FROM cash_memos');
    $stmtSale = $pdo->prepare('INSERT OR REPLACE INTO sales (id, store_id, invoice_number, date, time, staff_id, staff_name, customer_id, customer_name, subtotal, discount_total, tax_total, grand_total, amount_paid, payment_method, status, items_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtSItem = $pdo->prepare('INSERT OR REPLACE INTO sale_items (id, sale_id, store_id, medicine_id, medicine_name, batch_id, batch_number, quantity, unit_price, purchase_cost, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmtMemo = $pdo->prepare('INSERT OR REPLACE INTO cash_memos (id, store_id, sale_id, invoice_number, date, customer_name, grand_total, payment_method, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['sales'] ?? []) as $s) {
        $stmtSale->execute([
            (string)$s['id'], DEFAULT_STORE_ID, (string)($s['invoiceNumber'] ?? ''), (string)($s['date'] ?? ''),
            (string)($s['time'] ?? ''), (string)($s['staffId'] ?? ''), (string)($s['staffName'] ?? ''),
            (string)($s['customerId'] ?? ''), (string)($s['customerName'] ?? ''), (float)($s['subtotal'] ?? 0),
            (float)($s['discountTotal'] ?? 0), (float)($s['taxTotal'] ?? 0), (float)($s['grandTotal'] ?? 0),
            (float)($s['amountPaid'] ?? 0), (string)($s['paymentMethod'] ?? 'Cash'), (string)($s['status'] ?? 'completed'),
            json_encode($s['items'] ?? []), (string)($s['createdBy'] ?? 'usr-owner-1'),
        ]);
    }
    foreach (($clean['saleItems'] ?? []) as $si) {
        $stmtSItem->execute([
            (string)$si['id'], (string)$si['saleId'], DEFAULT_STORE_ID, (string)($si['medicineId'] ?? ''),
            (string)($si['medicineName'] ?? ''), (string)($si['batchId'] ?? ''), (string)($si['batchNumber'] ?? ''),
            (float)($si['quantity'] ?? 0), (float)($si['unitPrice'] ?? 0), (float)($si['purchaseCost'] ?? 0),
            (float)($si['totalAmount'] ?? 0),
        ]);
    }
    foreach (($clean['cashMemos'] ?? []) as $cm) {
        $stmtMemo->execute([
            (string)$cm['id'], DEFAULT_STORE_ID, (string)($cm['saleId'] ?? ''), (string)($cm['invoiceNumber'] ?? ''),
            (string)($cm['date'] ?? ''), (string)($cm['customerName'] ?? ''), (float)($cm['grandTotal'] ?? 0),
            (string)($cm['paymentMethod'] ?? 'Cash'), (string)($cm['status'] ?? 'completed'), (string)($cm['createdBy'] ?? 'usr-owner-1'),
        ]);
    }

    // Expenses
    $pdo->exec('DELETE FROM expenses');
    $stmtExp = $pdo->prepare('INSERT OR REPLACE INTO expenses (id, store_id, category, description, amount, date, payment_method, added_by, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (($clean['expenses'] ?? []) as $e) {
        $stmtExp->execute([
            (string)$e['id'], DEFAULT_STORE_ID, (string)($e['category'] ?? ''), (string)($e['description'] ?? ''),
            (float)($e['amount'] ?? 0), (string)($e['date'] ?? ''), (string)($e['paymentMethod'] ?? 'Cash'),
            (string)($e['addedBy'] ?? 'usr-owner-1'), (string)($e['createdBy'] ?? 'usr-owner-1'),
        ]);
    }

    // Stock Transactions
    $pdo->exec('DELETE FROM stock_transactions');
    $stmtStx = $pdo->prepare('INSERT OR REPLACE INTO stock_transactions (id, store_id, medicine_id, batch_id, type, quantity_change, reference_id, created_by, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (array_slice($clean['stockTransactions'] ?? [], 0, 500) as $stx) {
        if (!is_array($stx) || empty($stx['id'])) continue;
        $stmtStx->execute([
            (string)$stx['id'], DEFAULT_STORE_ID, (string)($stx['medicineId'] ?? ''), (string)($stx['batchId'] ?? ''),
            (string)($stx['type'] ?? 'adjustment'), (float)($stx['quantityChange'] ?? 0), (string)($stx['referenceId'] ?? ''),
            (string)($stx['createdBy'] ?? 'usr-owner-1'), (string)($stx['timestamp'] ?? $now),
        ]);
    }

    // Payments
    $pdo->exec('DELETE FROM payments');
    $stmtPay = $pdo->prepare('INSERT OR REPLACE INTO payments (id, store_id, party_type, party_id, reference_id, amount, payment_method, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach (array_slice($clean['payments'] ?? [], 0, 500) as $pay) {
        if (!is_array($pay) || empty($pay['id'])) continue;
        $stmtPay->execute([
            (string)$pay['id'], DEFAULT_STORE_ID, (string)($pay['partyType'] ?? ''), (string)($pay['partyId'] ?? ''),
            (string)($pay['referenceId'] ?? ''), (float)($pay['amount'] ?? 0), (string)($pay['paymentMethod'] ?? 'Cash'),
            (string)($pay['date'] ?? ''), (string)($pay['createdBy'] ?? 'usr-owner-1'),
        ]);
    }

    // Audit Logs
    $pdo->exec('DELETE FROM audit_logs');
    $stmtLog = $pdo->prepare('INSERT OR REPLACE INTO audit_logs (id, action, description, user_id, user_name, user_role, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach (array_slice($clean['auditLogs'] ?? [], 0, 300) as $log) {
        if (!is_array($log) || empty($log['id'])) continue;
        $stmtLog->execute([
            (string)$log['id'], (string)($log['action'] ?? 'ACTIVITY'), (string)($log['description'] ?? ''),
            (string)($log['userId'] ?? 'system'), (string)($log['userName'] ?? 'System'),
            (string)($log['userRole'] ?? 'admin'), (string)($log['timestamp'] ?? $now),
        ]);
    }
}

function reconstructFromRelationalTables(PDO $pdo): ?array {
    $staffRows = $pdo->query('SELECT * FROM staff_members')->fetchAll() ?: [];
    $medRows = $pdo->query('SELECT * FROM medicines')->fetchAll() ?: [];
    $salesRows = $pdo->query('SELECT * FROM sales')->fetchAll() ?: [];
    $supRows = $pdo->query('SELECT * FROM suppliers')->fetchAll() ?: [];
    $custRows = $pdo->query('SELECT * FROM customers')->fetchAll() ?: [];
    $purRows = $pdo->query('SELECT * FROM purchases')->fetchAll() ?: [];
    $expRows = $pdo->query('SELECT * FROM expenses')->fetchAll() ?: [];

    if (
        count($staffRows) <= 1 &&
        count($medRows) === 0 &&
        count($salesRows) === 0 &&
        count($supRows) === 0 &&
        count($custRows) === 0 &&
        count($purRows) === 0 &&
        count($expRows) === 0
    ) {
        return null;
    }

    $base = getInitialDatabase();
    if (count($staffRows) > 0) {
        $base['staffMembers'] = array_map(function ($r) {
            return [
                'id' => $r['id'],
                'storeId' => $r['store_id'] ?? DEFAULT_STORE_ID,
                'fullName' => $r['full_name'] ?? '',
                'username' => $r['username'] ?? '',
                'password' => $r['password'] ?? '',
                'passwordHash' => $r['password_hash'] ?? '',
                'pin' => $r['pin'] ?? '5678',
                'role' => $r['role'] ?? 'staff',
                'designation' => $r['designation'] ?? 'Staff Dispenser',
                'phone' => $r['phone'] ?? '',
                'email' => $r['email'] ?? '',
                'status' => $r['status'] ?? 'active',
                'joiningDate' => $r['joining_date'] ?? '',
                'lastLogin' => $r['last_login'] ?? '',
                'permissions' => json_decode((string)($r['permissions_json'] ?? '{}'), true) ?: [],
                'createdBy' => $r['created_by'] ?? 'usr-owner-1',
            ];
        }, $staffRows);
    }

    $base['medicines'] = array_map(function ($m) {
        $batches = json_decode((string)($m['batches_json'] ?? '[]'), true) ?: [];
        return [
            'id' => $m['id'],
            'storeId' => $m['store_id'] ?? DEFAULT_STORE_ID,
            'code' => $m['code'] ?? '',
            'name' => $m['name'] ?? '',
            'genericName' => $m['generic_name'] ?? '',
            'brandName' => $m['brand_name'] ?? '',
            'category' => $m['category'] ?? 'General',
            'manufacturer' => $m['manufacturer'] ?? '',
            'medicineType' => $m['medicine_type'] ?? 'Tablet',
            'strength' => $m['strength'] ?? '',
            'packingSize' => $m['packing_size'] ?? '',
            'barcode' => $m['barcode'] ?? '',
            'minStockLevel' => (int)($m['min_stock_level'] ?? 15),
            'storageLocation' => $m['storage_location'] ?? '',
            'fixedSalePrice' => (float)($m['fixed_sale_price'] ?? 0),
            'fixedPurchasePrice' => (float)($m['fixed_purchase_price'] ?? 0),
            'batches' => $batches,
            'totalQuantity' => (float)($m['total_quantity'] ?? 0),
            'status' => $m['status'] ?? 'active',
            'createdBy' => $m['created_by'] ?? 'usr-owner-1',
        ];
    }, $medRows);

    $base['suppliers'] = array_map(fn($s) => [
        'id' => $s['id'],
        'storeId' => $s['store_id'] ?? DEFAULT_STORE_ID,
        'companyName' => $s['company_name'] ?? '',
        'contactPerson' => $s['contact_person'] ?? '',
        'phone' => $s['phone'] ?? '',
        'email' => $s['email'] ?? '',
        'address' => $s['address'] ?? '',
        'totalPurchases' => (float)($s['total_purchases'] ?? 0),
        'totalPaid' => (float)($s['total_paid'] ?? 0),
        'outstandingBalance' => (float)($s['outstanding_balance'] ?? 0),
        'createdBy' => $s['created_by'] ?? 'usr-owner-1',
        'createdAt' => $s['created_at'] ?? '',
    ], $supRows);

    $base['customers'] = array_map(fn($c) => [
        'id' => $c['id'],
        'storeId' => $c['store_id'] ?? DEFAULT_STORE_ID,
        'name' => $c['name'] ?? '',
        'phone' => $c['phone'] ?? '',
        'address' => $c['address'] ?? '',
        'totalPurchases' => (float)($c['total_purchases'] ?? 0),
        'outstandingBalance' => (float)($c['outstanding_balance'] ?? 0),
        'createdBy' => $c['created_by'] ?? 'usr-owner-1',
        'createdAt' => $c['created_at'] ?? '',
    ], $custRows);

    $base['sales'] = array_map(fn($s) => [
        'id' => $s['id'],
        'storeId' => $s['store_id'] ?? DEFAULT_STORE_ID,
        'invoiceNumber' => $s['invoice_number'] ?? '',
        'date' => $s['date'] ?? '',
        'time' => $s['time'] ?? '',
        'staffId' => $s['staff_id'] ?? '',
        'staffName' => $s['staff_name'] ?? '',
        'customerId' => $s['customer_id'] ?? '',
        'customerName' => $s['customer_name'] ?? 'Walk-in Customer',
        'subtotal' => (float)($s['subtotal'] ?? 0),
        'discountTotal' => (float)($s['discount_total'] ?? 0),
        'taxTotal' => (float)($s['tax_total'] ?? 0),
        'grandTotal' => (float)($s['grand_total'] ?? 0),
        'amountPaid' => (float)($s['amount_paid'] ?? 0),
        'paymentMethod' => $s['payment_method'] ?? 'Cash',
        'status' => $s['status'] ?? 'completed',
        'items' => json_decode((string)($s['items_json'] ?? '[]'), true) ?: [],
        'createdBy' => $s['created_by'] ?? 'usr-owner-1',
    ], $salesRows);

    $base['purchases'] = array_map(fn($p) => [
        'id' => $p['id'],
        'storeId' => $p['store_id'] ?? DEFAULT_STORE_ID,
        'purchaseNumber' => $p['purchase_number'] ?? '',
        'supplierId' => $p['supplier_id'] ?? '',
        'supplierName' => $p['supplier_name'] ?? '',
        'invoiceNumber' => $p['invoice_number'] ?? '',
        'purchaseDate' => $p['purchase_date'] ?? '',
        'totalAmount' => (float)($p['total_amount'] ?? 0),
        'paidAmount' => (float)($p['paid_amount'] ?? 0),
        'balanceAmount' => (float)($p['balance_amount'] ?? 0),
        'paymentStatus' => $p['payment_status'] ?? 'Paid',
        'items' => json_decode((string)($p['items_json'] ?? '[]'), true) ?: [],
        'createdBy' => $p['created_by'] ?? 'usr-owner-1',
    ], $purRows);

    $base['expenses'] = array_map(fn($e) => [
        'id' => $e['id'],
        'storeId' => $e['store_id'] ?? DEFAULT_STORE_ID,
        'category' => $e['category'] ?? '',
        'description' => $e['description'] ?? '',
        'amount' => (float)($e['amount'] ?? 0),
        'date' => $e['date'] ?? '',
        'paymentMethod' => $e['payment_method'] ?? 'Cash',
        'addedBy' => $e['added_by'] ?? 'usr-owner-1',
        'createdBy' => $e['created_by'] ?? 'usr-owner-1',
    ], $expRows);

    return sanitizeDatabaseState($base);
}

function readLatestAutoBackup(string $sqliteFile): ?array {
    $primaryBackups = dirname($sqliteFile) . '/backups';
    $localBackups = __DIR__ . '/data/backups';
    $candidates = [];
    foreach (array_unique([$primaryBackups, $localBackups]) as $bDir) {
        if (file_exists($bDir . '/auto_latest.json')) {
            $candidates[] = $bDir . '/auto_latest.json';
        }
        $snaps = glob($bDir . '/backup_*.json') ?: [];
        rsort($snaps);
        foreach ($snaps as $s) {
            $candidates[] = $s;
        }
    }
    foreach ($candidates as $path) {
        $raw = @file_get_contents($path);
        if (!$raw) continue;
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) continue;
        $payload = is_array($decoded['data'] ?? null) ? $decoded['data'] : $decoded;
        if (is_array($payload) && ($payload['cleanVersion'] ?? '') === DATA_CLEAN_VERSION) {
            return sanitizeDatabaseState($payload);
        }
    }
    return null;
}

function readDatabase(string $sqliteFile): array {
    $pdo = getDatabaseConnection($sqliteFile);
    $stmt = $pdo->prepare('SELECT state_snapshot FROM store_settings WHERE id = ? LIMIT 1');
    $stmt->execute(['settings-1']);
    $row = $stmt->fetch();
    if ($row && !empty($row['state_snapshot'])) {
        $decoded = json_decode((string)$row['state_snapshot'], true);
        if (is_array($decoded) && ($decoded['cleanVersion'] ?? '') === DATA_CLEAN_VERSION) {
            $clean = sanitizeDatabaseState($decoded);
            $hasData =
                count($clean['staffMembers'] ?? []) > 1 ||
                count($clean['medicines'] ?? []) > 0 ||
                count($clean['sales'] ?? []) > 0 ||
                count($clean['purchases'] ?? []) > 0;
            if (!$hasData) {
                $backup = readLatestAutoBackup($sqliteFile);
                if (
                    $backup !== null &&
                    (count($backup['staffMembers'] ?? []) > 1 ||
                        count($backup['medicines'] ?? []) > 0 ||
                        count($backup['sales'] ?? []) > 0 ||
                        count($backup['purchases'] ?? []) > 0)
                ) {
                    return writeDatabase($sqliteFile, $backup);
                }
            }
            return $clean;
        }
    }

    // Never wipe existing data if snapshot failed to read — recover from relational SQL tables or auto backup first
    $recovered = reconstructFromRelationalTables($pdo);
    if ($recovered !== null) {
        return writeDatabase($sqliteFile, $recovered);
    }

    $backup = readLatestAutoBackup($sqliteFile);
    if ($backup !== null) {
        return writeDatabase($sqliteFile, $backup);
    }

    $initial = getInitialDatabase();
    return writeDatabase($sqliteFile, $initial);
}

function writeDatabase(string $sqliteFile, array $data): array {
    $clean = sanitizeDatabaseState($data);
    $clean['lastUpdated'] = gmdate('c');
    $pdo = getDatabaseConnection($sqliteFile);
    $pdo->beginTransaction();
    try {
        syncNormalizedTables($pdo, $clean);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    // Mirror SQLite file to local data directory if primary is in persistent domain-root directory
    $localSqlite = __DIR__ . '/data/pharmacy.sqlite';
    if ($sqliteFile !== $localSqlite && is_dir(__DIR__ . '/data')) {
        @copy($sqliteFile, $localSqlite);
    }

    // Atomically save rolling safety snapshot whenever real store data exists
    $hasRealData =
        count($clean['staffMembers'] ?? []) > 1 ||
        count($clean['medicines'] ?? []) > 0 ||
        count($clean['sales'] ?? []) > 0 ||
        count($clean['purchases'] ?? []) > 0;
    if ($hasRealData) {
        $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (is_string($json) && $json !== '') {
            foreach (array_unique([dirname($sqliteFile) . '/backups', __DIR__ . '/data/backups']) as $bDir) {
                if (!is_dir($bDir)) @mkdir($bDir, 0755, true);
                $autoFile = $bDir . '/auto_latest.json';
                $tmpFile = $autoFile . '.tmp.' . getmypid();
                if (@file_put_contents($tmpFile, $json) !== false) {
                    @rename($tmpFile, $autoFile);
                } else {
                    @unlink($tmpFile);
                }
            }
        }
    }

    return $clean;
}

function mergeCollectionById(array $existingArr, array $incomingArr, array $deletedSet): array {
    $map = [];
    foreach ($existingArr as $item) {
        if (is_array($item) && !empty($item['id']) && !isset($deletedSet[(string)$item['id']])) {
            $map[(string)$item['id']] = $item;
        }
    }
    foreach ($incomingArr as $item) {
        if (is_array($item) && !empty($item['id']) && !isset($deletedSet[(string)$item['id']])) {
            $map[(string)$item['id']] = $item;
        }
    }
    return array_values($map);
}

function getActorFromReq(array $db, array $body): array {
    $headers = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
    $userId = trim((string)($headers['x-user-id'] ?? ($_SERVER['HTTP_X_USER_ID'] ?? ($body['actorId'] ?? ''))));
    $role = trim((string)($headers['x-user-role'] ?? ($_SERVER['HTTP_X_USER_ROLE'] ?? ($body['actorRole'] ?? ''))));

    if ($userId !== '') {
        foreach (($db['staffMembers'] ?? []) as $u) {
            if (($u['id'] ?? '') === $userId || ($u['username'] ?? '') === $userId) {
                return $u;
            }
        }
    }
    if (in_array($role, ['staff', 'cashier', 'pharmacist'], true)) {
        return [
            'id' => $userId !== '' ? $userId : 'staff-actor',
            'role' => $role,
            'fullName' => 'Staff Member',
            'status' => 'active',
            'permissions' => defaultPermissions(false),
        ];
    }
    return $db['staffMembers'][0] ?? getOwnerTemplate();
}

// Parse route path relative to /api
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$route = preg_replace('#^/api#', '', $requestUri);
if ($route === '') $route = '/';
$method = $_SERVER['REQUEST_METHOD'];

try {
    acquireDbLock($sqliteFile, in_array($method, ['POST', 'PUT', 'DELETE'], true));
    // 1. Audit Schema
    if ($method === 'GET' && $route === '/audit-schema') {
        $db = readDatabase($sqliteFile);
        $tables = [
            ['id' => 1, 'name' => 'Stores', 'key' => 'stores', 'count' => count($db['stores'])],
            ['id' => 2, 'name' => 'Users', 'key' => 'users', 'count' => count($db['users'])],
            ['id' => 3, 'name' => 'Staff', 'key' => 'staffMembers', 'count' => count($db['staffMembers'])],
            ['id' => 4, 'name' => 'Medicines', 'key' => 'medicines', 'count' => count($db['medicines'])],
            ['id' => 5, 'name' => 'Medicine Categories', 'key' => 'categories', 'count' => count($db['categories'])],
            ['id' => 6, 'name' => 'Suppliers', 'key' => 'suppliers', 'count' => count($db['suppliers'])],
            ['id' => 7, 'name' => 'Customers', 'key' => 'customers', 'count' => count($db['customers'])],
            ['id' => 8, 'name' => 'Purchases', 'key' => 'purchases', 'count' => count($db['purchases'])],
            ['id' => 9, 'name' => 'Purchase Items', 'key' => 'purchaseItems', 'count' => count($db['purchaseItems'])],
            ['id' => 10, 'name' => 'Sales', 'key' => 'sales', 'count' => count($db['sales'])],
            ['id' => 11, 'name' => 'Sale Items', 'key' => 'saleItems', 'count' => count($db['saleItems'])],
            ['id' => 12, 'name' => 'Stock Transactions', 'key' => 'stockTransactions', 'count' => count($db['stockTransactions'])],
            ['id' => 13, 'name' => 'Expenses', 'key' => 'expenses', 'count' => count($db['expenses'])],
            ['id' => 14, 'name' => 'Payments', 'key' => 'payments', 'count' => count($db['payments'])],
            ['id' => 15, 'name' => 'Cash Memos / Invoices', 'key' => 'cashMemos', 'count' => count($db['cashMemos'])],
            ['id' => 16, 'name' => 'Activity Logs', 'key' => 'auditLogs', 'count' => count($db['auditLogs'])],
            ['id' => 17, 'name' => 'Store Settings', 'key' => 'settings', 'count' => 1],
            ['id' => 18, 'name' => 'Staff Permissions', 'key' => 'staffPermissions', 'count' => count($db['staffPermissions'])],
        ];
        sendJson([
            'success' => true,
            'storageEngine' => 'hostinger_sqlite',
            'storeId' => DEFAULT_STORE_ID,
            'totalTablesVerified' => 18,
            'tables' => $tables,
        ]);
    }

    // 2. DB Status & Sync Now
    if ($method === 'GET' && $route === '/db-status') {
        $db = readDatabase($sqliteFile);
        sendJson([
            'success' => true,
            'storageEngine' => 'hostinger_sqlite',
            'sqliteConnected' => true,
            'lastUpdated' => $db['lastUpdated'],
            'counts' => [
                'stores' => count($db['stores']),
                'staffAccounts' => count($db['staffMembers']),
                'medicines' => count($db['medicines']),
                'categories' => count($db['categories']),
                'sales' => count($db['sales']),
                'saleItems' => count($db['saleItems']),
                'purchases' => count($db['purchases']),
                'purchaseItems' => count($db['purchaseItems']),
                'suppliers' => count($db['suppliers']),
                'customers' => count($db['customers']),
                'expenses' => count($db['expenses']),
                'payments' => count($db['payments']),
                'cashMemos' => count($db['cashMemos']),
                'stockTransactions' => count($db['stockTransactions']),
            ],
        ]);
    }

    if ($method === 'POST' && $route === '/db-sync-now') {
        $db = readDatabase($sqliteFile);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson([
            'success' => true,
            'storageEngine' => 'hostinger_sqlite',
            'lastUpdated' => $saved['lastUpdated'],
        ]);
    }

    // 3. GET /api/state
    if ($method === 'GET' && $route === '/state') {
        $db = readDatabase($sqliteFile);
        sendJson([
            'success' => true,
            'storageEngine' => 'hostinger_sqlite',
            'data' => $db,
        ]);
    }

    // 4. POST /api/sync
    if ($method === 'POST' && $route === '/sync') {
        $incoming = readJsonBody();
        if (!isset($incoming['medicines']) || !is_array($incoming['medicines'])) {
            sendJson(['success' => false, 'error' => 'Invalid state payload'], 400);
        }

        $existing = readDatabase($sqliteFile);
        $deletedIds = !empty($incoming['resetDeletedIds']) ? [] : ($existing['deletedIds'] ?? []);

        if (!empty($incoming['forceReplaceAll'])) {
            if (is_array($incoming['deletedIds'] ?? null) && empty($incoming['resetDeletedIds'])) {
                $deletedIds = array_values(array_unique(array_merge($deletedIds, array_map('strval', $incoming['deletedIds']))));
            }
            $replaced = writeDatabase($sqliteFile, array_merge($existing, $incoming, [
                'cleanVersion' => DATA_CLEAN_VERSION,
                'deletedIds' => $deletedIds,
            ]));
            sendJson(['success' => true, 'storageEngine' => 'hostinger_sqlite', 'data' => $replaced]);
        }

        $deletedSet = array_flip($deletedIds);

        $mergedStaff = !empty($incoming['forceStaffReplace'])
            ? ($incoming['staffMembers'] ?? [])
            : mergeCollectionById($existing['staffMembers'], $incoming['staffMembers'] ?? [], $deletedSet);

        $mergedMeds = !empty($incoming['forceMedicineReplace'])
            ? ($incoming['medicines'] ?? [])
            : mergeCollectionById($existing['medicines'], $incoming['medicines'] ?? [], $deletedSet);

        $incomingSettings = is_array($incoming['settings'] ?? null) ? $incoming['settings'] : [];
        $mergedSettings = array_merge(getDefaultSettings(), $existing['settings'] ?? []);
        foreach ($incomingSettings as $sKey => $sVal) {
            if ($sVal !== null && ($sVal !== '' || !isset($mergedSettings[$sKey]) || $mergedSettings[$sKey] === '')) {
                $mergedSettings[$sKey] = $sVal;
            }
        }

        $nextDb = array_merge($existing, $incoming, [
            'cleanVersion' => DATA_CLEAN_VERSION,
            'settings' => $mergedSettings,
            'medicines' => $mergedMeds,
            'suppliers' => mergeCollectionById($existing['suppliers'], $incoming['suppliers'] ?? [], $deletedSet),
            'customers' => mergeCollectionById($existing['customers'], $incoming['customers'] ?? [], $deletedSet),
            'sales' => mergeCollectionById($existing['sales'], $incoming['sales'] ?? [], $deletedSet),
            'saleReturns' => mergeCollectionById($existing['saleReturns'], $incoming['saleReturns'] ?? [], $deletedSet),
            'purchases' => mergeCollectionById($existing['purchases'], $incoming['purchases'] ?? [], $deletedSet),
            'expenses' => mergeCollectionById($existing['expenses'], $incoming['expenses'] ?? [], $deletedSet),
            'adjustments' => mergeCollectionById($existing['adjustments'], $incoming['adjustments'] ?? [], $deletedSet),
            'auditLogs' => array_slice(mergeCollectionById($existing['auditLogs'], $incoming['auditLogs'] ?? [], $deletedSet), 0, 300),
            'notifications' => array_slice(mergeCollectionById($existing['notifications'], $incoming['notifications'] ?? [], $deletedSet), 0, 200),
            'staffMembers' => sanitizeStaffAccounts($mergedStaff),
            'deletedIds' => $deletedIds,
        ]);

        $saved = writeDatabase($sqliteFile, $nextDb);
        sendJson([
            'success' => true,
            'storageEngine' => 'hostinger_sqlite',
            'staffCount' => count($saved['staffMembers']),
            'medicineCount' => count($saved['medicines']),
            'data' => $saved,
        ]);
    }

    // 5. Medicine Endpoints
    if ($method === 'POST' && $route === '/medicine') {
        $med = readJsonBody();
        if (empty($med['name'])) {
            sendJson(['success' => false, 'error' => 'Medicine name is required'], 400);
        }
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $med);
        $id = (string)($med['id'] ?? ('med-' . round(microtime(true) * 1000)));
        $batches = is_array($med['batches'] ?? null) ? $med['batches'] : [];
        $totalQty = 0;
        foreach ($batches as $b) $totalQty += (float)($b['quantity'] ?? 0);

        $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $id));
        $medRecord = array_merge($med, [
            'id' => $id,
            'storeId' => DEFAULT_STORE_ID,
            'createdBy' => $med['createdBy'] ?? ($actor['id'] ?? 'usr-owner-1'),
            'batches' => $batches,
            'totalQuantity' => $totalQty,
        ]);

        $foundIdx = -1;
        foreach ($db['medicines'] as $i => $m) {
            if (($m['id'] ?? '') === $id) { $foundIdx = $i; break; }
        }
        if ($foundIdx >= 0) {
            $db['medicines'][$foundIdx] = $medRecord;
        } else {
            array_unshift($db['medicines'], $medRecord);
        }

        array_unshift($db['auditLogs'], [
            'id' => 'log-' . round(microtime(true) * 1000),
            'action' => 'MEDICINE_CREATED',
            'description' => 'Saved medicine ' . $medRecord['name'] . ' (Qty: ' . $totalQty . ')',
            'userId' => $actor['id'] ?? 'usr-owner-1',
            'userName' => $actor['fullName'] ?? 'Store User',
            'userRole' => $actor['role'] ?? 'admin',
            'timestamp' => gmdate('c'),
        ]);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'medicine' => $medRecord, 'data' => $saved]);
    }

    if (preg_match('#^/medicine/([^/]+)$#', $route, $m)) {
        $medId = urldecode($m[1]);
        $db = readDatabase($sqliteFile);
        if ($method === 'PUT') {
            $updates = readJsonBody();
            $actor = getActorFromReq($db, $updates);
            $idx = -1;
            foreach ($db['medicines'] as $i => $item) {
                if (($item['id'] ?? '') === $medId) { $idx = $i; break; }
            }
            $base = $idx >= 0 ? $db['medicines'][$idx] : ['id' => $medId];
            $merged = array_merge($base, $updates, ['id' => $medId, 'storeId' => DEFAULT_STORE_ID]);
            $batches = is_array($merged['batches'] ?? null) ? $merged['batches'] : [];
            $totalQty = 0;
            foreach ($batches as $b) {
                if (is_array($b)) $totalQty += (float)($b['quantity'] ?? 0);
            }
            $merged['batches'] = $batches;
            $merged['totalQuantity'] = count($batches) > 0 ? $totalQty : (float)($merged['totalQuantity'] ?? 0);
            $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $medId));
            if ($idx >= 0) {
                $db['medicines'][$idx] = $merged;
            } else {
                array_unshift($db['medicines'], $merged);
            }
            array_unshift($db['auditLogs'], [
                'id' => 'log-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4),
                'action' => 'MEDICINE_UPDATED',
                'description' => 'Updated medicine ' . ($merged['name'] ?? $medId) . ' (Stock: ' . $merged['totalQuantity'] . ')',
                'userId' => $actor['id'] ?? 'usr-owner-1',
                'userName' => $actor['fullName'] ?? 'Store User',
                'userRole' => $actor['role'] ?? 'admin',
                'timestamp' => gmdate('c'),
            ]);
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'medicine' => $merged, 'data' => $saved]);
        }
        if ($method === 'DELETE') {
            $db['medicines'] = array_values(array_filter($db['medicines'], fn($x) => ($x['id'] ?? '') !== $medId));
            $db['deletedIds'][] = $medId;
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'message' => 'Medicine deleted', 'data' => $saved]);
        }
    }

    // 6. Sales & Sale Returns
    if ($method === 'POST' && $route === '/sale') {
        $sale = readJsonBody();
        if (empty($sale['items']) || !is_array($sale['items'])) {
            sendJson(['success' => false, 'error' => 'Cart items cannot be empty'], 400);
        }
        $db = readDatabase($sqliteFile);
        $todayStr = gmdate('Y-m-d');
        $saleId = (string)($sale['id'] ?? ('sal-' . round(microtime(true) * 1000)));
        foreach ($db['sales'] as $s) {
            if (($s['id'] ?? '') === $saleId || (!empty($sale['invoiceNumber']) && ($s['invoiceNumber'] ?? '') === $sale['invoiceNumber'])) {
                sendJson(['success' => false, 'error' => 'Duplicate invoice or sale ID'], 409);
            }
        }

        // Validate quantities and deduct stock atomically inside DB
        foreach ($sale['items'] as $sItem) {
            $qty = (float)($sItem['quantity'] ?? 0);
            if ($qty <= 0) continue;
            foreach ($db['medicines'] as &$med) {
                if (($med['id'] ?? '') !== ($sItem['medicineId'] ?? '')) continue;
                $newTotal = 0;
                foreach ($med['batches'] as &$b) {
                    if (($b['id'] ?? '') === ($sItem['batchId'] ?? '') || (!empty($sItem['batchNumber']) && ($b['batchNumber'] ?? '') === $sItem['batchNumber'])) {
                        $prevQty = (float)($b['quantity'] ?? 0);
                        $b['quantity'] = max(0, $prevQty - $qty);
                        array_unshift($db['stockTransactions'], [
                            'id' => 'stx-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4),
                            'storeId' => DEFAULT_STORE_ID,
                            'medicineId' => $med['id'],
                            'medicineName' => $med['name'] ?? '',
                            'batchId' => $b['id'] ?? '',
                            'batchNumber' => $b['batchNumber'] ?? '',
                            'type' => 'sale',
                            'quantityChange' => -$qty,
                            'previousQuantity' => $prevQty,
                            'newQuantity' => $b['quantity'],
                            'referenceId' => $saleId,
                            'createdBy' => $sale['staffId'] ?? 'usr-owner-1',
                            'createdByName' => $sale['staffName'] ?? 'Store Dispenser',
                            'timestamp' => gmdate('c'),
                        ]);
                    }
                    $newTotal += (float)($b['quantity'] ?? 0);
                }
                $med['totalQuantity'] = $newTotal;
            }
            unset($med, $b);
        }

        $saleRecord = array_merge($sale, [
            'id' => $saleId,
            'storeId' => DEFAULT_STORE_ID,
            'createdBy' => $sale['staffId'] ?? 'usr-owner-1',
            'status' => $sale['status'] ?? 'completed',
        ]);
        array_unshift($db['sales'], $saleRecord);

        // Update linked customer ledger
        if (!empty($saleRecord['customerId'])) {
            foreach ($db['customers'] as &$cust) {
                if (($cust['id'] ?? '') === $saleRecord['customerId']) {
                    $grandTotal = (float)($saleRecord['grandTotal'] ?? 0);
                    $paid = (float)($saleRecord['amountPaid'] ?? 0);
                    $cust['totalPurchases'] = (float)($cust['totalPurchases'] ?? 0) + $grandTotal;
                    $cust['lastPurchaseDate'] = $saleRecord['date'] ?? $todayStr;
                    $unpaid = max(0, $grandTotal - $paid);
                    if (($saleRecord['paymentMethod'] ?? '') === 'Credit' || $unpaid > 0) {
                        $cust['outstandingBalance'] = (float)($cust['outstandingBalance'] ?? 0) + $unpaid;
                    }
                }
            }
            unset($cust);
        }

        // Record payment if amountPaid > 0
        $amtPaid = (float)($saleRecord['amountPaid'] ?? 0);
        if ($amtPaid > 0) {
            array_unshift($db['payments'], [
                'id' => 'pay-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4),
                'storeId' => DEFAULT_STORE_ID,
                'partyType' => 'customer',
                'partyId' => $saleRecord['customerId'] ?? '',
                'referenceId' => $saleId,
                'amount' => min($amtPaid, (float)($saleRecord['grandTotal'] ?? $amtPaid)),
                'paymentMethod' => $saleRecord['paymentMethod'] ?? 'Cash',
                'date' => $saleRecord['date'] ?? $todayStr,
                'createdBy' => $saleRecord['staffId'] ?? 'usr-owner-1',
            ]);
        }

        array_unshift($db['auditLogs'], [
            'id' => 'log-' . round(microtime(true) * 1000),
            'action' => 'SALE_COMPLETED',
            'description' => 'Dispensed invoice ' . ($saleRecord['invoiceNumber'] ?? $saleId) . ' for Rs. ' . ($saleRecord['grandTotal'] ?? 0) . ' via ' . ($saleRecord['paymentMethod'] ?? 'Cash'),
            'userId' => $saleRecord['staffId'] ?? 'usr-owner-1',
            'userName' => $saleRecord['staffName'] ?? 'Staff Cashier',
            'userRole' => 'staff',
            'timestamp' => gmdate('c'),
        ]);

        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'sale' => $saleRecord, 'data' => $saved]);
    }

    if ($method === 'POST' && $route === '/sale-return') {
        $ret = readJsonBody();
        $db = readDatabase($sqliteFile);
        foreach ($db['saleReturns'] as $existingRet) {
            if (($existingRet['id'] ?? '') === ($ret['id'] ?? '')) {
                sendJson(['success' => true, 'data' => $db]);
            }
        }
        array_unshift($db['saleReturns'], $ret);
        foreach ($db['sales'] as &$s) {
            if (($s['id'] ?? '') === ($ret['saleId'] ?? '')) $s['status'] = 'returned';
        }
        unset($s);
        foreach (($ret['items'] ?? []) as $rItem) {
            $qty = (float)($rItem['quantity'] ?? 0);
            foreach ($db['medicines'] as &$med) {
                if (($med['id'] ?? '') !== ($rItem['medicineId'] ?? '')) continue;
                $newTotal = 0;
                foreach ($med['batches'] as &$b) {
                    if (($b['id'] ?? '') === ($rItem['batchId'] ?? '')) {
                        $prevQty = (float)($b['quantity'] ?? 0);
                        $b['quantity'] = $prevQty + $qty;
                        array_unshift($db['stockTransactions'], [
                            'id' => 'stx-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4),
                            'storeId' => DEFAULT_STORE_ID,
                            'medicineId' => $med['id'],
                            'batchId' => $b['id'],
                            'type' => 'return',
                            'quantityChange' => $qty,
                            'referenceId' => $ret['id'] ?? ($ret['saleId'] ?? ''),
                            'createdBy' => $ret['staffId'] ?? 'usr-owner-1',
                            'timestamp' => gmdate('c'),
                        ]);
                    }
                    $newTotal += (float)($b['quantity'] ?? 0);
                }
                $med['totalQuantity'] = $newTotal;
            }
            unset($med, $b);
        }
        array_unshift($db['auditLogs'], [
            'id' => 'log-' . round(microtime(true) * 1000),
            'action' => 'SALE_RETURN',
            'description' => 'Processed return for Invoice ' . ($ret['invoiceNumber'] ?? ''),
            'userId' => $ret['staffId'] ?? 'usr-owner-1',
            'userName' => $ret['staffName'] ?? 'Store Staff',
            'userRole' => 'staff',
            'timestamp' => gmdate('c'),
        ]);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'data' => $saved]);
    }

    // 7. Purchases & Payments
    if ($method === 'POST' && $route === '/purchase') {
        $po = readJsonBody();
        if (empty($po['items']) || !is_array($po['items'])) {
            sendJson(['success' => false, 'error' => 'Purchase items required'], 400);
        }
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $po);
        $poId = (string)($po['id'] ?? ('pur-' . round(microtime(true) * 1000)));
        foreach ($db['purchases'] as $existingPo) {
            if (($existingPo['id'] ?? '') === $poId) {
                sendJson(['success' => true, 'purchase' => $existingPo, 'data' => $db]);
            }
        }

        $totalAmount = (float)($po['totalAmount'] ?? 0);
        $paidAmount = (float)($po['paidAmount'] ?? 0);
        $balanceAmount = max(0, $totalAmount - $paidAmount);
        $paymentStatus = $balanceAmount == 0 ? 'Paid' : ($paidAmount > 0 ? 'Partial' : 'Pending');

        $poRecord = array_merge($po, [
            'id' => $poId,
            'storeId' => DEFAULT_STORE_ID,
            'createdBy' => $po['createdBy'] ?? ($actor['id'] ?? 'usr-owner-1'),
            'totalAmount' => $totalAmount,
            'paidAmount' => $paidAmount,
            'balanceAmount' => $balanceAmount,
            'paymentStatus' => $paymentStatus,
        ]);
        array_unshift($db['purchases'], $poRecord);

        foreach ($poRecord['items'] as $pItem) {
            $skipStock = !empty($pItem['skipStockAddition']);
            foreach ($db['medicines'] as &$med) {
                if (($med['id'] ?? '') !== ($pItem['medicineId'] ?? '')) continue;
                $batches = is_array($med['batches'] ?? null) ? $med['batches'] : [];
                $foundBatchIdx = -1;
                foreach ($batches as $bIdx => $b) {
                    if (($b['batchNumber'] ?? '') === ($pItem['batchNumber'] ?? '')) {
                        $foundBatchIdx = $bIdx;
                        break;
                    }
                }
                $batchId = $foundBatchIdx >= 0 ? ($batches[$foundBatchIdx]['id'] ?? '') : ('bat-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4));
                if (!$skipStock) {
                    if ($foundBatchIdx >= 0) {
                        $batches[$foundBatchIdx]['quantity'] = (float)($batches[$foundBatchIdx]['quantity'] ?? 0) + (float)($pItem['quantity'] ?? 0);
                        $batches[$foundBatchIdx]['purchasePrice'] = (float)($pItem['purchasePrice'] ?? $batches[$foundBatchIdx]['purchasePrice']);
                        $batches[$foundBatchIdx]['salePrice'] = (float)($pItem['salePrice'] ?? $batches[$foundBatchIdx]['salePrice']);
                        if (!empty($pItem['expiryDate'])) $batches[$foundBatchIdx]['expiryDate'] = $pItem['expiryDate'];
                    } else {
                        $batches[] = [
                            'id' => $batchId,
                            'medicineId' => $med['id'],
                            'batchNumber' => $pItem['batchNumber'] ?? 'BATCH-1',
                            'purchasePrice' => (float)($pItem['purchasePrice'] ?? 0),
                            'salePrice' => (float)($pItem['salePrice'] ?? 0),
                            'wholesalePrice' => (float)($pItem['salePrice'] ?? 0) * 0.9,
                            'quantity' => (float)($pItem['quantity'] ?? 0),
                            'initialQuantity' => (float)($pItem['quantity'] ?? 0),
                            'mfgDate' => $pItem['mfgDate'] ?? gmdate('Y-m-d'),
                            'expiryDate' => $pItem['expiryDate'] ?? gmdate('Y-m-d', strtotime('+1 year')),
                            'supplierId' => $poRecord['supplierId'] ?? '',
                            'supplierName' => $poRecord['supplierName'] ?? '',
                            'receivedDate' => $poRecord['purchaseDate'] ?? gmdate('Y-m-d'),
                        ];
                    }
                    if (!empty($pItem['salePrice']) && (float)$pItem['salePrice'] > 0) {
                        $med['fixedSalePrice'] = (float)$pItem['salePrice'];
                    }
                    if (isset($pItem['purchasePrice'])) {
                        $med['fixedPurchasePrice'] = (float)$pItem['purchasePrice'];
                    }
                    $med['batches'] = $batches;
                    $newTotal = 0;
                    foreach ($batches as $b) $newTotal += (float)($b['quantity'] ?? 0);
                    $med['totalQuantity'] = $newTotal;
                }

                array_unshift($db['stockTransactions'], [
                    'id' => 'stx-' . round(microtime(true) * 1000) . '-' . substr(md5((string)mt_rand()), 0, 4),
                    'storeId' => DEFAULT_STORE_ID,
                    'medicineId' => $med['id'],
                    'batchId' => $batchId,
                    'type' => 'purchase',
                    'quantityChange' => (float)($pItem['quantity'] ?? 0),
                    'referenceId' => $poId,
                    'createdBy' => $poRecord['createdBy'],
                    'timestamp' => gmdate('c'),
                ]);
            }
            unset($med);
        }

        if (!empty($poRecord['supplierId'])) {
            foreach ($db['suppliers'] as &$sup) {
                if (($sup['id'] ?? '') === $poRecord['supplierId']) {
                    $sup['totalPurchases'] = (float)($sup['totalPurchases'] ?? 0) + $totalAmount;
                    $sup['totalPaid'] = (float)($sup['totalPaid'] ?? 0) + $paidAmount;
                    $sup['outstandingBalance'] = (float)($sup['outstandingBalance'] ?? 0) + $balanceAmount;
                }
            }
            unset($sup);
        }

        if ($paidAmount > 0) {
            array_unshift($db['payments'], [
                'id' => 'pay-' . round(microtime(true) * 1000),
                'storeId' => DEFAULT_STORE_ID,
                'partyType' => 'supplier',
                'partyId' => $poRecord['supplierId'] ?? '',
                'referenceId' => $poId,
                'amount' => $paidAmount,
                'paymentMethod' => $poRecord['paymentMethod'] ?? 'Cash',
                'date' => $poRecord['purchaseDate'] ?? gmdate('Y-m-d'),
                'createdBy' => $poRecord['createdBy'],
            ]);
        }

        array_unshift($db['auditLogs'], [
            'id' => 'log-' . round(microtime(true) * 1000),
            'action' => 'PURCHASE_RECORDED',
            'description' => 'Received PO ' . ($poRecord['purchaseNumber'] ?? $poId) . ' from ' . ($poRecord['supplierName'] ?? 'Supplier'),
            'userId' => $poRecord['createdBy'],
            'userName' => $actor['fullName'] ?? 'Store User',
            'userRole' => $actor['role'] ?? 'admin',
            'timestamp' => gmdate('c'),
        ]);

        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'purchase' => $poRecord, 'data' => $saved]);
    }

    if ($method === 'POST' && preg_match('#^/purchase/([^/]+)/payment$#', $route, $m)) {
        $poId = urldecode($m[1]);
        $body = readJsonBody();
        $amt = (float)($body['amount'] ?? 0);
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $body);
        $supplierId = '';
        foreach ($db['purchases'] as &$p) {
            if (($p['id'] ?? '') === $poId) {
                $p['paidAmount'] = (float)($p['paidAmount'] ?? 0) + $amt;
                $p['balanceAmount'] = max(0, (float)($p['totalAmount'] ?? 0) - $p['paidAmount']);
                $p['paymentStatus'] = $p['balanceAmount'] <= 0 ? 'Paid' : 'Partial';
                $supplierId = (string)($p['supplierId'] ?? '');
            }
        }
        unset($p);
        if ($supplierId !== '') {
            foreach ($db['suppliers'] as &$sup) {
                if (($sup['id'] ?? '') === $supplierId) {
                    $sup['totalPaid'] = (float)($sup['totalPaid'] ?? 0) + $amt;
                    $sup['outstandingBalance'] = max(0, (float)($sup['outstandingBalance'] ?? 0) - $amt);
                }
            }
            unset($sup);
        }
        if ($amt > 0) {
            array_unshift($db['payments'], [
                'id' => 'pay-' . round(microtime(true) * 1000),
                'storeId' => DEFAULT_STORE_ID,
                'partyType' => 'supplier',
                'partyId' => $supplierId,
                'referenceId' => $poId,
                'amount' => $amt,
                'paymentMethod' => $body['paymentMethod'] ?? 'Cash',
                'date' => gmdate('Y-m-d'),
                'createdBy' => $actor['id'] ?? 'usr-owner-1',
            ]);
        }
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'data' => $saved]);
    }

    // 8. Adjustments
    if ($method === 'POST' && $route === '/adjustment') {
        $adj = readJsonBody();
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $adj);
        $resolvedPrevQty = (float)($adj['previousQuantity'] ?? 0);
        $resolvedNextQty = (float)($adj['newQuantity'] ?? 0);
        foreach ($db['medicines'] as &$med) {
            if (($med['id'] ?? '') !== ($adj['medicineId'] ?? '')) continue;
            $newTotal = 0;
            foreach ($med['batches'] as &$b) {
                if (($b['id'] ?? '') === ($adj['batchId'] ?? '') || ($b['batchNumber'] ?? '') === ($adj['batchNumber'] ?? '')) {
                    $prevQty = (float)($b['quantity'] ?? 0);
                    $nextQty = isset($adj['newQuantity'])
                        ? max(0, (float)$adj['newQuantity'])
                        : max(0, $prevQty + (float)($adj['adjustedQuantity'] ?? 0));
                    $b['quantity'] = $nextQty;
                    $resolvedPrevQty = $prevQty;
                    $resolvedNextQty = $nextQty;
                    if (empty($adj['medicineName'])) $adj['medicineName'] = $med['name'] ?? '';
                    if (empty($adj['batchNumber'])) $adj['batchNumber'] = $b['batchNumber'] ?? '';
                }
                $newTotal += (float)($b['quantity'] ?? 0);
            }
            $med['totalQuantity'] = $newTotal;
        }
        unset($med, $b);
        $adj['id'] = (string)($adj['id'] ?? ('adj-' . round(microtime(true) * 1000)));
        $adj['storeId'] = DEFAULT_STORE_ID;
        $adj['previousQuantity'] = $resolvedPrevQty;
        $adj['newQuantity'] = $resolvedNextQty;
        $adj['adjustedQuantity'] = (float)($adj['adjustedQuantity'] ?? ($resolvedNextQty - $resolvedPrevQty));
        $adj['performedBy'] = (string)($adj['performedBy'] ?? ($actor['id'] ?? 'usr-owner-1'));
        $adj['performedByName'] = (string)($adj['performedByName'] ?? ($actor['fullName'] ?? 'Admin Pharmacist'));
        $adj['timestamp'] = (string)($adj['timestamp'] ?? gmdate('c'));
        array_unshift($db['adjustments'], $adj);
        array_unshift($db['stockTransactions'], [
            'id' => 'stx-' . round(microtime(true) * 1000),
            'storeId' => DEFAULT_STORE_ID,
            'medicineId' => $adj['medicineId'] ?? '',
            'batchId' => $adj['batchId'] ?? '',
            'type' => 'adjustment',
            'quantityChange' => (float)($adj['adjustedQuantity'] ?? 0),
            'referenceId' => $adj['id'] ?? '',
            'createdBy' => $actor['id'] ?? 'usr-owner-1',
            'timestamp' => gmdate('c'),
        ]);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'adjustment' => $adj, 'data' => $saved]);
    }

    // 9. Customers
    if ($method === 'POST' && $route === '/customer') {
        $cust = readJsonBody();
        $db = readDatabase($sqliteFile);
        $cid = (string)($cust['id'] ?? ('cust-' . round(microtime(true) * 1000)));
        $cust['id'] = $cid;
        $cust['storeId'] = DEFAULT_STORE_ID;
        $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $cid));
        $db['customers'] = array_values(array_filter($db['customers'], fn($c) => ($c['id'] ?? '') !== $cid));
        array_unshift($db['customers'], $cust);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'customer' => $cust, 'data' => $saved]);
    }
    if (preg_match('#^/customer/([^/]+)$#', $route, $m)) {
        $cid = urldecode($m[1]);
        $db = readDatabase($sqliteFile);
        if ($method === 'PUT') {
            $upd = readJsonBody();
            foreach ($db['customers'] as &$c) if (($c['id'] ?? '') === $cid) $c = array_merge($c, $upd);
            unset($c);
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
        if ($method === 'DELETE') {
            $db['customers'] = array_values(array_filter($db['customers'], fn($c) => ($c['id'] ?? '') !== $cid));
            $db['deletedIds'][] = $cid;
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
    }
    if ($method === 'POST' && preg_match('#^/customer/([^/]+)/payment$#', $route, $m)) {
        $cid = urldecode($m[1]);
        $body = readJsonBody();
        $amt = (float)($body['amount'] ?? 0);
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $body);
        foreach ($db['customers'] as &$c) {
            if (($c['id'] ?? '') === $cid) {
                $c['outstandingBalance'] = max(0, (float)($c['outstandingBalance'] ?? 0) - $amt);
            }
        }
        unset($c);
        if ($amt > 0) {
            array_unshift($db['payments'], [
                'id' => 'pay-' . round(microtime(true) * 1000),
                'storeId' => DEFAULT_STORE_ID,
                'partyType' => 'customer',
                'partyId' => $cid,
                'referenceId' => $cid,
                'amount' => $amt,
                'paymentMethod' => $body['paymentMethod'] ?? 'Cash',
                'date' => gmdate('Y-m-d'),
                'createdBy' => $actor['id'] ?? 'usr-owner-1',
            ]);
        }
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'data' => $saved]);
    }

    // 10. Suppliers
    if ($method === 'POST' && $route === '/supplier') {
        $sup = readJsonBody();
        $db = readDatabase($sqliteFile);
        $sid = (string)($sup['id'] ?? ('sup-' . round(microtime(true) * 1000)));
        $sup['id'] = $sid;
        $sup['storeId'] = DEFAULT_STORE_ID;
        $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $sid));
        $db['suppliers'] = array_values(array_filter($db['suppliers'], fn($s) => ($s['id'] ?? '') !== $sid));
        array_unshift($db['suppliers'], $sup);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'supplier' => $sup, 'data' => $saved]);
    }
    if (preg_match('#^/supplier/([^/]+)$#', $route, $m)) {
        $sid = urldecode($m[1]);
        $db = readDatabase($sqliteFile);
        if ($method === 'PUT') {
            $upd = readJsonBody();
            foreach ($db['suppliers'] as &$s) if (($s['id'] ?? '') === $sid) $s = array_merge($s, $upd);
            unset($s);
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
        if ($method === 'DELETE') {
            $db['suppliers'] = array_values(array_filter($db['suppliers'], fn($s) => ($s['id'] ?? '') !== $sid));
            $db['deletedIds'][] = $sid;
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
    }
    if ($method === 'POST' && preg_match('#^/supplier/([^/]+)/payment$#', $route, $m)) {
        $sid = urldecode($m[1]);
        $body = readJsonBody();
        $amt = (float)($body['amount'] ?? 0);
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $body);
        foreach ($db['suppliers'] as &$s) {
            if (($s['id'] ?? '') === $sid) {
                $s['totalPaid'] = (float)($s['totalPaid'] ?? 0) + $amt;
                $s['outstandingBalance'] = max(0, (float)($s['outstandingBalance'] ?? 0) - $amt);
            }
        }
        unset($s);
        if ($amt > 0) {
            array_unshift($db['payments'], [
                'id' => 'pay-' . round(microtime(true) * 1000),
                'storeId' => DEFAULT_STORE_ID,
                'partyType' => 'supplier',
                'partyId' => $sid,
                'referenceId' => $sid,
                'amount' => $amt,
                'paymentMethod' => $body['paymentMethod'] ?? 'Cash',
                'date' => gmdate('Y-m-d'),
                'createdBy' => $actor['id'] ?? 'usr-owner-1',
            ]);
        }
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'data' => $saved]);
    }

    // 11. Expenses
    if ($method === 'POST' && $route === '/expense') {
        $exp = readJsonBody();
        $db = readDatabase($sqliteFile);
        $eid = (string)($exp['id'] ?? ('exp-' . round(microtime(true) * 1000)));
        $exp['id'] = $eid;
        $exp['storeId'] = DEFAULT_STORE_ID;
        $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $eid));
        $db['expenses'] = array_values(array_filter($db['expenses'], fn($e) => ($e['id'] ?? '') !== $eid));
        array_unshift($db['expenses'], $exp);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'expense' => $exp, 'data' => $saved]);
    }
    if (preg_match('#^/expense/([^/]+)$#', $route, $m)) {
        $eid = urldecode($m[1]);
        $db = readDatabase($sqliteFile);
        if ($method === 'PUT') {
            $upd = readJsonBody();
            foreach ($db['expenses'] as &$e) if (($e['id'] ?? '') === $eid) $e = array_merge($e, $upd);
            unset($e);
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
        if ($method === 'DELETE') {
            $db['expenses'] = array_values(array_filter($db['expenses'], fn($e) => ($e['id'] ?? '') !== $eid));
            $db['deletedIds'][] = $eid;
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'data' => $saved]);
        }
    }

    // 12. Settings
    if ($method === 'PUT' && $route === '/settings') {
        $upd = readJsonBody();
        $db = readDatabase($sqliteFile);
        $db['settings'] = array_merge($db['settings'] ?? getDefaultSettings(), $upd);
        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'settings' => $saved['settings'], 'data' => $saved]);
    }

    // 13. Backups
    if ($method === 'GET' && $route === '/backups') {
        $files = glob($backupsDir . '/backup_*.json') ?: [];
        rsort($files);
        $snaps = [];
        foreach ($files as $f) {
            $parsed = json_decode((string)@file_get_contents($f), true);
            $snapData = is_array($parsed['data'] ?? null) ? $parsed['data'] : [];
            $snaps[] = [
                'id' => (string)($parsed['snapshotId'] ?? basename($f)),
                'filename' => basename($f),
                'timestamp' => (string)($parsed['createdAt'] ?? gmdate('c', (int)filemtime($f))),
                'sizeBytes' => (int)filesize($f),
                'recordsCount' => [
                    'medicines' => count($snapData['medicines'] ?? []),
                    'sales' => count($snapData['sales'] ?? []),
                    'purchases' => count($snapData['purchases'] ?? []),
                    'customers' => count($snapData['customers'] ?? []),
                    'suppliers' => count($snapData['suppliers'] ?? []),
                ],
            ];
        }
        sendJson(['success' => true, 'snapshots' => $snaps]);
    }
    if ($method === 'POST' && $route === '/backups') {
        $comment = (string)(readJsonBody()['comment'] ?? 'Manual User Backup');
        $db = readDatabase($sqliteFile);
        $filename = 'backup_' . gmdate('Y-m-d\TH-i-s\Z') . '.json';
        file_put_contents($backupsDir . '/' . $filename, json_encode([
            'snapshotId' => 'snap-' . time(),
            'comment' => $comment,
            'createdAt' => gmdate('c'),
            'data' => $db,
        ], JSON_PRETTY_PRINT));
        sendJson(['success' => true, 'filename' => $filename]);
    }
    if ($method === 'POST' && $route === '/backups/restore') {
        $filename = basename((string)(readJsonBody()['filename'] ?? ''));
        $path = $backupsDir . '/' . $filename;
        if (!$filename || !file_exists($path)) {
            sendJson(['success' => false, 'error' => 'Backup snapshot not found'], 404);
        }
        $snap = json_decode((string)file_get_contents($path), true);
        if (!is_array($snap['data'] ?? null)) {
            sendJson(['success' => false, 'error' => 'Invalid backup file'], 400);
        }
        $saved = writeDatabase($sqliteFile, $snap['data']);
        sendJson(['success' => true, 'data' => $saved]);
    }

    // 14. Staff & Auth Endpoints
    if ($method === 'GET' && $route === '/staff') {
        $db = readDatabase($sqliteFile);
        sendJson(['success' => true, 'staffMembers' => $db['staffMembers']]);
    }

    if ($method === 'POST' && $route === '/staff') {
        $newStaff = readJsonBody();
        if (empty($newStaff['username']) || empty($newStaff['fullName'])) {
            sendJson(['success' => false, 'error' => 'Full name and username are required'], 400);
        }
        $db = readDatabase($sqliteFile);
        $actor = getActorFromReq($db, $newStaff);
        if (($actor['role'] ?? 'admin') !== 'admin') {
            sendJson(['success' => false, 'error' => 'Only Store Owner can create staff accounts'], 403);
        }

        $cleanUsername = ltrim(strtolower(trim((string)$newStaff['username'])), '@');
        $plainPass = trim((string)($newStaff['password'] ?? 'seller123'));
        $existingIdx = -1;
        foreach ($db['staffMembers'] as $i => $u) {
            if (($u['id'] ?? '') === ($newStaff['id'] ?? '') || strtolower((string)$u['username']) === $cleanUsername) {
                $existingIdx = $i;
                break;
            }
        }

        $userId = $existingIdx >= 0 ? $db['staffMembers'][$existingIdx]['id'] : (string)($newStaff['id'] ?? ('usr-staff-' . round(microtime(true) * 1000)));
        $userToSave = array_merge($newStaff, [
            'id' => $userId,
            'storeId' => DEFAULT_STORE_ID,
            'createdBy' => 'usr-owner-1',
            'username' => $cleanUsername,
            'password' => $plainPass,
            'passwordHash' => hashPasswordStr($plainPass),
            'pin' => trim((string)($newStaff['pin'] ?? '5678')),
            'status' => $newStaff['status'] ?? 'active',
            'joiningDate' => $newStaff['joiningDate'] ?? gmdate('Y-m-d'),
        ]);

        if ($existingIdx >= 0) {
            $db['staffMembers'][$existingIdx] = $userToSave;
        } else {
            $db['staffMembers'][] = $userToSave;
        }
        $db['deletedIds'] = array_values(array_filter($db['deletedIds'] ?? [], fn($d) => $d !== $userId));
        $db['staffMembers'] = sanitizeStaffAccounts($db['staffMembers']);
        array_unshift($db['auditLogs'], [
            'id' => 'log-' . round(microtime(true) * 1000),
            'action' => 'STAFF_CREATED',
            'description' => 'Owner created staff account for ' . $userToSave['fullName'] . ' (@' . $userToSave['username'] . ')',
            'userId' => 'usr-owner-1',
            'userName' => 'Dr. Abdul Rehman (Owner)',
            'userRole' => 'admin',
            'timestamp' => gmdate('c'),
        ]);

        $saved = writeDatabase($sqliteFile, $db);
        sendJson(['success' => true, 'user' => $userToSave, 'staffMembers' => $saved['staffMembers']]);
    }

    if (preg_match('#^/staff/([^/]+)$#', $route, $m)) {
        $sid = urldecode($m[1]);
        $db = readDatabase($sqliteFile);
        if ($method === 'PUT') {
            $upd = readJsonBody();
            $idx = -1;
            foreach ($db['staffMembers'] as $i => $u) if (($u['id'] ?? '') === $sid) { $idx = $i; break; }
            if ($idx === -1) sendJson(['success' => false, 'error' => 'Staff account not found'], 404);
            $nextPass = isset($upd['password']) ? trim((string)$upd['password']) : (string)($db['staffMembers'][$idx]['password'] ?? '');
            $nextRole = (string)($upd['role'] ?? ($db['staffMembers'][$idx]['role'] ?? 'staff'));
            $db['staffMembers'][$idx] = array_merge($db['staffMembers'][$idx], $upd, [
                'password' => $nextPass,
                'passwordHash' => $nextPass !== '' ? hashPasswordStr($nextPass) : ($db['staffMembers'][$idx]['passwordHash'] ?? ''),
                'permissions' => normalizeUserPermissions($upd['permissions'] ?? ($db['staffMembers'][$idx]['permissions'] ?? null), $nextRole),
            ]);
            $db['staffMembers'] = sanitizeStaffAccounts($db['staffMembers']);
            $saved = writeDatabase($sqliteFile, $db);
            $updatedUser = null;
            foreach ($saved['staffMembers'] as $su) {
                if (($su['id'] ?? '') === $sid) {
                    $updatedUser = $su;
                    break;
                }
            }
            sendJson(['success' => true, 'user' => $updatedUser, 'staffMembers' => $saved['staffMembers']]);
        }
        if ($method === 'DELETE') {
            if ($sid === 'all-others') {
                foreach ($db['staffMembers'] as $u) {
                    if (($u['id'] ?? '') !== 'usr-owner-1') $db['deletedIds'][] = $u['id'];
                }
                $db['staffMembers'] = sanitizeStaffAccounts([]);
            } else {
                if ($sid === 'usr-owner-1') sendJson(['success' => false, 'error' => 'Owner account cannot be deleted'], 403);
                $db['staffMembers'] = sanitizeStaffAccounts(array_values(array_filter($db['staffMembers'], fn($u) => ($u['id'] ?? '') !== $sid)));
                $db['deletedIds'][] = $sid;
            }
            $saved = writeDatabase($sqliteFile, $db);
            sendJson(['success' => true, 'staffMembers' => $saved['staffMembers']]);
        }
    }

    if ($method === 'POST' && $route === '/auth/login') {
        $body = readJsonBody();
        $rawInput = ltrim(strtolower(trim((string)($body['username'] ?? ''))), '@');
        $cleanCompact = preg_replace('/\s+/', '', $rawInput);
        $cleanPass = trim((string)($body['password'] ?? ''));
        if ($rawInput === '') sendJson(['success' => false, 'error' => 'Username is required'], 400);

        $db = readDatabase($sqliteFile);
        $matched = null;
        foreach ($db['staffMembers'] as $u) {
            $uName = ltrim(strtolower(trim((string)($u['username'] ?? ''))), '@');
            $uFull = strtolower(trim((string)($u['fullName'] ?? '')));
            $uCompact = preg_replace('/[^a-z0-9]/', '', $uFull);
            $uEmail = strtolower(trim((string)($u['email'] ?? '')));
            if (
                $uName === $rawInput ||
                $uName === $cleanCompact ||
                $uFull === $rawInput ||
                $uCompact === $cleanCompact ||
                $uEmail === $rawInput ||
                (($u['id'] ?? '') === 'usr-owner-1' && in_array($cleanCompact, ['admin', 'owner', 'abdulrehman'], true))
            ) {
                $matched = $u;
                break;
            }
        }
        if (!$matched) {
            sendJson(['success' => false, 'error' => 'Account not found. Enter "admin" for Owner or a valid staff username.'], 401);
        }
        if (($matched['status'] ?? 'active') !== 'active') {
            sendJson(['success' => false, 'error' => 'This staff account is deactivated.'], 403);
        }
        $expectedPass = ($matched['id'] === 'usr-owner-1') ? trim((string)($matched['password'] ?? 'admin')) : trim((string)($matched['password'] ?? ''));
        if ($expectedPass !== '' && $cleanPass !== $expectedPass && hashPasswordStr($cleanPass) !== ($matched['passwordHash'] ?? '')) {
            sendJson(['success' => false, 'error' => 'Incorrect password.'], 401);
        }

        foreach ($db['staffMembers'] as &$u) {
            if ($u['id'] === $matched['id']) {
                $u['lastLogin'] = gmdate('c');
                $matched = $u;
            }
        }
        unset($u);
        $saved = writeDatabase($sqliteFile, $db);
        $matched['permissions'] = normalizeUserPermissions($matched['permissions'] ?? null, (string)($matched['role'] ?? 'staff'));
        sendJson(['success' => true, 'user' => $matched, 'staffMembers' => $saved['staffMembers']]);
    }

    if ($method === 'POST' && $route === '/auth/pin-login') {
        $body = readJsonBody();
        $pin = trim((string)($body['pin'] ?? ''));
        $uname = strtolower(trim((string)($body['username'] ?? '')));
        if ($pin === '') sendJson(['success' => false, 'error' => 'PIN is required'], 400);

        $db = readDatabase($sqliteFile);
        $matched = null;
        foreach ($db['staffMembers'] as $u) {
            if (($u['id'] ?? '') === 'usr-owner-1') continue;
            if ((string)($u['pin'] ?? '') === $pin) {
                if ($uname === '' || strtolower($u['id']) === $uname || strtolower($u['username']) === $uname || strtolower($u['fullName']) === $uname) {
                    $matched = $u;
                    break;
                }
            }
        }
        if (!$matched) sendJson(['success' => false, 'error' => 'Invalid 4-digit PIN'], 401);
        if (($matched['status'] ?? 'active') !== 'active') sendJson(['success' => false, 'error' => 'Account is deactivated'], 403);
        foreach ($db['staffMembers'] as &$u) {
            if ($u['id'] === $matched['id']) {
                $u['lastLogin'] = gmdate('c');
                $matched = $u;
            }
        }
        unset($u);
        $saved = writeDatabase($sqliteFile, $db);
        $matched['permissions'] = normalizeUserPermissions($matched['permissions'] ?? null, (string)($matched['role'] ?? 'staff'));
        sendJson(['success' => true, 'user' => $matched, 'staffMembers' => $saved['staffMembers']]);
    }

    sendJson(['success' => false, 'error' => 'API endpoint not found: ' . $route], 404);
} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
