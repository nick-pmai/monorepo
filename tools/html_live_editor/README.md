# Live HTML Editor

A real-time HTML editor that allows you to edit HTML files using AI-powered CLI tools (Gemini or Claude Code).

## Features

- Live preview of HTML files with automatic refresh
- Interactive element selection with visual highlighting
- Edit entire pages or specific components
- Support for both Gemini and Claude Code CLI tools
- Real-time command preview before execution

## Setup

1. Install dependencies:
```bash
cd html_live_editor
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Loading Files
1. Enter the relative path to an HTML file (e.g., `whitebook/book/01_cover.html`)
2. Click the "Load" button

### Editing Pages
1. Select your preferred CLI tool (Gemini or Claude Code)
2. In the "Edit Page" tab, enter instructions for modifying the entire page
3. Click "Execute Command" to apply changes
4. The page will automatically refresh to show the modifications

### Editing Components
1. Hover over elements in the preview to see their index numbers
2. Click on an element to select it
3. The editor will automatically switch to the "Edit Component" tab
4. Enter instructions for modifying the selected component
5. Click "Execute Command" to apply changes

## Requirements

- Node.js 14+ 
- Either `gemini` or `claude` CLI tool installed and configured
- HTML files must be within the project directory structure

## Architecture

- **Frontend**: Vanilla JavaScript with modern CSS styling
- **Backend**: Express.js server handling file operations and CLI execution
- **Communication**: PostMessage API for iframe-parent communication
- **Element Detection**: Injected script for real-time element tracking