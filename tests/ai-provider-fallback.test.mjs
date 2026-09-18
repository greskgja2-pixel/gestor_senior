import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const route=read('app/api/ai/super-analysis/route.js');
const auto=read('app/super-analise/AutoGeminiAnalysis.js');

test('Super Analise usa Gemini como primeira tentativa e Groq como fallback',()=>{
  assert.match(route,/GEMINI_API_KEY/);
  assert.match(route,/GROQ_API_KEY/);
  assert.match(route,/analyzeWithGemini/);
  assert.match(route,/analyzeWithGroq/);
  assert.match(route,/fallbackFrom='gemini'/);
  assert.match(route,/provider='groq'/);
  assert.match(route,/qwen\/qwen3\.6-27b/);
  assert.match(route,/api\.groq\.com\/openai\/v1\/chat\/completions/);
});

test('fallback Groq preserva analise visual em lotes de no maximo cinco imagens',()=>{
  assert.match(route,/for\(let i=0;i<visualEntries\.length;i\+=5\)/);
  assert.match(route,/response_format:\{type:'json_object'\}/);
  assert.match(route,/data:image\/jpeg|data:\$\{mime\};base64/);
});

test('interface informa troca automatica de provedor sem travar a pagina',()=>{
  assert.match(auto,/se houver limite ou indisponibilidade, a Groq assume automaticamente/i);
  assert.match(auto,/Gemini indisponível/);
  assert.match(auto,/A análise de IA não concluiu/);
  assert.match(auto,/Tentar novamente/);
});
