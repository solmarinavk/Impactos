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

    // Initialize drag and drop for row fields
    initDragAndDrop();
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
        // Normalize region column name for consistent matching (handle encoding issues)
        // Match any variation: REGION/ÁMBITO, REGION/AMBITO, REGION/�MBITO, etc.
        if (header.toUpperCase().startsWith('REGION/') || header.toUpperCase().includes('MBITO')) {
            header = 'REGION';
        }
        return header;
    });

    // Add computed fields
    headers.push('AÑO');
    headers.push('MES');
    headers.push('MES_NOMBRE');
    headers.push('SEMANA');

    // Parse data rows
    parsedData = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const values = line.split('|').map(v => v.trim());
        if (values.length < headers.length - 4) continue; // -4 for computed fields

        const row = {};
        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        // Compute year, month and week from DIA field
        const dateField = row['DIA'] || '';
        if (dateField) {
            const dateParts = dateField.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]);
                const year = parseInt(dateParts[2]);

                row['AÑO'] = dateParts[2];
                row['MES'] = dateParts[1];
                row['MES_NOMBRE'] = getMonthName(month);
                row['SEMANA'] = getWeekNumber(year, month, day);
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

// Get ISO week number (weeks start on Monday)
function getWeekNumber(year, month, day) {
    const date = new Date(year, month - 1, day);
    // Set to nearest Thursday: current date + 4 - current day number (Monday = 1)
    const dayNum = date.getDay() || 7; // Convert Sunday (0) to 7
    date.setDate(date.getDate() + 4 - dayNum);
    // Get first day of year
    const yearStart = new Date(date.getFullYear(), 0, 1);
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `Sem ${weekNo}`;
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

    // Find Frc. column (frequency) for differentiating duplicates like "Otras Emisoras"
    const frcKey = keys.find(k => {
        const keyLower = k.toLowerCase().trim();
        return keyLower === 'frc' || keyLower === 'frc.' || keyLower === 'frecuencia';
    });
    console.log('Detected frequency column:', frcKey);

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

        let emisoraStr = emisora.toString().trim();

        // Skip non-emisora values (numbers, summary labels)
        if (!emisoraStr) return;
        if (/^\d+$/.test(emisoraStr)) return; // Skip if just a number
        if (emisoraStr.toLowerCase().includes('audiencia')) return;
        if (emisoraStr.toLowerCase().includes('promedio')) return;
        if (emisoraStr.toLowerCase() === 'total') return;

        // For "Otras Emisoras" or similar duplicates, append frequency (AM/FM)
        if (frcKey && emisoraStr.toLowerCase().includes('otras emisoras')) {
            const frc = row[frcKey];
            if (frc) {
                const frcStr = frc.toString().trim().toUpperCase();
                if (frcStr === 'AM' || frcStr === 'FM' || frcStr === 'FM/AM') {
                    emisoraStr = `${emisoraStr}-${frcStr}`;
                }
            }
        }

        audienceEmisoras.push(emisoraStr);

        const audienceRow = {
            emisora: emisoraStr,
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
    setupBulkMappingEvents();
    populateBulkEmisoraSelect();
}

function setupBulkMappingEvents() {
    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllMapping');
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.mapping-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBulkSelectionUI();
    });

    // Apply bulk button
    document.getElementById('applyBulkBtn').addEventListener('click', applyBulkMapping);

    // Clear selection button
    document.getElementById('clearSelectionBtn').addEventListener('click', () => {
        document.querySelectorAll('.mapping-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('selectAllMapping').checked = false;
        updateBulkSelectionUI();
    });
}

function populateBulkEmisoraSelect() {
    const select = document.getElementById('bulkEmisoraSelect');
    select.innerHTML = '<option value="">(Sin mapeo)</option>';
    audienceEmisoras.forEach(emisora => {
        const option = document.createElement('option');
        option.value = emisora;
        option.textContent = emisora;
        select.appendChild(option);
    });
}

function updateBulkSelectionUI() {
    const checkboxes = document.querySelectorAll('.mapping-checkbox:checked');
    const count = checkboxes.length;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('bulkAssignmentArea').classList.toggle('hidden', count === 0);
}

