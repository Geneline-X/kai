import { ToolRegistry } from './tools/tool-registry';
import { config } from '../config/env';

export class PromptBuilder {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Build the complete prompt for the agent with role-based instructions
   */
  buildPrompt(
    userMessage: string,
    conversationHistory: string,
    includeTools: boolean = true,
    userRole?: string,
    userId?: string,
    userPhone?: string,
    briefGreeting: boolean = false
  ): string {
    const systemInstructions = this.getSystemInstructions(userRole);
    const toolInstructions = includeTools ? this.getToolInstructions() : '';
    const toolDefinitions = includeTools ? this.toolRegistry.formatToolsForPrompt() : '';

    // Add user context for tools that need it
    const userContext = userId ? `
USER CONTEXT (use these values for tool parameters):
- user_id: "${userId}"
- user_phone: "${userPhone || 'unknown'}"
` : '';

    const briefGreetingInstruction = briefGreeting ? `
IMPORTANT: You have already greeted this user today. Respond with a very brief acknowledgment and move immediately to asking how you can help them (e.g., "I'm here—how can I help you today?"). Do NOT use your name or a full introduction.
` : '';

    return `${systemInstructions}

${toolDefinitions}

${toolInstructions}
${userContext}
${briefGreetingInstruction}
${conversationHistory}

User: ${userMessage}
Assistant:`;
  }

  /**
   * Build prompt for tool result feedback
   */
  buildToolResultPrompt(
    toolName: string,
    toolResult: string,
    conversationHistory: string,
    userRole?: string
  ): string {
    return `${this.getSystemInstructions(userRole)}

${conversationHistory}

Tool Result (${toolName}):
${toolResult}

Now provide a natural, helpful response to the user based on this information. Do not use any more tools.
Assistant:`;
  }

  /**
   * Get system instructions based on user role
   */
  private getSystemInstructions(userRole?: string): string {
    // Import role prompts dynamically to avoid circular dependencies
    const { getRolePrompt } = require('./role-prompts');
    const { UserRole, parseRole } = require('../types/role-types');

    // Parse and validate role
    const role = parseRole(userRole, UserRole.SUPPORT);

    // Get role-specific prompt
    return getRolePrompt(role);
  }

  /**
   * Get tool usage instructions
   */
  private getToolInstructions(): string {
    return `TOOL USAGE INSTRUCTIONS:
When you need to use a tool, respond with ONLY a JSON object in this exact format:

For search_web tool:
{
  "thought": "Brief explanation of why you're using this tool",
  "tool": "search_web",
  "parameters": {
    "query": "your search query here"
  }
}

For search_knowledge tool:
{
  "thought": "Brief explanation of why you're using this tool",
  "tool": "search_knowledge",
  "parameters": {
    "query": "your search query here"
  }
}

For symptom_triage tool (use when user describes symptoms):
{
  "thought": "User is describing symptoms, need to provide triage guidance",
  "tool": "symptom_triage",
  "parameters": {
    "symptoms": "description of symptoms from user",
    "duration": "how long symptoms have lasted (if mentioned)",
    "severity": "mild, moderate, or severe (if mentioned)"
  }
}

For get_health_alerts tool (use for current health alerts):
{
  "thought": "User asking about health alerts or discussing a disease with active alert",
  "tool": "get_health_alerts",
  "parameters": {
    "type": "all, outbreak, vaccination_campaign, prevention_tip, or emergency",
    "area": "optional - specific area/district",
    "userMessage": "the user's original message"
  }
}

For check_escalation_status tool (check BEFORE escalating):
{
  "thought": "User is requesting to speak to a human, checking if we should escalate",
  "tool": "check_escalation_status",
  "parameters": {
    "user_id": "the user's ID",
    "user_message": "the user's message requesting escalation"
  }
}

For escalate_to_health_worker tool (only after check confirms or emergency):
{
  "thought": "User insists on escalation or emergency detected",
  "tool": "escalate_to_health_worker",
  "parameters": {
    "reason": "reason for escalation",
    "urgency_level": "emergency, urgent, or normal",
    "user_id": "the user's ID",
    "latest_message": "user's most recent message",
    "conversation_summary": "summary of last few messages"
  }
}

For find_health_facility tool (use when user mentions a location or asks for nearby facilities):
{
  "thought": "User is looking for health facilities in a specific area",
  "tool": "find_health_facility",
  "parameters": {
    "query": "Name of town, district, or facility mentioned by user",
    "facilityType": "optional - e.g., HOSPITAL, CHC",
    "latitude": 0,
    "longitude": 0
  }
}
💡 IMPORTANT: If the user provides a location name (e.g., "Segbwema", "Kenema"), ALWAYS put it in the "query" parameter. Only provide latitude/longitude if the user explicitly shared their GPS location via WhatsApp. Do NOT guess coordinates.


ESCALATION DECISION LOGIC:
1. If user says "escalate", "talk to human", "call nurse" etc. → First use check_escalation_status
2. If check returns shouldEscalate=false → Use the suggestedResponse to politely offer guidance first
3. If check returns shouldEscalate=true (user insisting) → Use escalate_to_health_worker
4. For TRUE EMERGENCIES (can't breathe, unconscious, severe bleeding) → Skip check, escalate immediately

After receiving tool results, provide a natural, conversational response to the user.

IMPORTANT GUIDELINES:
- For questions about CURRENT EVENTS, NEWS, WEATHER, or anything happening NOW - ALWAYS use the search_web tool FIRST
- Do NOT say "as of my last update" or give outdated information - use search_web instead
- Use search_knowledge for Sierra Leone public health information
- Use search_web for: recent news, current events, today's information, real-time data
- Use symptom_triage when user describes symptoms (fever, pain, vomiting, etc.)
- Use get_health_alerts when user asks about current health alerts or disease outbreaks
- For escalation requests, FIRST check with check_escalation_status
- For simple greetings or general knowledge questions, respond directly
- Only output the JSON when calling a tool, nothing else
- After tool results, respond naturally in plain text
- If user writes in Krio, respond in Krio (or provide both English and Krio)`;
  }
}
