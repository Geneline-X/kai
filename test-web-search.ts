/**
 * Test script to verify the agent framework with web search
 * Run with: npx ts-node test-web-search.ts
 */

import { ConversationHistory } from './src/agent/conversation-history';
import { ToolRegistry } from './src/agent/tools/tool-registry';
import { createKnowledgeSearchTool } from './src/agent/tools/knowledge-search-tool';
import { createWebSearchTool } from './src/agent/tools/web-search-tool';
import { AgentLoop } from './src/agent/agent-loop';
import { config } from './src/config/env';

async function testWebSearch() {
    console.log('🌐 Testing Agent with Web Search Tool\n');
    console.log('Configuration:');
    console.log(`- Agent Mode: ${config.agent.enabled}`);
    console.log(`- Max Iterations: ${config.agent.maxIterations}\n`);

    // Initialize components
    const conversationHistory = new ConversationHistory(1000, config.agent.conversationHistoryLimit);
    const toolRegistry = new ToolRegistry();

    // Register tools
    const knowledgeSearchTool = createKnowledgeSearchTool();
    const webSearchTool = createWebSearchTool();
    toolRegistry.registerTool(knowledgeSearchTool);
    toolRegistry.registerTool(webSearchTool);

    console.log(`✅ Registered ${toolRegistry.getAllTools().length} tools:\n`);
    toolRegistry.getAllTools().forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description.substring(0, 80)}...`);
    });
    console.log();

    // Create agent loop
    const agentLoop = new AgentLoop(
        conversationHistory,
        toolRegistry,
        config.agent.maxIterations
    );

    console.log('🧪 Running web search tests...\n');

    // Test 1: Current information
    console.log('Test 1: Current information request');
    console.log('User: What is the current weather like?');
    try {
        const response1 = await agentLoop.run('test-web-1', 'What is the current weather like?');
        console.log(`Agent: ${response1.response.substring(0, 200)}...`);
        console.log(`Stats: ${response1.iterations} iterations, ${response1.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    // Test 2: Recent news
    console.log('Test 2: Recent news request');
    console.log('User: What are the latest health news?');
    try {
        const response2 = await agentLoop.run('test-web-2', 'What are the latest health news?');
        console.log(`Agent: ${response2.response.substring(0, 200)}...`);
        console.log(`Stats: ${response2.iterations} iterations, ${response2.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    // Test 3: Knowledge base vs web search
    console.log('Test 3: Knowledge base question (should use knowledge search)');
    console.log('User: What are malaria symptoms?');
    try {
        const response3 = await agentLoop.run('test-web-3', 'What are malaria symptoms?');
        console.log(`Agent: ${response3.response.substring(0, 200)}...`);
        console.log(`Stats: ${response3.iterations} iterations, ${response3.toolCallsCount} tool calls\n`);
    } catch (error) {
        console.error('Error:', (error as Error).message, '\n');
    }

    console.log('✅ Web search test complete!');
}

// Run the test
testWebSearch().catch(console.error);
