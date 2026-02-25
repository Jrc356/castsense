/**
 * Settings Screen
 * 
 * Allows users to configure their OpenAI API key for BYO-API-key model.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  storeApiKey,
  getApiKey,
  clearApiKey,
  hasApiKey,
  isValidApiKeyFormat,
  maskApiKey,
} from '../services/api-key-storage';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadApiKeyStatus();
  }, []);

  async function loadApiKeyStatus() {
    try {
      setLoading(true);
      const configured = await hasApiKey();
      setIsConfigured(configured);

      if (configured) {
        const key = await getApiKey();
        if (key) {
          setMaskedKey(maskApiKey(key));
        }
      }
    } catch (error) {
      console.error('[Settings] Failed to load API key status:', error);
    } finally {
      setLoading(false);
    }
  }

   async function handleSave() {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    if (!isValidApiKeyFormat(apiKey)) {
      Alert.alert(
        'Invalid API Key',
        'The API key you entered appears to be invalid. OpenAI keys are typically 48+ characters. Please check and try again.'
      );
      return;
    }

    try {
      setSaving(true);
      await storeApiKey(apiKey);
      setApiKey('');
      await loadApiKeyStatus();
      
      Alert.alert(
        'Success',
        'Your OpenAI API key has been saved securely.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        `Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    Alert.alert(
      'Clear API Key',
      'Are you sure you want to remove your API key? You will need to enter it again to use the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearApiKey();
              await loadApiKeyStatus();
              Alert.alert('Success', 'API key cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear API key');
            }
          },
        },
      ]
    );
  }

  function openOpenAIDashboard() {
    Linking.openURL('https://platform.openai.com/api-keys');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.section}>
        <Text style={styles.title}>OpenAI API Key</Text>
        <Text style={styles.subtitle}>
          CastSense uses your own OpenAI API key to analyze fishing photos. You pay OpenAI directly
          for usage.
        </Text>
      </View>

      {isConfigured ? (
        <View style={styles.section}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <Text style={styles.statusConfigured}>✓ Configured</Text>
            <Text style={styles.maskedKey}>{maskedKey}</Text>
          </View>

          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear API Key</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <Text style={styles.statusNotConfigured}>✗ Not Configured</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isConfigured ? 'Update API Key' : 'Enter API Key'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="sk-proj-..."
          placeholderTextColor="#999"
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={true}
          textContentType="password"
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save API Key</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Get an API Key</Text>
        <Text style={styles.helpText}>
          1. Go to the OpenAI Platform{'\n'}
          2. Sign in or create an account{'\n'}
          3. Navigate to API Keys{'\n'}
          4. Create a new key{'\n'}
          5. Copy and paste it above
        </Text>

        <TouchableOpacity style={styles.linkButton} onPress={openOpenAIDashboard}>
          <Text style={styles.linkButtonText}>Open OpenAI Dashboard →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security & Privacy</Text>
        <Text style={styles.helpText}>
          • Your API key is encrypted and stored securely on your device{'\n'}
          • CastSense never sends your key to our servers{'\n'}
          • You control your own usage and billing through OpenAI{'\n'}
          • Typical cost: $0.01-0.05 per photo analysis
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.disclaimer}>
          Note: While your key is encrypted at rest, it may be accessible via device jailbreak or
          root access. This is inherent to BYO-API-key mobile apps.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusConfigured: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 8,
  },
  statusNotConfigured: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
  },
  maskedKey: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  linkButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  disclaimer: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
