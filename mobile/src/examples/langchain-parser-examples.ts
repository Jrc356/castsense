/**
 * Example: Using LangChain Structured Output Parser
 * 
 * Demonstrates how to use the new parser in the AI client workflow
 */

import { parseAIResult, parseAIResultSync, getFormatInstructions, CastSenseResult } from './services/langchain-parsers';

// ============================================================================
// Example 1: Basic Usage (Async)
// ============================================================================

async function example1_basicAsync() {
  // Simulate AI response (could be from OpenAI, Anthropic, etc.)
  const aiResponse = `
  {
    "mode": "general",
    "zones": [
      {
        "zone_id": "Z1",
        "label": "Primary",
        "confidence": 0.9,
        "target_species": "Largemouth Bass",
        "polygon": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]],
        "cast_arrow": {
          "start": [0.2, 0.25],
          "end": [0.25, 0.3]
        }
      }
    ],
    "tactics": [
      {
        "zone_id": "Z1",
        "recommended_rig": "Texas-rigged soft plastic",
        "target_depth": "6-8 feet",
        "retrieve_style": "Slow drag with pauses",
        "why_this_zone_works": ["Visible structure provides cover"]
      }
    ]
  }
  `;

  // Parse and validate
  const result = await parseAIResult(aiResponse);

  if (!result.valid) {
    console.error('Validation failed:');
    result.errors.forEach(err => {
      console.error(`  [${err.type}] ${err.message}`);
      if (err.path) console.error(`    at: ${err.path}`);
    });
    return;
  }

  // Use validated data (fully typed)
  const data = result.parsed as CastSenseResult;
  console.log('✓ Validation passed');
  console.log(`  Mode: ${data.mode}`);
  console.log(`  Zones: ${data.zones.length}`);
  console.log(`  First zone: ${data.zones[0].label} (${data.zones[0].confidence})`);
}

// ============================================================================
// Example 2: Synchronous Usage (Drop-in Replacement)
// ============================================================================

function example2_sync() {
  const aiResponse = '{"mode": "general", "zones": [], "tactics": []}';
  
  // Synchronous parsing (same interface as old validateAIResult)
  const result = parseAIResultSync(aiResponse);
  
  if (result.valid) {
    const data = result.parsed as CastSenseResult;
    console.log('✓ Valid result:', data.mode);
  } else {
    console.error('✗ Validation failed');
  }
}

// ============================================================================
// Example 3: Handling Different Error Types
// ============================================================================

async function example3_errorHandling() {
  const responses = [
    'Not JSON at all',                           // parse error
    '{"mode": "invalid"}',                       // schema error (missing required fields)
    '{"mode": "general", "zones": [], "tactics": [{"zone_id": "BAD"}]}', // integrity error
  ];

  for (const response of responses) {
    const result = await parseAIResult(response);
    
    if (!result.valid) {
      result.errors.forEach(error => {
        switch (error.type) {
          case 'parse':
            console.error('Parse error:', error.message);
            break;
          case 'schema':
            console.error('Schema error:', error.message);
            if (error.path) console.error('  Path:', error.path);
            break;
          case 'geometry':
            console.error('Geometry error:', error.message);
            console.error('  Details:', error.details);
            break;
          case 'integrity':
            console.error('Integrity error:', error.message);
            break;
        }
      });
    }
  }
}

// ============================================================================
// Example 4: Using Format Instructions in AI Prompts
// ============================================================================

async function example4_promptInstructions() {
  // Get format instructions from parser
  const formatInstructions = getFormatInstructions();
  
  // Build prompt for AI
  const prompt = `
Analyze this fishing spot image and provide cast zones with tactical recommendations.

Context:
- Location: Lake Vista, Northern California
- Season: Spring (post-spawn)
- Weather: Partly cloudy, 65°F

${formatInstructions}

Provide analysis with 2-3 zones.
`;

  console.log('Prompt includes format instructions:');
  console.log(prompt);
  
  // Send to AI model...
  // const aiResponse = await openai.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
  // const result = await parseAIResult(aiResponse.choices[0].message.content);
}

// ============================================================================
// Example 5: Handling Markdown-Wrapped Responses
// ============================================================================

async function example5_markdownExtraction() {
  // Some AI models wrap JSON in markdown code blocks
  const aiResponse = `
Sure, here's the analysis:

\`\`\`json
{
  "mode": "general",
  "zones": [],
  "tactics": []
}
\`\`\`

Hope this helps!
  `;

  // Parser automatically extracts JSON from markdown
  const result = await parseAIResult(aiResponse);
  
  if (result.valid) {
    console.log('✓ Successfully extracted JSON from markdown');
  }
}

// ============================================================================
// Example 6: Type-Safe Data Access
// ============================================================================

async function example6_typeSafety() {
  const aiResponse = `{
    "mode": "specific",
    "likely_species": [
      {"species": "Largemouth Bass", "confidence": 0.85},
      {"species": "Smallmouth Bass", "confidence": 0.65}
    ],
    "zones": [],
    "tactics": [],
    "explainability": {
      "scene_observations": ["Clear water", "Rocky shoreline"],
      "assumptions": ["Post-spawn period based on season"]
    }
  }`;

  const result = await parseAIResult(aiResponse);
  
  if (result.valid) {
    const data = result.parsed as CastSenseResult;
    
    // All fields are fully typed
    const mode: 'general' | 'specific' = data.mode;
    const species = data.likely_species?.[0]?.species ?? 'Unknown';
    const observations = data.explainability?.scene_observations ?? [];
    
    console.log(`Mode: ${mode}`);
    console.log(`Top species: ${species}`);
    console.log(`Observations: ${observations.join(', ')}`);
    
    // TypeScript catches errors at compile time
    // data.mode = 'invalid'; // ❌ Type error
    // data.zones[0].confidence = 2.0; // ❌ Type error (must be 0-1)
  }
}

// ============================================================================
// Example 7: Performance Testing
// ============================================================================

async function example7_performance() {
  const sampleResponse = '{"mode": "general", "zones": [], "tactics": []}';
  
  // Single parse benchmark
  const start1 = Date.now();
  await parseAIResult(sampleResponse);
  const elapsed1 = Date.now() - start1;
  console.log(`Single parse: ${elapsed1}ms`);
  
  // Batch parse benchmark
  const start2 = Date.now();
  await Promise.all(
    Array.from({ length: 100 }, () => parseAIResult(sampleResponse))
  );
  const elapsed2 = Date.now() - start2;
  console.log(`100 parses: ${elapsed2}ms (${(elapsed2 / 100).toFixed(2)}ms avg)`);
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  console.log('=== Example 1: Basic Async Usage ===');
  await example1_basicAsync();
  
  console.log('\n=== Example 2: Synchronous Usage ===');
  example2_sync();
  
  console.log('\n=== Example 3: Error Handling ===');
  await example3_errorHandling();
  
  console.log('\n=== Example 4: Prompt Instructions ===');
  await example4_promptInstructions();
  
  console.log('\n=== Example 5: Markdown Extraction ===');
  await example5_markdownExtraction();
  
  console.log('\n=== Example 6: Type Safety ===');
  await example6_typeSafety();
  
  console.log('\n=== Example 7: Performance ===');
  await example7_performance();
}

// Uncomment to run:
// runAllExamples().catch(console.error);

export {
  example1_basicAsync,
  example2_sync,
  example3_errorHandling,
  example4_promptInstructions,
  example5_markdownExtraction,
  example6_typeSafety,
  example7_performance
};
