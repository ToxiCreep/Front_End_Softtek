import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import express from 'express';
import { createMaya, createOllamaProvider, createGeminiProvider } from '../src/core/index.js';
import { createMayaRouter } from '../src/server/index.js';

if (existsSync('.env')) loadEnvFile('.env');
const ollama = createOllamaProvider({
  host: process.env.OLLAMA_HOST || 'https://ollama.com', apiKey: process.env.OLLAMA_API_KEY,
  model: process.env.A2UI_MODEL || process.env.OLLAMA_MODEL || 'gemma4:31b',
  planningModel: process.env.OLLAMA_MODEL || 'gemma4:31b'
});
const gemini = process.env.GEMINI_API_KEY ? createGeminiProvider({
  apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
}) : undefined;
const useOllama = Boolean(process.env.OLLAMA_API_KEY) || new URL(process.env.OLLAMA_HOST || 'https://ollama.com').hostname !== 'ollama.com';
const maya = createMaya({
  provider: useOllama ? ollama : gemini ?? ollama,
  fallbackProvider: useOllama ? gemini : undefined,
  systemContext: process.env.MAYA_CONTEXT_FILE ? readFileSync(process.env.MAYA_CONTEXT_FILE, 'utf8') : '',
  temperature: Number(process.env.A2UI_TEMPERATURE || 0.5)
  // Añade aquí tools y onAction del nuevo programa. La demo no registra operaciones.
});
const app = express();
app.use('/api/maya', createMayaRouter(maya));
const port = Number(process.env.PORT || 3002);
app.listen(port, '127.0.0.1', () => {
  console.log(`Maya API: http://127.0.0.1:${port}/api/maya`);
  if (!useOllama && !gemini) console.log('Configura una API key en .env o un host de Ollama local para generar interfaces.');
});
