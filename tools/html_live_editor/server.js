const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve static files from parent directory for assets
app.use('/assets', express.static(path.resolve(__dirname, '..'), {
    setHeaders: (res, path) => {
        // Set proper MIME types
        if (path.endsWith('.css')) res.type('text/css');
        else if (path.endsWith('.js')) res.type('application/javascript');
        else if (path.endsWith('.html')) res.type('text/html');
    }
}));

// GET /api/files - Browse files and directories
app.get('/api/files', async (req, res) => {
    const requestedPath = req.query.path || '';
    
    try {
        // Resolve the path relative to the parent directory
        const projectRoot = path.resolve(__dirname, '..');
        const fullPath = path.resolve(projectRoot, requestedPath);
        
        // Security check - ensure path doesn't escape the project directory
        if (!fullPath.startsWith(projectRoot)) {
            return res.status(403).json({ error: 'Access denied: Path outside project directory' });
        }
        
        // Get directory contents
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        
        // Process items
        const files = [];
        const directories = [];
        
        for (const item of items) {
            // Skip hidden files and node_modules
            if (item.name.startsWith('.') || item.name === 'node_modules') continue;
            
            const itemPath = path.join(requestedPath, item.name);
            
            if (item.isDirectory()) {
                directories.push({
                    name: item.name,
                    path: itemPath,
                    type: 'directory'
                });
            } else if (item.isFile() && item.name.endsWith('.html')) {
                files.push({
                    name: item.name,
                    path: itemPath,
                    type: 'file'
                });
            }
        }
        
        // Sort directories and files alphabetically
        directories.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        res.json({
            currentPath: requestedPath,
            parentPath: requestedPath ? path.dirname(requestedPath) : null,
            directories,
            files,
            items: [...directories, ...files]
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Directory not found' });
        } else if (error.code === 'ENOTDIR') {
            res.status(400).json({ error: 'Path is not a directory' });
        } else {
            res.status(500).json({ error: `Error reading directory: ${error.message}` });
        }
    }
});

// GET /api/file - Read file content
app.get('/api/file', async (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    try {
        // Resolve the path relative to the parent directory
        const fullPath = path.resolve(__dirname, '..', filePath);
        
        // Security check - ensure path doesn't escape the project directory
        const projectRoot = path.resolve(__dirname, '..');
        if (!fullPath.startsWith(projectRoot)) {
            return res.status(403).send('Access denied: Path outside project directory');
        }
        
        // Read the file
        const content = await fs.readFile(fullPath, 'utf8');
        res.type('text/plain').send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).send('File not found');
        } else {
            res.status(500).send(`Error reading file: ${error.message}`);
        }
    }
});

// GET /api/preview - Serve HTML with proper base path
app.get('/api/preview', async (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    try {
        // Resolve the path relative to the parent directory
        const fullPath = path.resolve(__dirname, '..', filePath);
        
        // Security check
        const projectRoot = path.resolve(__dirname, '..');
        if (!fullPath.startsWith(projectRoot)) {
            return res.status(403).send('Access denied: Path outside project directory');
        }
        
        // Read the file
        let content = await fs.readFile(fullPath, 'utf8');
        
        // Inject base tag to make relative paths work
        const baseDir = path.dirname(filePath);
        const baseTag = `<base href="/assets/${baseDir}/">`;
        
        // Insert base tag after <head> or at the beginning if no head tag
        if (content.includes('<head>')) {
            content = content.replace('<head>', `<head>\n    ${baseTag}`);
        } else if (content.includes('<html>')) {
            content = content.replace('<html>', `<html>\n<head>\n    ${baseTag}\n</head>`);
        } else {
            content = `${baseTag}\n${content}`;
        }
        
        res.type('text/html').send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).send('File not found');
        } else {
            res.status(500).send(`Error reading file: ${error.message}`);
        }
    }
});

