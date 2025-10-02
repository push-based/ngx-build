```json
{
  "version": "1.0.0",
  "task": "Generate optimized prompts from user requests",
  "description": "Transform any user input into precision-crafted prompts using the 4-D methodology (Deconstruct, Diagnose, Develop, Deliver) that unlock AI's full potential across all platforms.",
  "inputs": {
    "source_request": {
      "required": true,
      "desc": "Original user request or rough prompt text that needs optimization"
    },
    "target_ai": {
      "required": false,
      "desc": "Target AI platform (ChatGPT, Claude, Gemini, or Other). Defaults to universal best practices if not specified"
    },
    "style_preference": {
      "required": false,
      "desc": "Optimization style: DETAIL (ask clarifying questions first) or BASIC (quick optimization). Auto-detected based on complexity if not specified"
    }
  },
  "phases": [
    {
      "id": 1,
      "name": "Deconstruct",
      "requires_approval": false,
      "response_format": "free text wrapped with <deconstruct> tags",
      "steps": [
        "Extract core intent, key entities, and context from source_request",
        "Identify output requirements and constraints",
        "Map what's provided vs. what's missing",
        "Auto-detect complexity level (simple → BASIC mode, complex → DETAIL mode)"
      ]
    },
    {
      "id": 2,
      "name": "Diagnose",
      "requires_approval": true,
      "response_format": "free text wrapped with <diagnose> tags",
      "steps": [
        "Audit for clarity gaps and ambiguity",
        "Check specificity and completeness",
        "Assess structure and complexity needs",
        "If DETAIL mode: formulate 2-3 targeted clarifying questions"
      ]
    },
    {
      "id": 3,
      "name": "Develop",
      "requires_approval": false,
      "response_format": "free text wrapped with <develop> tags",
      "steps": [
        "Select optimal techniques based on request type (Creative, Technical, Educational, or Complex)",
        "Apply appropriate optimization techniques (role assignment, context layering, output specs, task decomposition)",
        "Enhance context and implement logical structure",
        "Adapt format for target AI platform if specified"
      ]
    },
    {
      "id": 4,
      "name": "Deliver",
      "requires_approval": false,
      "response_format": "structured response with optimized prompt, improvements summary, and implementation guidance",
      "steps": [
        "Construct the final optimized prompt with proper XML-like header",
        "Provide key improvements summary",
        "Include implementation guidance and pro tips",
        "Save optimized prompt to .github/prompts folder",
        "Clean up any temporary files created during optimization"
      ]
    }
  ]
}
```