function applyBulkMapping() {
    const selectedEmisora = document.getElementById('bulkEmisoraSelect').value;
    const checkboxes = document.querySelectorAll('.mapping-checkbox:checked');

    checkboxes.forEach(cb => {
        const txtEmisora = cb.dataset.emisora;
        if (selectedEmisora) {
            emisoraMapping[txtEmisora] = {
                excelEmisora: selectedEmisora,
                score: 100,
                confirmed: true
            };
        } else {
            emisoraMapping[txtEmisora] = {
                excelEmisora: null,
                score: 0,
                confirmed: true
            };
        }
    });

    // Clear selection and re-render
    document.getElementById('selectAllMapping').checked = false;
    renderMappingTable();
    updateBulkSelectionUI();
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
            <td class="px-2 py-3">
                <input type="checkbox" class="mapping-checkbox w-4 h-4 rounded bg-slate-700 border-slate-600" data-emisora="${txtEmisora.replace(/"/g, '&quot;')}" onchange="updateBulkSelectionUI()">
            </td>
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

// Make updateBulkSelectionUI globally accessible
window.updateBulkSelectionUI = updateBulkSelectionUI;

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

    const wrapper = document.createElement('div');
    wrapper.className = 'row-field-item flex items-center space-x-2 bg-slate-700/30 rounded-lg p-1';
    wrapper.draggable = true;
    wrapper.dataset.fieldId = rowFieldCount;

    // Drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle px-1 text-slate-500 hover:text-slate-300';
    dragHandle.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path></svg>';
    wrapper.appendChild(dragHandle);

    // Select
    const select = document.createElement('select');
    select.id = `rowField${rowFieldCount}`;
    select.className = 'flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';
    wrapper.appendChild(select);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'text-red-400 hover:text-red-300 px-1';
    removeBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    removeBtn.onclick = () => wrapper.remove();
    wrapper.appendChild(removeBtn);

    // Add drag events
    addDragEventsToItem(wrapper);

    rowFieldsContainer.appendChild(wrapper);
    populateFieldSelectors();
}

// Drag and Drop functionality
let draggedItem = null;

function addDragEventsToItem(item) {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleItemDragOver);
    item.addEventListener('dragleave', handleItemDragLeave);
    item.addEventListener('drop', handleItemDrop);
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.row-field-item').forEach(item => {
        item.classList.remove('drag-over-item');
    });
    draggedItem = null;
}

function handleItemDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) {
        this.classList.add('drag-over-item');
    }
}

function handleItemDragLeave(e) {
    this.classList.remove('drag-over-item');
}

function handleItemDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over-item');

    if (draggedItem && this !== draggedItem) {
        const container = rowFieldsContainer;
        const items = [...container.querySelectorAll('.row-field-item')];
        const draggedIdx = items.indexOf(draggedItem);
        const targetIdx = items.indexOf(this);

        if (draggedIdx < targetIdx) {
            container.insertBefore(draggedItem, this.nextSibling);
        } else {
            container.insertBefore(draggedItem, this);
        }
    }
}

// Initialize drag events on page load
function initDragAndDrop() {
    document.querySelectorAll('.row-field-item').forEach(item => {
        addDragEventsToItem(item);
    });
}

