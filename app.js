// Global state
let parsedData = [];
let headers = [];
let rowFieldCount = 1;
let audienceData = [];
let audienceEmisoras = [];
let audienceRegions = [];
let emisoraMapping = {}; // TXT emisora -> Excel emisora
let hasAudienceData = false;
let currentEditingEmisora = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const audienceUploadSection = document.getElementById('audienceUploadSection');
const audienceDropZone = document.getElementById('audienceDropZone');
const audienceFileInput = document.getElementById('audienceFileInput');
const mappingSection = document.getElementById('mappingSection');
const configSection = document.getElementById('configSection');
const resultsSection = document.getElementById('resultsSection');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const rowCount = document.getElementById('rowCount');
const generateBtn = document.getElementById('generateBtn');
const exportExcel = document.getElementById('exportExcel');
const newAnalysis = document.getElementById('newAnalysis');
const addRowField = document.getElementById('addRowField');
const rowFieldsContainer = document.getElementById('rowFieldsContainer');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // File upload events - Step 1
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Audience file upload events - Step 2
    audienceDropZone.addEventListener('click', () => audienceFileInput.click());
    audienceDropZone.addEventListener('dragover', handleDragOver);
    audienceDropZone.addEventListener('dragleave', handleDragLeave);
    audienceDropZone.addEventListener('drop', handleAudienceDrop);
    audienceFileInput.addEventListener('change', handleAudienceFileSelect);

    // Step 2 navigation
    document.getElementById('continueWithAudienceBtn').addEventListener('click', showMappingSection);

    // Mapping validation - Step 2.5
    document.getElementById('backToAudienceBtn').addEventListener('click', () => {
        mappingSection.classList.add('hidden');
        audienceUploadSection.classList.remove('hidden');
    });
    document.getElementById('confirmMappingBtn').addEventListener('click', confirmMappingAndContinue);

    // Modal events
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalSaveBtn').addEventListener('click', saveModalMapping);

    // Configuration events - Step 3
    generateBtn.addEventListener('click', generatePivotTable);
    addRowField.addEventListener('click', addRowFieldSelect);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    // Results events - Step 4
    exportExcel.addEventListener('click', exportToExcel);
    newAnalysis.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        configSection.classList.remove('hidden');
        updateStepIndicator(3);
    });
}

// Step indicator update
function updateStepIndicator(step) {
    for (let i = 1; i <= 4; i++) {
        const circle = document.getElementById(`step${i}Circle`);
        if (i < step) {
            circle.className = 'w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium';
        } else if (i === step) {
            circle.className = 'w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-medium';
        } else {
            circle.className = 'w-8 h-8 rounded-full bg-slate-600 text-slate-400 flex items-center justify-center text-sm font-medium';
        }
    }
}

// Drag and Drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

// Audience file handlers
function handleAudienceDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processAudienceFile(files[0]);
    }
}

function handleAudienceFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processAudienceFile(files[0]);
    }
}

// File processing - Step 1
function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        alert('Por favor selecciona un archivo TXT');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        parseData(content);

        // Update UI
        fileName.textContent = file.name;
        rowCount.textContent = `(${parsedData.length.toLocaleString()} registros)`;
        fileInfo.classList.remove('hidden');

        // Move to Step 2
        uploadSection.classList.add('hidden');
        audienceUploadSection.classList.remove('hidden');
        updateStepIndicator(2);
    };
    reader.readAsText(file, 'UTF-8');
}

// Parse pipe-delimited data
function parseData(content) {
    const lines = content.split('\n').filter(line => line.trim());

    // Find header line (starts with #|)
    let headerLineIndex = lines.findIndex(line => line.startsWith('#|'));
    if (headerLineIndex === -1) {
        headerLineIndex = lines.findIndex(line => (line.match(/\|/g) || []).length > 10);
    }

    if (headerLineIndex === -1) {
        alert('No se encontró la línea de encabezados');
        return;
    }

    // Parse headers
    const headerLine = lines[headerLineIndex];
    headers = headerLine.split('|').map(h => {
        let header = h.trim().replace(/^#/, '');
        // Normalize region column name for consistent matching
        if (header === 'REGION/ÁMBITO' || header === 'REGION/AMBITO') {
            header = 'REGION';
        }
        return header;
    });

    // Add computed fields
    headers.push('AÑO');
    headers.push('MES');
    headers.push('MES_NOMBRE');

    // Parse data rows
    parsedData = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const values = line.split('|').map(v => v.trim());
        if (values.length < headers.length - 3) continue;

        const row = {};
        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        // Compute year and month from DIA field
        const dateField = row['DIA'] || '';
        if (dateField) {
            const dateParts = dateField.split('/');
            if (dateParts.length === 3) {
                row['AÑO'] = dateParts[2];
                row['MES'] = dateParts[1];
                row['MES_NOMBRE'] = getMonthName(parseInt(dateParts[1]));
            }
        }

        parsedData.push(row);
    }
}

