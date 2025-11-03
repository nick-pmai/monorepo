# Claude Code TypeScript SDK Documentation

## Overview

The Claude Code TypeScript SDK provides a programmatic interface to Claude Code, replacing CLI usage with a more efficient API-based approach. This can significantly improve performance compared to spawning CLI processes.

## Installation

```bash
npm install @anthropic-ai/claude-code
# or
yarn add @anthropic-ai/claude-code
# or
pnpm add @anthropic-ai/claude-code
```

## Basic Usage

### Simple Query Example

```typescript
import { query } from "@anthropic-ai/claude-code";

// Basic usage
for await (const message of query({
  prompt: "Analyze this code and suggest improvements",
  options: {
    systemPrompt: "You are a code review assistant",
    allowedTools: ["Read", "Write", "Edit"]
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

### Replacing CLI Commands

Instead of spawning CLI processes like:
```bash
claude -p "Modify the file at /path/to/file.html. Instructions: Add a header"
```

Use the SDK:
```typescript
import { query } from "@anthropic-ai/claude-code";

async function editFile(filePath: string, instructions: string) {
  const messages = [];
  
  for await (const message of query({
    prompt: `Modify the file at ${filePath}. Instructions: ${instructions}`,
    options: {
      allowedTools: ["Read", "Write", "Edit"],
      maxTurns: 5
    }
  })) {
    messages.push(message);
    
    if (message.type === "result") {
      return {
        success: true,
        result: message.result,
        messages
      };
    }
  }
  
  return {
    success: false,
    messages
  };
}
```

## Configuration Options

```typescript
interface QueryOptions {
  // Abort controller for cancellation
  abortController?: AbortController;
  
  // Allowed tools for the agent
  allowedTools?: string[];
  
  // System prompt to define behavior
  systemPrompt?: string;
  
  // Maximum conversation turns
  maxTurns?: number;
  
  // Model Context Protocol servers
  mcpServers?: MCPServerConfig[];
  
  // Continue from previous session
  sessionId?: string;
}
```

## Advanced Features

### Streaming with Progress Updates

```typescript
import { query } from "@anthropic-ai/claude-code";

async function editWithProgress(filePath: string, instructions: string, onProgress: (msg: string) => void) {
  for await (const message of query({
    prompt: `Modify ${filePath}: ${instructions}`,
    options: {
      allowedTools: ["Read", "Write", "Edit"]
    }
  })) {
    switch (message.type) {
      case "tool_use":
        onProgress(`Using tool: ${message.tool}`);
        break;
      case "text":
        onProgress(`Claude: ${message.text}`);
        break;
      case "result":
        return message.result;
    }
  }
}
```

### Cancellation Support

```typescript
const controller = new AbortController();

// Start operation
const promise = editFile(filePath, instructions, controller);

// Cancel if needed
setTimeout(() => controller.abort(), 30000); // 30s timeout
```

### Multi-turn Conversations

```typescript
import { query } from "@anthropic-ai/claude-code";

async function interactiveEdit(filePath: string) {
  const conversation = [];
  
  // First turn
  for await (const msg of query({
    prompt: `Analyze the file at ${filePath} and suggest improvements`,
    options: { allowedTools: ["Read"] }
  })) {
    conversation.push(msg);
  }
  
  // Second turn based on analysis
  for await (const msg of query({
    prompt: "Apply the suggested improvements",
    options: { 
      allowedTools: ["Write", "Edit"],
      sessionId: conversation[0].sessionId // Continue same session
    }
  })) {
    conversation.push(msg);
  }
  
  return conversation;
}
```

## Benefits over CLI

1. **Performance**: No process spawning overhead
2. **Type Safety**: Full TypeScript support
3. **Streaming**: Real-time progress updates
4. **Cancellation**: Native abort controller support
5. **Session Management**: Continue conversations
6. **Error Handling**: Structured error responses
7. **Memory Efficiency**: No shell escape issues or stdin limits

## Migration Example

### Old CLI Approach:
```javascript
const { spawn } = require('child_process');

function executeEdit(cli, filePath, instructions, content) {
  const command = `${cli} -p "Modify ${filePath}: ${instructions}"`;
  const process = spawn(cli, ['-p', prompt], { 
    input: content 
  });
  // Handle stdout, stderr, etc.
}
```

### New SDK Approach:
```typescript
import { query } from "@anthropic-ai/claude-code";

async function executeEdit(filePath: string, instructions: string) {
  const result = await query({
    prompt: `Modify ${filePath}: ${instructions}`,
    options: {
      allowedTools: ["Read", "Write", "Edit"],
      maxTurns: 1
    }
  }).next();
  
  return result.value;
}
```

## Error Handling

```typescript
try {
  const result = await editFile(filePath, instructions);
  console.log("Success:", result);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log("Operation cancelled");
  } else {
    console.error("Error:", error);
  }
}
```

## Authentication

Set the `ANTHROPIC_API_KEY` environment variable or pass it in options:

```typescript
process.env.ANTHROPIC_API_KEY = 'your-api-key';
```

## Rate Limiting

The SDK handles rate limiting automatically with exponential backoff. No additional configuration needed.