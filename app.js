// Global state
let parsedData = [];
let headers = [];
let rowFieldCount = 1;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
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
    // File upload events
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Configuration events
    generateBtn.addEventListener('click', generatePivotTable);
    addRowField.addEventListener('click', addRowFieldSelect);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });

    // Results events
    exportExcel.addEventListener('click', exportToExcel);
    newAnalysis.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        configSection.classList.remove('hidden');
    });
}

// Drag and Drop handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
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

// File processing
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

        uploadSection.classList.add('hidden');
        configSection.classList.remove('hidden');

        populateFieldSelectors();
    };
    reader.readAsText(file, 'UTF-8');
}

// Parse pipe-delimited data
function parseData(content) {
    const lines = content.split('\n').filter(line => line.trim());

    // Find header line (starts with #|)
    let headerLineIndex = lines.findIndex(line => line.startsWith('#|'));
    if (headerLineIndex === -1) {
        // Try to find any line with many pipes
        headerLineIndex = lines.findIndex(line => (line.match(/\|/g) || []).length > 10);
    }

    if (headerLineIndex === -1) {
        alert('No se encontró la línea de encabezados');
        return;
    }

    // Parse headers
    const headerLine = lines[headerLineIndex];
    headers = headerLine.split('|').map(h => h.trim().replace(/^#/, ''));

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
        if (values.length < headers.length - 3) continue; // -3 for computed fields

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
        case 'yearMonthRegion':
            rowField1.value = 'AÑO';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'MES_NOMBRE';
            addRowFieldSelect();
            document.getElementById('rowField3').value = 'REGION/ÁMBITO';
            addRowFieldSelect();
            document.getElementById('rowField4').value = 'EMISORA/SITE';
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
        case 'sectorCategoria':
            rowField1.value = 'SECTOR';
            addRowFieldSelect();
            document.getElementById('rowField2').value = 'CATEGORIA';
            valueField.value = '';
            aggregationType.value = 'count';
            break;
    }
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

    if (rowFields.length === 0) {
        alert('Selecciona al menos un campo para las filas');
        return;
    }

    // Show loading
    configSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('pivotTable').classList.add('hidden');

    // Process in next tick to allow UI update
    setTimeout(() => {
        const pivotData = createPivotData(rowFields, valueField, aggregationType);
        renderPivotTable(rowFields, valueField, aggregationType, pivotData);

        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('pivotTable').classList.remove('hidden');
    }, 100);
}

// Create pivot data structure
function createPivotData(rowFields, valueField, aggregationType) {
    const pivot = new Map();

    parsedData.forEach(row => {
        // Create key from row fields
        const keyParts = rowFields.map(field => row[field] || '(vacío)');
        const key = keyParts.join('|||');

        if (!pivot.has(key)) {
            pivot.set(key, {
                keys: keyParts,
                values: [],
                count: 0
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

        result.push({
            keys: entry.keys,
            value: aggregatedValue,
            count: entry.count
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
function renderPivotTable(rowFields, valueField, aggregationType, pivotData) {
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
    thead.innerHTML = `
        <tr>
            ${rowFields.map(field => `<th class="px-4 py-3 text-slate-300 font-semibold">${field}</th>`).join('')}
            <th class="px-4 py-3 text-slate-300 font-semibold text-right">${valueLabel}</th>
        </tr>
    `;

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
        html += '</tr>';

        grandTotal += row.value;
        prevKeys = [...row.keys];
    });

    tbody.innerHTML = html;

    // Build footer with total
    tfoot.innerHTML = `
        <tr class="border-t-2 border-slate-600">
            <td colspan="${rowFields.length}" class="px-4 py-3 text-slate-300 font-bold">TOTAL</td>
            <td class="px-4 py-3 text-right text-white font-bold">${formatNumber(grandTotal, aggregationType)}</td>
        </tr>
    `;

    // Update summary
    document.getElementById('resultsSummary').textContent =
        `${pivotData.length.toLocaleString()} filas agrupadas de ${parsedData.length.toLocaleString()} registros`;
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