function getMonthName(month) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1] || '';
}

// Audience file processing - Step 2
function processAudienceFile(file) {
    if (!file.name.match(/\.xlsx?$/i)) {
        alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Find the header row (look for "Emisora" or "Rnkg" in the first 10 rows)
        let headerRowIndex = 0;
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let row = 0; row <= Math.min(10, range.e.r); row++) {
            for (let col = 0; col <= Math.min(5, range.e.c); col++) {
                const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                const cell = worksheet[cellRef];
                if (cell && cell.v) {
                    const value = cell.v.toString().toLowerCase().trim();
                    if (value === 'emisora' || value === 'rnkg') {
                        headerRowIndex = row;
                        console.log('Found header row at index:', headerRowIndex);
                        break;
                    }
                }
            }
            if (headerRowIndex > 0) break;
        }

        // Convert to JSON starting from the header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            range: headerRowIndex,  // Start from the header row
            defval: ''  // Default value for empty cells
        });

        console.log('Parsed JSON columns:', Object.keys(jsonData[0] || {}));
        console.log('First data row:', jsonData[0]);

        if (jsonData.length === 0) {
            alert('El archivo Excel está vacío');
            return;
        }

        // Process audience data
        parseAudienceData(jsonData);

        // Update UI
        document.getElementById('audienceFileName').textContent = file.name;
        document.getElementById('audienceFileInfo').classList.remove('hidden');
        document.getElementById('continueWithAudienceBtn').classList.remove('hidden');

        // Change dropzone appearance
        audienceDropZone.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="w-14 h-14 bg-emerald-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <svg class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <p class="text-lg font-medium text-emerald-400 mb-1">${file.name}</p>
                <p class="text-sm text-slate-400">${audienceEmisoras.length} emisoras, ${audienceRegions.length} regiones</p>
            </div>
        `;
    };
    reader.readAsArrayBuffer(file);
}

function parseAudienceData(jsonData) {
    audienceData = [];
    audienceEmisoras = [];
    audienceRegions = [];

    const firstRow = jsonData[0];
    const keys = Object.keys(firstRow);

    console.log('Excel columns:', keys);
    console.log('First row data:', firstRow);

    // Known city/region names to look for
    const knownRegions = ['AREQUIPA', 'CHICLAYO', 'CUSCO', 'HUANCAYO', 'PIURA', 'TRUJILLO', 'LIMA', 'ICA', 'TACNA', 'PUNO'];

    // Columns to skip (not emisoras, not regions)
    const skipColumns = ['rnkg', 'ranking', 'frc', 'frc.', '%', 'miles', 'frecuencia'];

    // Find emisora column by these criteria:
    // 1. Named "Emisora" (case insensitive)
    // 2. Contains mostly text values (not numbers)
    // 3. Not a known region or metadata column
    let emisoraKey = null;

    // First try: exact match for "Emisora"
    emisoraKey = keys.find(k => k.toLowerCase().trim() === 'emisora');

    // Second try: contains "emisora"
    if (!emisoraKey) {
        emisoraKey = keys.find(k => k.toLowerCase().includes('emisora'));
    }

    // Third try: find column with text values that are NOT numbers and NOT regions
    if (!emisoraKey) {
        emisoraKey = keys.find(k => {
            const keyLower = k.toLowerCase().trim();
            const keyUpper = k.toUpperCase().trim();

            // Skip known non-emisora columns
            if (skipColumns.includes(keyLower)) return false;
            if (knownRegions.some(r => keyUpper.includes(r))) return false;

            // Check if most values in this column are text (not numbers)
            const textCount = jsonData.filter(row => {
                const val = row[k];
                if (!val) return false;
                const strVal = val.toString().trim();
                // Is text if it contains letters and is not just a number
                return /[a-zA-Z]/.test(strVal) && isNaN(parseFloat(strVal));
            }).length;

            // If more than half the rows have text values, this might be the emisora column
            return textCount > jsonData.length * 0.3;
        });
    }

    if (!emisoraKey) {
        alert('No se encontró la columna de Emisoras en el Excel. Asegúrate de que exista una columna con nombres de emisoras.');
        console.error('Could not find emisora column. Keys:', keys);
        return;
    }

    console.log('Detected emisora column:', emisoraKey);

    // Get region columns - look for known city names
    const regionKeys = keys.filter(k => {
        const keyUpper = k.toUpperCase().trim();
        const keyLower = k.toLowerCase().trim();

        // Skip known non-region columns
        if (keyLower === emisoraKey.toLowerCase()) return false;
        if (skipColumns.includes(keyLower)) return false;

        // Include if it matches a known region name
        return knownRegions.some(region => keyUpper.includes(region));
    });

    console.log('Detected region columns:', regionKeys);

    // Normalize region names to uppercase
    audienceRegions = regionKeys.map(r => r.toUpperCase().trim());

    // Process each row
    jsonData.forEach(row => {
        const emisora = row[emisoraKey];
        // Skip header rows, empty rows, or summary rows
        if (!emisora) return;

        const emisoraStr = emisora.toString().trim();

        // Skip non-emisora values (numbers, summary labels)
        if (!emisoraStr) return;
        if (/^\d+$/.test(emisoraStr)) return; // Skip if just a number
        if (emisoraStr.toLowerCase().includes('audiencia')) return;
        if (emisoraStr.toLowerCase().includes('promedio')) return;
        if (emisoraStr.toLowerCase() === 'total') return;

        const emisoraNormalized = emisora.toString().trim();
        audienceEmisoras.push(emisoraNormalized);

        const audienceRow = {
            emisora: emisoraNormalized,
            values: {}
        };

        regionKeys.forEach((key, index) => {
            const value = parseFloat(row[key]) || 0;
            audienceRow.values[audienceRegions[index]] = value;
        });

        audienceData.push(audienceRow);
    });

    hasAudienceData = true;

    // Create initial mapping
    createInitialMapping();
}

// Fuzzy matching algorithm
function normalizeString(str) {
    return str
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        // Remove common radio suffixes
        .replace(/\s*(FM|AM|F\.M\.|A\.M\.)\s*/g, '')
        .replace(/[^A-Z0-9]/g, '') // Keep only alphanumeric
        .trim();
}

// Normalize emisora name for better matching
function normalizeEmisoraName(name) {
    return name
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        // Remove common radio suffixes
        .replace(/\s*(FM|AM|F\.M\.|A\.M\.)\s*$/g, '')
        .replace(/\./g, '') // Remove dots (R.P.P. -> RPP)
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

function calculateSimilarity(str1, str2) {
    // First try with emisora-specific normalization
    const emisora1 = normalizeEmisoraName(str1);
    const emisora2 = normalizeEmisoraName(str2);

    // Exact match after emisora normalization (e.g., "LA ZONA FM" vs "La Zona")
    if (emisora1 === emisora2) return 100;

    // Now use general string normalization
    const norm1 = normalizeString(str1);
    const norm2 = normalizeString(str2);

    // Exact match after normalization
    if (norm1 === norm2) return 100;

    // Check if one contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        const longer = Math.max(norm1.length, norm2.length);
        const shorter = Math.min(norm1.length, norm2.length);
        return Math.round((shorter / longer) * 100);
    }

    // Check with emisora names too
    if (emisora1.includes(emisora2) || emisora2.includes(emisora1)) {
        const longer = Math.max(emisora1.length, emisora2.length);
        const shorter = Math.min(emisora1.length, emisora2.length);
        return Math.round((shorter / longer) * 100);
    }

    // Levenshtein distance on normalized strings
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 100;

    const distance = levenshteinDistance(norm1, norm2);
    return Math.round((1 - distance / maxLen) * 100);
}

function findBestMatch(txtEmisora) {
    let bestMatch = null;
    let bestScore = 0;

    audienceEmisoras.forEach(excelEmisora => {
        const score = calculateSimilarity(txtEmisora, excelEmisora);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = excelEmisora;
        }
    });

    return { match: bestMatch, score: bestScore };
}

function createInitialMapping() {
    emisoraMapping = {};

    // Get unique emisoras from TXT data
    const txtEmisoras = [...new Set(parsedData.map(row => row['EMISORA/SITE']).filter(e => e))];

    txtEmisoras.forEach(txtEmisora => {
        const { match, score } = findBestMatch(txtEmisora);
        emisoraMapping[txtEmisora] = {
            excelEmisora: match,
            score: score,
            confirmed: score >= 80
        };
    });
}

// Mapping UI
function showMappingSection() {
    audienceUploadSection.classList.add('hidden');
    mappingSection.classList.remove('hidden');
    renderMappingTable();
}

function renderMappingTable() {
    const tbody = document.getElementById('mappingTableBody');
    tbody.innerHTML = '';

    // Sort by score (lowest first so they're easier to fix)
    const sortedEmisoras = Object.entries(emisoraMapping)
        .sort((a, b) => a[1].score - b[1].score);

    sortedEmisoras.forEach(([txtEmisora, mapping]) => {
        const matchClass = mapping.score >= 80 ? 'match-high' :
                          mapping.score >= 50 ? 'match-medium' : 'match-low';

        const row = document.createElement('tr');
        row.className = `border-b border-slate-700/30 ${matchClass}`;
        row.innerHTML = `
            <td class="px-4 py-3 text-slate-300">${txtEmisora}</td>
            <td class="px-4 py-3 text-white font-medium">${mapping.excelEmisora || '(sin mapeo)'}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded text-xs ${
                    mapping.score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                    mapping.score >= 50 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                }">${mapping.score}%</span>
            </td>
            <td class="px-4 py-3">
                <button class="text-primary-400 hover:text-primary-300 text-sm" onclick="openEditModal('${txtEmisora.replace(/'/g, "\\'")}')">
                    Editar
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openEditModal(txtEmisora) {
    currentEditingEmisora = txtEmisora;
    document.getElementById('modalTxtEmisora').textContent = txtEmisora;

    const select = document.getElementById('modalEmisoraSelect');
    select.innerHTML = '<option value="">(Sin mapeo)</option>';

    audienceEmisoras.forEach(emisora => {
        const option = document.createElement('option');
        option.value = emisora;
        option.textContent = emisora;
        if (emisoraMapping[txtEmisora]?.excelEmisora === emisora) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    document.getElementById('mappingModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('mappingModal').classList.add('hidden');
    currentEditingEmisora = null;
}

function saveModalMapping() {
    const select = document.getElementById('modalEmisoraSelect');
    const selectedEmisora = select.value;

    if (currentEditingEmisora) {
        if (selectedEmisora) {
            const score = calculateSimilarity(currentEditingEmisora, selectedEmisora);
            emisoraMapping[currentEditingEmisora] = {
                excelEmisora: selectedEmisora,
                score: 100, // Manual selection = 100%
                confirmed: true
            };
        } else {
            emisoraMapping[currentEditingEmisora] = {
                excelEmisora: null,
                score: 0,
                confirmed: true
            };
        }
        renderMappingTable();
    }

    closeModal();
}

function confirmMappingAndContinue() {
    mappingSection.classList.add('hidden');
    configSection.classList.remove('hidden');
    document.getElementById('audienceToggle').classList.remove('hidden');
    populateFieldSelectors();
    updateStepIndicator(3);
}

// Populate field selectors
function populateFieldSelectors() {
    const selects = document.querySelectorAll('#rowFieldsContainer select, #valueField');

    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecciona campo...</option>';

        headers.forEach(header => {
            if (header) {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            }
        });

        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// Add row field selector
function addRowFieldSelect() {
    rowFieldCount++;
    const select = document.createElement('select');
    select.id = `rowField${rowFieldCount}`;
    select.className = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center space-x-2';
    wrapper.appendChild(select);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'text-red-400 hover:text-red-300';
    removeBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    removeBtn.onclick = () => wrapper.remove();
    wrapper.appendChild(removeBtn);

    rowFieldsContainer.appendChild(wrapper);
    populateFieldSelectors();
}

// Apply presets
function applyPreset(preset) {
    // Clear existing row fields except first
    const existingFields = rowFieldsContainer.querySelectorAll('div');
    existingFields.forEach(div => div.remove());
    rowFieldCount = 1;

    const rowField1 = document.getElementById('rowField1');
    const valueField = document.getElementById('valueField');
    const aggregationType = document.getElementById('aggregationType');

    switch(preset) {
        case 'yearMonthRegionEmisora':
            rowField1.value = 'AÑO';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'MES_NOMBRE';
            addRowFieldSelect();
            document.getElementById('rowField3').value = 'REGION';
            addRowFieldSelect();
            document.getElementById('rowField4').value = 'EMISORA/SITE';
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'regionEmisora':
            rowField1.value = 'REGION';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'EMISORA/SITE';
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'medioEmisora':
            rowField1.value = 'MEDIO';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'EMISORA/SITE';
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'marcaProducto':
            rowField1.value = 'MARCA';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'PRODUCTO';
            valueField.value = 'INVERSION';
            aggregationType.value = 'sum';
            break;
    }
}

// Get audience value for a region/emisora combination
function getAudienceValue(region, emisora) {
    if (!hasAudienceData) return null;

    // Normalize region
    const normalizedRegion = region?.toUpperCase().trim();

    // Get mapped emisora
    const mapping = emisoraMapping[emisora];

    // Debug logging (first few calls only)
    if (!window._audienceDebugCount) window._audienceDebugCount = 0;
    if (window._audienceDebugCount < 5) {
        console.log('getAudienceValue debug:', {
            region,
            normalizedRegion,
            emisora,
            mapping,
            availableRegions: audienceRegions,
            availableEmisoras: audienceEmisoras.slice(0, 5)
        });
        window._audienceDebugCount++;
    }

    if (!mapping || !mapping.excelEmisora) return null;

    // Find audience data
    const audienceRow = audienceData.find(a => a.emisora === mapping.excelEmisora);
    if (!audienceRow) {
        console.log('No audienceRow found for:', mapping.excelEmisora);
        return null;
    }

    // Find matching region
    const value = audienceRow.values[normalizedRegion];
    if (value === undefined && window._audienceDebugCount < 10) {
        console.log('Region not found:', normalizedRegion, 'Available:', Object.keys(audienceRow.values));
    }
    return value !== undefined ? value : null;
}

// Generate pivot table
function generatePivotTable() {
    // Get selected fields
    const rowFields = [];
    for (let i = 1; i <= rowFieldCount; i++) {
        const select = document.getElementById(`rowField${i}`);
        if (select && select.value) {
            rowFields.push(select.value);
        }
    }

    const valueField = document.getElementById('valueField').value;
    const aggregationType = document.getElementById('aggregationType').value;
    const includeAudience = hasAudienceData; // Always include audience when data is loaded

    if (rowFields.length === 0) {
        alert('Selecciona al menos un campo para las filas');
        return;
    }

    // Show loading
    configSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('pivotTable').classList.add('hidden');
    updateStepIndicator(4);

    // Process in next tick to allow UI update
    setTimeout(() => {
        const pivotData = createPivotData(rowFields, valueField, aggregationType, includeAudience);
        renderPivotTable(rowFields, valueField, aggregationType, pivotData, includeAudience);

        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('pivotTable').classList.remove('hidden');
    }, 100);
}

// Create pivot data structure
function createPivotData(rowFields, valueField, aggregationType, includeAudience) {
    const pivot = new Map();

    // Check if we have region and emisora fields for audience lookup
    const regionFieldIndex = rowFields.indexOf('REGION');
    const emisoraFieldIndex = rowFields.indexOf('EMISORA/SITE');

    parsedData.forEach(row => {
        // Create key from row fields
        const keyParts = rowFields.map(field => row[field] || '(vacío)');
        const key = keyParts.join('|||');

        if (!pivot.has(key)) {
            pivot.set(key, {
                keys: keyParts,
                values: [],
                count: 0,
                region: regionFieldIndex >= 0 ? keyParts[regionFieldIndex] : null,
                emisora: emisoraFieldIndex >= 0 ? keyParts[emisoraFieldIndex] : null
            });
        }

        const entry = pivot.get(key);
        entry.count++;

        if (valueField) {
            const val = parseFloat(row[valueField]) || 0;
            entry.values.push(val);
        }
    });

    // Calculate aggregations
    const result = [];
    pivot.forEach((entry, key) => {
        let aggregatedValue;

        switch(aggregationType) {
            case 'sum':
                aggregatedValue = entry.values.reduce((a, b) => a + b, 0);
                break;
            case 'count':
                aggregatedValue = entry.count;
                break;
            case 'average':
                aggregatedValue = entry.values.length > 0
                    ? entry.values.reduce((a, b) => a + b, 0) / entry.values.length
                    : 0;
                break;
            case 'min':
                aggregatedValue = entry.values.length > 0 ? Math.min(...entry.values) : 0;
                break;
            case 'max':
                aggregatedValue = entry.values.length > 0 ? Math.max(...entry.values) : 0;
                break;
            default:
                aggregatedValue = entry.count;
        }

        // Get audience value if applicable
        let audienceValue = null;
        if (includeAudience && entry.region && entry.emisora) {
            audienceValue = getAudienceValue(entry.region, entry.emisora);
        }

        result.push({
            keys: entry.keys,
            value: aggregatedValue,
            count: entry.count,
            audienceValue: audienceValue
        });
    });

    // Sort by keys
    result.sort((a, b) => {
        for (let i = 0; i < a.keys.length; i++) {
            const comparison = String(a.keys[i]).localeCompare(String(b.keys[i]));
            if (comparison !== 0) return comparison;
        }
        return 0;
    });

    return result;
}

// Render pivot table
function renderPivotTable(rowFields, valueField, aggregationType, pivotData, includeAudience) {
    const thead = document.getElementById('pivotHead');
    const tbody = document.getElementById('pivotBody');
    const tfoot = document.getElementById('pivotFoot');

    // Get aggregation label
    const aggLabels = {
        'sum': 'Suma',
        'count': 'Conteo',
        'average': 'Promedio',
        'min': 'Mínimo',
        'max': 'Máximo'
    };
    const valueLabel = valueField
        ? `${aggLabels[aggregationType]} de ${valueField}`
        : 'Conteo';

    // Build header
    let headerHtml = '<tr>';
    rowFields.forEach(field => {
        headerHtml += `<th class="px-4 py-3 text-slate-300 font-semibold">${field}</th>`;
    });
    headerHtml += `<th class="px-4 py-3 text-slate-300 font-semibold text-right">${valueLabel}</th>`;
    if (includeAudience) {
        headerHtml += `<th class="px-4 py-3 text-emerald-300 font-semibold text-right">Audiencia</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Build body with row grouping
    let html = '';
    let prevKeys = [];
    let grandTotal = 0;

    pivotData.forEach((row, index) => {
        html += '<tr class="border-b border-slate-700/30 hover:bg-slate-700/20">';

        row.keys.forEach((key, keyIndex) => {
            // Check if this key is same as previous row
            const isSame = prevKeys[keyIndex] === key &&
                           row.keys.slice(0, keyIndex).every((k, i) => k === prevKeys[i]);

            if (isSame && keyIndex < row.keys.length - 1) {
                html += `<td class="px-4 py-2 text-slate-500"></td>`;
            } else {
                const indent = keyIndex > 0 ? `padding-left: ${keyIndex * 20 + 16}px` : '';
                html += `<td class="px-4 py-2 text-slate-300" style="${indent}">${key}</td>`;
            }
        });

        // Value cell
        const formattedValue = formatNumber(row.value, aggregationType);
        html += `<td class="px-4 py-2 text-right text-white font-medium">${formattedValue}</td>`;

        // Audience cell
        if (includeAudience) {
            if (row.audienceValue !== null) {
                html += `<td class="px-4 py-2 text-right text-emerald-400 font-medium">${row.audienceValue.toFixed(2)}</td>`;
            } else {
                html += `<td class="px-4 py-2 text-right text-slate-600">-</td>`;
            }
        }

        html += '</tr>';

        grandTotal += row.value;
        prevKeys = [...row.keys];
    });

    tbody.innerHTML = html;

    // Build footer with total
    let footerColspan = rowFields.length;
    let footerHtml = `
        <tr class="border-t-2 border-slate-600">
            <td colspan="${footerColspan}" class="px-4 py-3 text-slate-300 font-bold">TOTAL</td>
            <td class="px-4 py-3 text-right text-white font-bold">${formatNumber(grandTotal, aggregationType)}</td>
    `;
    if (includeAudience) {
        footerHtml += `<td class="px-4 py-3 text-right text-slate-500">-</td>`;
    }
    footerHtml += '</tr>';
    tfoot.innerHTML = footerHtml;

    // Update summary
    document.getElementById('resultsSummary').textContent =
        `${pivotData.length.toLocaleString()} filas agrupadas de ${parsedData.length.toLocaleString()} registros` +
        (includeAudience ? ' (con datos de audiencia)' : '');
}

function formatNumber(value, aggregationType) {
    if (aggregationType === 'count') {
        return Math.round(value).toLocaleString();
    }
    if (aggregationType === 'average') {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Export to Excel
function exportToExcel() {
    const table = document.getElementById('pivotTable');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);

    XLSX.utils.book_append_sheet(wb, ws, 'Tabla Dinámica');
    XLSX.writeFile(wb, 'tabla_dinamica.xlsx');
}

// Make functions globally accessible for onclick handlers
window.openEditModal = openEditModal;