// Apply presets
function applyPreset(preset) {
    // Clear all existing row fields
    rowFieldsContainer.innerHTML = '';
    rowFieldCount = 0;

    const valueField = document.getElementById('valueField');
    const aggregationType = document.getElementById('aggregationType');

    // Helper function to add a field with a value
    const addFieldWithValue = (value) => {
        addRowFieldSelect();
        const select = document.getElementById(`rowField${rowFieldCount}`);
        if (select) select.value = value;
    };

    switch(preset) {
        case 'yearMonthRegionEmisora':
            addFieldWithValue('AÑO');
            addFieldWithValue('MES_NOMBRE');
            addFieldWithValue('REGION');
            addFieldWithValue('EMISORA/SITE');
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'regionEmisora':
            addFieldWithValue('REGION');
            addFieldWithValue('EMISORA/SITE');
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'medioEmisora':
            addFieldWithValue('MEDIO');
            addFieldWithValue('EMISORA/SITE');
            valueField.value = 'SPOTS';
            aggregationType.value = 'sum';
            break;
        case 'marcaProducto':
            addFieldWithValue('MARCA');
            addFieldWithValue('PRODUCTO');
            valueField.value = 'INVERSION';
            aggregationType.value = 'sum';
            break;
        case 'yearMonthMarcaRegionEmisora':
            addFieldWithValue('AÑO');
            addFieldWithValue('MES_NOMBRE');
            addFieldWithValue('MARCA');
            addFieldWithValue('REGION');
            addFieldWithValue('EMISORA/SITE');
            valueField.value = 'SPOTS';
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
    // Get selected fields in DOM order (respects drag & drop reordering)
    const rowFields = [];
    const fieldItems = rowFieldsContainer.querySelectorAll('.row-field-item');
    fieldItems.forEach(item => {
        const select = item.querySelector('select');
        if (select && select.value) {
            rowFields.push(select.value);
        }
    });

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
    let headerHtml = '<tr class="bg-slate-800">';
    rowFields.forEach(field => {
        headerHtml += `<th class="px-4 py-3 text-slate-300 font-semibold text-left">${field}</th>`;
    });
    headerHtml += `<th class="px-4 py-3 text-slate-300 font-semibold text-right">${valueLabel}</th>`;
    if (includeAudience) {
        headerHtml += `<th class="px-4 py-3 text-emerald-300 font-semibold text-right">Audiencia</th>`;
        headerHtml += `<th class="px-4 py-3 text-amber-300 font-semibold text-right">Impactos (Miles)</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Build body - show all values in every row (no grouping)
    let html = '';
    let grandTotal = 0;
    let grandTotalImpactos = 0;

    pivotData.forEach((row, index) => {
        // Calculate impactos
        const impactos = (row.audienceValue !== null && row.value)
            ? row.audienceValue * row.value
            : null;

        // Alternate row colors for better readability
        const rowClass = index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10';
        html += `<tr class="border-b border-slate-700/30 hover:bg-slate-700/30 ${rowClass}">`;

        // Show all keys in every row (no visual grouping)
        row.keys.forEach((key) => {
            html += `<td class="px-4 py-2 text-slate-300">${key}</td>`;
        });

        // Value cell (Spots)
        const formattedValue = formatNumber(row.value, aggregationType);
        html += `<td class="px-4 py-2 text-right text-white font-medium">${formattedValue}</td>`;

        // Audience cell
        if (includeAudience) {
            if (row.audienceValue !== null) {
                html += `<td class="px-4 py-2 text-right text-emerald-400 font-medium">${row.audienceValue.toFixed(2)}</td>`;
            } else {
                html += `<td class="px-4 py-2 text-right text-slate-600">-</td>`;
            }

            // Impactos cell
            if (impactos !== null) {
                html += `<td class="px-4 py-2 text-right text-amber-400 font-bold">${impactos.toFixed(2)}</td>`;
                grandTotalImpactos += impactos;
            } else {
                html += `<td class="px-4 py-2 text-right text-slate-600">-</td>`;
            }
        }

        html += '</tr>';
        grandTotal += row.value;
    });

    tbody.innerHTML = html;

    // Build footer with totals
    let footerColspan = rowFields.length;
    let footerHtml = `
        <tr class="border-t-2 border-slate-600 bg-slate-700/50">
            <td colspan="${footerColspan}" class="px-4 py-3 text-slate-300 font-bold">TOTAL</td>
            <td class="px-4 py-3 text-right text-white font-bold">${formatNumber(grandTotal, aggregationType)}</td>
    `;
    if (includeAudience) {
        footerHtml += `<td class="px-4 py-3 text-right text-slate-500">-</td>`;
        footerHtml += `<td class="px-4 py-3 text-right text-amber-400 font-bold">${grandTotalImpactos.toFixed(2)}</td>`;
    }
    footerHtml += '</tr>';
    tfoot.innerHTML = footerHtml;

    // Update summary
    document.getElementById('resultsSummary').textContent =
        `${pivotData.length.toLocaleString()} filas de ${parsedData.length.toLocaleString()} registros` +
        (includeAudience ? ' (con audiencia e impactos)' : '');
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

    // Create a clone of the table without the footer (TOTAL row)
    const tableClone = table.cloneNode(true);
    const tfoot = tableClone.querySelector('tfoot');
    if (tfoot) {
        tfoot.remove();
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(tableClone);

    // Get table dimensions
    const range = XLSX.utils.decode_range(ws['!ref']);
    const numCols = range.e.c + 1;

    // Add autofilter (creates filter dropdowns like a table)
    ws['!autofilter'] = { ref: ws['!ref'] };

    // Set column widths for better readability
    ws['!cols'] = [];
    for (let i = 0; i < numCols; i++) {
        ws['!cols'].push({ wch: 18 }); // 18 characters width
    }

    // Freeze first row (header)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, 'Impactos Radio');

    // Generate filename with date and time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const fileName = `Impactos Radio_${day}-${month}-${year}_${hours}${minutes}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Make functions globally accessible for onclick handlers
window.openEditModal = openEditModal;
