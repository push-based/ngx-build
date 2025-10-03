---
mode: agent
description: "Generate explanation-driven, TDD-focused implementation checklists from technical requirements"
---

{
  "schema_version": "1.0",
  "task": "Generate explanation-driven, TDD-focused implementation checklists from technical requirements",
  "description": "Transform technical requirements documents into actionable, AI-agent-optimized implementation checklists with strategic explanations, pragmatic TDD approach, and clear task prioritization",
  "inputs": {
    "requirements_document": {
      "required": true,
      "desc": "Technical requirements document to be converted into implementation checklist"
    },
    "ticket_number": {
      "required": true,
      "desc": "Ticket identifier for naming the output checklist file"
    },
    "complexity_override": {
      "required": false,
      "desc": "Optional manual complexity setting (SIMPLE/MODERATE/COMPLEX). If not provided, complexity will be auto-assessed"
    }
  },
  "phases": [
    {
      "id": 0,
      "name": "Requirements Analysis",
      "requires_approval": false,
      "response_format": "150 words analyzing complexity, core requirements, and task prioritization rationale",
      "steps": [
        "Analyze requirements document and classify complexity as SIMPLE/MODERATE/COMPLEX",
        "Extract core functional requirements, technical constraints, and integration points",
        "Identify acceptance criteria and testable conditions",
        "Prioritize tasks as CRITICAL/IMPORTANT/OPTIONAL with clear rationale",
        "Determine which tasks should be skipped and explain reasoning"
      ]
    },
    {
      "id": 1,
      "name": "Strategy Development",
      "requires_approval": false,
      "response_format": "200 words explaining implementation approach and TDD strategy",
      "steps": [
        "Define overall implementation approach and architectural patterns to use",
        "Identify TDD focus areas and critical path testing requirements",
        "Determine test boundaries and integration points needing validation",
        "Explain task prioritization logic and trade-offs made",
        "Document what was intentionally skipped and prerequisite blockers"
      ]
    },
    {
      "id": 2,
      "name": "Checklist Generation",
      "requires_approval": false,
      "response_format": "300 words detailing the structured implementation checklist",
      "steps": [
        "Generate checklist following complexity-appropriate task limits (15-25 for SIMPLE, 25-45 for MODERATE, 45-65 for COMPLEX)",
        "Structure tasks into CRITICAL/IMPORTANT/OPTIONAL categories with clear explanations",
        "Emphasize TDD approach for critical functionality with test-first methodology",
        "Include specific file paths, actions, and test references for each task",
        "Organize tasks into logical phases with clear completion criteria"
      ]
    },
    {
      "id": 3,
      "name": "Template Application",
      "requires_approval": false,
      "response_format": "150 words describing template customization and adaptive extensions",
      "steps": [
        "Select appropriate template extensions based on assessed complexity",
        "Apply SIMPLE/MODERATE/COMPLEX specific template sections",
        "Customize checklist sections with project-specific details",
        "Ensure all template sections include explanatory context and rationale",
        "Validate that checklist follows project conventions and TDD guidelines"
      ]
    },
    {
      "id": 4,
      "name": "File Output",
      "requires_approval": false,
      "response_format": "Complete markdown checklist file ready for implementation",
      "steps": [
        "Generate complete checklist using enhanced template format",
        "Include requirements summary, implementation strategy, and completion roadmap",
        "Create file with proper naming convention: {ticket-number}-implementation-checklist.md",
        "Save to .github/tmp/ directory (create if doesn't exist)",
        "Ensure file contains all sections: critical tasks, important tasks, optional enhancements, and validation criteria"
      ]
    }
  ]
}
