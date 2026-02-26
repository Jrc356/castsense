/**
 * Test component to verify LangChain.js works in React Native
 * Import this in App.tsx temporarily to test
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LangChainTest = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    const runTests = async () => {
      const results: string[] = [];

      // Test 1: Import @langchain/core
      try {
        const { PromptTemplate } = await import('@langchain/core/prompts');
        const prompt = PromptTemplate.fromTemplate('Hello {name}!');
        results.push('✓ @langchain/core works');
      } catch (error: any) {
        results.push(`✗ @langchain/core failed: ${error.message}`);
      }

      // Test 2: Import @langchain/openai
      try {
        const { ChatOpenAI } = await import('@langchain/openai');
        const model = new ChatOpenAI({
          openAIApiKey: 'test-key',
          temperature: 0,
        });
        results.push('✓ @langchain/openai works');
      } catch (error: any) {
        results.push(`✗ @langchain/openai failed: ${error.message}`);
      }

      // Test 3: Check for global APIs
      const checks = [
        { name: 'crypto.getRandomValues', check: () => typeof crypto?.getRandomValues === 'function' },
        { name: 'TextEncoder', check: () => typeof TextEncoder !== 'undefined' },
        { name: 'TextDecoder', check: () => typeof TextDecoder !== 'undefined' },
        { name: 'URL', check: () => typeof URL !== 'undefined' },
      ];

      checks.forEach(({ name, check }) => {
        if (check()) {
          results.push(`✓ ${name} available`);
        } else {
          results.push(`✗ ${name} missing (may need polyfill)`);
        }
      });

      setTestResults(results);
    };

    runTests();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LangChain.js Compatibility Test</Text>
      {testResults.map((result, index) => (
        <Text
          key={index}
          style={[
            styles.result,
            result.startsWith('✓') ? styles.success : styles.error,
          ]}
        >
          {result}
        </Text>
      ))}
      {testResults.length === 0 && <Text style={styles.loading}>Running tests...</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  result: {
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  success: {
    color: '#22c55e',
  },
  error: {
    color: '#ef4444',
  },
  loading: {
    fontSize: 14,
    color: '#666',
  },
});

export default LangChainTest;
