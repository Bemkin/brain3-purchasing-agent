import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => line.trim().split('='))
);

const apiKey = envVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
console.log('API KEY:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

const ai = new GoogleGenAI({ apiKey });

async function main() {
  try {
    console.log('Calling Gemini with gemini-2.5-flash...');
    const res1 = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log('gemini-2.5-flash success:', res1.text);
  } catch (err: any) {
    console.error('gemini-2.5-flash ERROR:', err?.message || err);
  }

  try {
    console.log('Calling Gemini with gemini-2.0-flash...');
    const res2 = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hello',
    });
    console.log('gemini-2.0-flash success:', res2.text);
  } catch (err: any) {
    console.error('gemini-2.0-flash ERROR:', err?.message || err);
  }

  try {
    console.log('Calling Gemini with gemini-1.5-flash...');
    const res3 = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'Hello',
    });
    console.log('gemini-1.5-flash success:', res3.text);
  } catch (err: any) {
    console.error('gemini-1.5-flash ERROR:', err?.message || err);
  }
}

main();
