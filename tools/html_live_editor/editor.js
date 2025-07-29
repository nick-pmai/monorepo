let selectedCLI = 'gemini';
let currentFilePath = '';
let selectedElementDetails = null;
let currentBrowsePath = '';
const API_BASE = 'http://localhost:3000/api';

// Initialize
window.onload = function() {
    setupMessageListener();
};

// CLI Selection
function selectCLI(cli) {
    selectedCLI = cli;
    document.querySelectorAll('.cli-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById(cli + '-option').classList.add('selected');
}

// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.edit-section').forEach(s => s.classList.remove('active'));
    
    if (tab === 'page') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('page-section').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('component-section').classList.add('active');
    }
}

// Load File
async function loadFile() {
    const filePath = document.getElementById('filePath').value;
    if (!filePath) {
        updateStatus('Please enter a file path', true);
        return;
    }

    updateStatus('Loading file...');
    currentFilePath = filePath;

    try {
        // Use preview endpoint to load HTML with proper asset paths
        const iframe = document.getElementById('previewFrame');
        iframe.src = `${API_BASE}/preview?path=${encodeURIComponent(filePath)}`;
        
        // Inject the injector script when iframe loads
        iframe.onload = function() {
            try {
                const script = iframe.contentDocument.createElement('script');
                script.src = '/injector.js';
                iframe.contentDocument.head.appendChild(script);
            } catch (e) {
                console.error('Error injecting script:', e);
            }
        };
        
        updateStatus(`Loaded: ${filePath}`);
    } catch (error) {
        if (error.name === 'AbortError') {
            updateStatus('Error: Command timed out after 5 minutes', true);
        } else {
            updateStatus(`Error: ${error.message}`, true);
        }
    }
}

// Setup message listener for iframe communication
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        switch(data.type) {
            case 'elementCount':
                document.getElementById('elementCount').textContent = data.count;
                break;
                
            case 'elementHover':
                showElementOverlay(data);
                break;
                
            case 'elementOut':
                hideElementOverlay();
                break;
                
            case 'elementClick':
                selectElement(data);
                break;
        }
    });
}

// Show element overlay
function showElementOverlay(details) {
    const overlay = document.getElementById('element-overlay');
    const index = document.getElementById('element-index');
    const iframe = document.getElementById('previewFrame');
    const previewArea = document.getElementById('previewArea');
    
    // Get positions relative to viewport
    const iframeRect = iframe.getBoundingClientRect();
    const previewAreaRect = previewArea.getBoundingClientRect();
    
    // Calculate position relative to preview area (since overlay is inside it)
    // We need to subtract the preview area's position from the calculated position
    const left = iframeRect.left - previewAreaRect.left + details.rect.left;
    const top = iframeRect.top - previewAreaRect.top + details.rect.top;
    
    // Account for preview area's scroll position
    const scrollLeft = previewArea.scrollLeft;
    const scrollTop = previewArea.scrollTop;
    
    // Position overlay relative to preview area
    overlay.style.left = (left + scrollLeft) + 'px';
    overlay.style.top = (top + scrollTop) + 'px';
    overlay.style.width = details.rect.width + 'px';
    overlay.style.height = details.rect.height + 'px';
    overlay.style.display = 'block';
    
    index.textContent = details.index;
}

// Hide element overlay
function hideElementOverlay() {
    const overlay = document.getElementById('element-overlay');
    if (!overlay.classList.contains('selected')) {
        overlay.style.display = 'none';
    }
}

// Select element
function selectElement(details) {
    selectedElementDetails = details;
    
    // Show overlay as selected
    const overlay = document.getElementById('element-overlay');
    overlay.classList.add('selected');
    showElementOverlay(details);
    
    // Switch to component tab
    switchTab('component');
    
    // Fill in component index
    document.getElementById('componentIndex').value = details.index;
}