// POST /api/edit - Execute CLI command
app.post('/api/edit', async (req, res) => {
    const { cli, filePath, instructions, elementIdentifier } = req.body;
    
    if (!cli || !filePath || !instructions) {
        return res.status(400).send('Missing required fields: cli, filePath, instructions');
    }

    try {
        // Convert to absolute path
        const absolutePath = path.resolve(__dirname, '..', filePath);
        
        // Construct the command
        let prompt;
        if (elementIdentifier) {
            // Component edit - include the HTML snippet
            const elementInfo = elementIdentifier.tagName ? 
                `#${elementIdentifier.index} (${elementIdentifier.tagName})` : 
                `#${elementIdentifier.index}`;
            
            // Include the actual HTML content if available
            let htmlContext = '';
            if (elementIdentifier.outerHTML) {
                htmlContext = `\n\nCurrent HTML:\n${elementIdentifier.outerHTML}`;
            } else if (elementIdentifier.content) {
                htmlContext = `\n\nCurrent content: "${elementIdentifier.content}"`;
            }
            
            prompt = `Modify component ${elementInfo} in ${absolutePath}.${htmlContext}\n\nInstructions: ${instructions}`;
        } else {
            // Page edit
            prompt = `Modify the following ${absolutePath}. Instructions: ${instructions}`;
        }

        // Escape the prompt for shell
        const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const command = `${cli} -p "${escapedPrompt}"`;

        console.log('Executing command:', command);
        console.log('Full prompt:', prompt);

        // Prepare content for stdin and simplified prompt
        let stdinContent = '';
        let simplifiedPrompt = '';
        
        if (elementIdentifier && elementIdentifier.outerHTML) {
            // For component edits, pass HTML via stdin
            stdinContent = `File: ${absolutePath}\n\n${elementIdentifier.outerHTML}`;
            simplifiedPrompt = `Modify the HTML element provided via stdin. ${instructions}`;
        } else {
            // For page edits, read the file content and pass via stdin
            try {
                stdinContent = await fs.readFile(absolutePath, 'utf8');
                simplifiedPrompt = `Modify the HTML file provided via stdin (${absolutePath}). ${instructions}`;
            } catch (readError) {
                console.error('Error reading file for stdin:', readError);
                return res.status(500).json({ 
                    success: false, 
                    message: `Error reading file: ${readError.message}`
                });
            }
        }

        // Execute the command using spawn with stdin
        const commandPreview = cli === 'claude' 
            ? `${cli}  --dangerously-skip-permissions -p "${simplifiedPrompt}"`
            : cli === 'gemini' 
            ? `${cli} -y -p "${simplifiedPrompt}"`
            : `${cli} -p "${simplifiedPrompt}"`;
        
        console.log('Executing command:', commandPreview);
        console.log('Stdin content preview:', stdinContent.substring(0, 200) + '...');
        
        // Build command arguments with CLI-specific flags
        const args = ['-p', simplifiedPrompt];
        
        // Add auto-accept flags based on CLI tool
        if (cli === 'claude') {
            args.push('--dangerously-skip-permissions');
        } else if (cli === 'gemini') {
            args.push('-y'); // YOLO mode for auto-accepting actions
        }
        
        const child = spawn(cli, args, {
            cwd: path.resolve(__dirname, '..'),
            shell: false // Don't use shell to avoid parsing issues
        });

        let stdout = '';
        let stderr = '';

        // Write content to stdin
        child.stdin.write(stdinContent);
        child.stdin.end();

        // Collect stdout data
        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            console.log('Command stdout chunk:', chunk);
        });

        // Collect stderr data
        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            console.error('Command stderr chunk:', chunk);
        });

        // Handle process completion
        child.on('close', (code) => {
            console.log(`Command process exited with code ${code}`);
            console.log('Final stdout response:', stdout);
            
            if (code === 0) {
                res.json({ 
                    success: true, 
                    message: 'Command executed successfully',
                    output: stdout,
                    prompt: simplifiedPrompt,
                    fullPrompt: prompt // Keep original prompt for debugging
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: `Command failed with exit code ${code}`,
                    output: stdout,
                    error: stderr,
                    prompt: simplifiedPrompt
                });
            }
        });

        // Handle process errors
        child.on('error', (error) => {
            console.error('Command spawn error:', error);
            res.status(500).json({ 
                success: false, 
                message: `Error spawning command: ${error.message}`,
                error: error.message
            });
        });
    } catch (error) {
        console.error('Command execution error:', error);
        res.status(500).send(`Error executing command: ${error.message}`);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Live HTML Editor server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to use the editor`);
});