// Execute page edit
async function executePageEdit() {
    const instructions = document.getElementById('pageInstructions').value;
    if (!instructions) {
        updateStatus('Please enter instructions', true);
        return;
    }

    const command = `${selectedCLI} -p "Modify the following ${currentFilePath}. Instructions: ${instructions}"`;
    
    // Show command preview
    document.getElementById('pageCommandPreview').style.display = 'block';
    document.getElementById('pageCommandText').textContent = command;
    
    updateStatus('Executing command...');
    
    try {
        const response = await fetch(`${API_BASE}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cli: selectedCLI,
                filePath: currentFilePath,
                instructions: instructions
            }),
            // Add timeout for long-running AI commands
            signal: AbortSignal.timeout(300000) // 5 minute timeout
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        const result = await response.json();
        
        updateStatus('Command executed successfully');
        
        // Log the response for debugging
        console.log('Command output:', result.output);
        console.log('Simplified prompt:', result.prompt);
        if (result.fullPrompt) {
            console.log('Full prompt:', result.fullPrompt);
        }
        
        // Reload the file to show changes
        setTimeout(() => loadFile(), 500);
    } catch (error) {
        if (error.name === 'AbortError') {
            updateStatus('Error: Command timed out after 5 minutes', true);
        } else {
            updateStatus(`Error: ${error.message}`, true);
        }
    }
}

// Execute component edit
async function executeComponentEdit() {
    const componentIndex = document.getElementById('componentIndex').value;
    const instructions = document.getElementById('componentInstructions').value;
    
    if (!componentIndex || !instructions) {
        updateStatus('Please select a component and enter instructions', true);
        return;
    }

    const elementIdentifier = selectedElementDetails || { index: componentIndex };
    const command = `${selectedCLI} -p "Modify component #${componentIndex} (${elementIdentifier.tagName || 'element'}) in ${currentFilePath}. Instructions: ${instructions}"`;
    
    // Show command preview
    document.getElementById('componentCommandPreview').style.display = 'block';
    document.getElementById('componentCommandText').textContent = command;
    
    updateStatus('Executing command...');
    
    try {
        const response = await fetch(`${API_BASE}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cli: selectedCLI,
                filePath: currentFilePath,
                instructions: instructions,
                elementIdentifier: elementIdentifier
            }),
            // Add timeout for long-running AI commands
            signal: AbortSignal.timeout(300000) // 5 minute timeout
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        const result = await response.json();
        
        updateStatus('Command executed successfully');
        
        // Log the response for debugging
        console.log('Command output:', result.output);
        console.log('Simplified prompt:', result.prompt);
        if (result.fullPrompt) {
            console.log('Full prompt:', result.fullPrompt);
        }
        
        // Clear selection
        const overlay = document.getElementById('element-overlay');
        overlay.classList.remove('selected');
        overlay.style.display = 'none';
        
        // Reload the file to show changes
        setTimeout(() => loadFile(), 500);
    } catch (error) {
        if (error.name === 'AbortError') {
            updateStatus('Error: Command timed out after 5 minutes', true);
        } else {
            updateStatus(`Error: ${error.message}`, true);
        }
    }
}

// Update status
function updateStatus(message, isError = false) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    statusText.textContent = message;
    
    if (isError) {
        statusDot.classList.add('error');
    } else {
        statusDot.classList.remove('error');
    }
}

// File Picker Functions
function showFilePicker() {
    document.getElementById('filePickerModal').style.display = 'flex';
    loadDirectory('');
}

function hideFilePicker() {
    document.getElementById('filePickerModal').style.display = 'none';
}

async function loadDirectory(path) {
    currentBrowsePath = path;
    
    try {
        const response = await fetch(`${API_BASE}/files?path=${encodeURIComponent(path)}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load directory');
        }
        
        const data = await response.json();
        
        // Update breadcrumb
        updateBreadcrumb(path);
        
        // Render file list
        renderFileList(data);
    } catch (error) {
        alert(`Error loading directory: ${error.message}`);
    }
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '';
    
    // Root button
    const rootBtn = document.createElement('button');
    rootBtn.className = 'breadcrumb-item';
    rootBtn.textContent = 'Root';
    rootBtn.onclick = () => loadDirectory('');
    breadcrumb.appendChild(rootBtn);
    
    if (path) {
        const parts = path.split('/');
        let currentPath = '';
        
        parts.forEach((part, index) => {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);
            
            // Add path button
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const pathBtn = document.createElement('button');
            pathBtn.className = 'breadcrumb-item';
            pathBtn.textContent = part;
            const pathToLoad = currentPath;
            pathBtn.onclick = () => loadDirectory(pathToLoad);
            breadcrumb.appendChild(pathBtn);
        });
    }
}

function renderFileList(data) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    // Add parent directory if not at root
    if (data.parentPath !== null) {
        const parentItem = createFileItem({
            name: '..',
            path: data.parentPath,
            type: 'directory'
        }, true);
        fileList.appendChild(parentItem);
    }
    
    // Add directories and files
    data.items.forEach(item => {
        const fileItem = createFileItem(item);
        fileList.appendChild(fileItem);
    });
    
    if (data.items.length === 0 && data.parentPath === null) {
        fileList.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">No HTML files found in this directory</div>';
    }
}

function createFileItem(item, isParent = false) {
    const div = document.createElement('div');
    div.className = `file-item ${item.type}`;
    
    // Icon
    const icon = document.createElement('svg');
    icon.className = 'file-item-icon';
    icon.setAttribute('width', '20');
    icon.setAttribute('height', '20');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    
    if (item.type === 'directory') {
        icon.innerHTML = '<path d="M3 3H10L12 6H21C21.5523 6 22 6.44772 22 7V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3Z"/>';
        div.style.color = '#8B9467';
    } else {
        icon.innerHTML = '<path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"/><path d="M14 2V8H20"/>';
    }
    
    div.appendChild(icon);
    
    // Name
    const name = document.createElement('span');
    name.className = 'file-item-name';
    name.textContent = item.name;
    div.appendChild(name);
    
    // Click handler
    if (item.type === 'directory') {
        div.onclick = () => loadDirectory(item.path);
    } else {
        div.onclick = () => selectFile(item.path);
    }
    
    return div;
}

function selectFile(path) {
    document.getElementById('filePath').value = path;
    hideFilePicker();
    loadFile();
}

function navigateToRoot() {
    loadDirectory('');
}