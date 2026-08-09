/**
 * api/ollama-cloud-models.ts — Vercel Serverless Function
 *
 * GET /api/ollama-cloud-models
 *
 * Proxy + parse trang https://ollama.com/search?c=cloud
 * → trả về danh sách cloud models dưới dạng JSON.
 *
 * Lý do cần proxy server-side:
 *   - ollama.com không hỗ trợ CORS cho browser
 *   - Vercel function chạy server-side → không bị CORS
 *
 * Response cache 1 giờ (danh sách model không đổi thường xuyên).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { request as httpsRequest } from 'node:https';

export const config = {
  maxDuration: 15,
};

export interface OllamaCloudModel {
  name: string;        // "nemotron-3-super"
  tag: string;         // "nemotron-3-super:cloud"
  description: string; // mô tả ngắn
  pulls: string;       // "2.9M"
  tags: string[];      // ["tools", "thinking", "cloud"]
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default function handler(req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const options = {
    hostname: 'ollama.com',
    path: '/search?c=cloud',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (compatible; ollama-model-fetcher)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 12_000,
  };

  const upstreamReq = httpsRequest(options, (upRes) => {
    let html = '';
    upRes.on('data', (chunk: Buffer) => (html += chunk.toString('utf8')));
    upRes.on('end', () => {
      try {
        const models = parseCloudModels(html);
        if (models.length === 0) {
          // Không parse được → fallback list đảm bảo UI không trống
          res.status(200).json({ models: FALLBACK_MODELS, source: 'fallback' });
        } else {
          res.status(200).json({ models, source: 'live' });
        }
      } catch (e) {
        console.error('[ollama-cloud-models] parse error', e);
        res.status(200).json({ models: FALLBACK_MODELS, source: 'fallback' });
      }
    });
    upRes.on('error', (err: Error) => {
      console.error('[ollama-cloud-models] stream error', err.message);
      res.status(200).json({ models: FALLBACK_MODELS, source: 'fallback' });
    });
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    res.status(200).json({ models: FALLBACK_MODELS, source: 'fallback-timeout' });
  });

  upstreamReq.on('error', (err: Error) => {
    console.error('[ollama-cloud-models] fetch error', err.message);
    res.status(200).json({ models: FALLBACK_MODELS, source: 'fallback-error' });
  });

  upstreamReq.end();
}

// ── HTML Parser ────────────────────────────────────────────────────────────────

function parseCloudModels(html: string): OllamaCloudModel[] {
  const models: OllamaCloudModel[] = [];
  const seen = new Set<string>();

  // Strategy 1: __NEXT_DATA__ JSON (Next.js SSR)
  try {
    const nd = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
    if (nd) {
      const data = JSON.parse(nd[1]);
      const items =
        data?.props?.pageProps?.models ??
        data?.props?.pageProps?.results ??
        data?.props?.pageProps?.data?.models ??
        null;
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const name: string = item.name ?? item.model_name ?? '';
          if (!name || seen.has(name)) continue;
          seen.add(name);
          models.push({
            name,
            tag: `${name}:cloud`,
            description: (item.description ?? item.summary ?? '').slice(0, 150),
            pulls: formatPulls(item.pull_count ?? item.pulls ?? 0),
            tags: extractTagFlags(item),
          });
        }
        if (models.length > 0) return models;
      }
    }
  } catch {
    // Strategy 1 failed, continue
  }

  // Strategy 2: parse href="/library/{name}" từ HTML raw
  // Context quanh mỗi link chứa description, pulls, tags
  const linkRegex = /href="\/library\/([a-z0-9][a-z0-9._-]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const name = match[1];
    if (seen.has(name)) continue;
    seen.add(name);

    const ctxStart = Math.max(0, match.index - 50);
    const ctxEnd = Math.min(html.length, match.index + 800);
    const ctx = html.slice(ctxStart, ctxEnd);

    // Description: tìm trong <p> hoặc trong meta description
    let description = '';
    const pMatch =
      ctx.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{10,300}?)<\/p>/i) ??
      ctx.match(/<p[^>]*>([\s\S]{20,200}?)<\/p>/);
    if (pMatch) {
      description = stripHtml(pMatch[1]).trim().slice(0, 150);
    }

    // Pulls: "2.9M Pulls" hoặc "301.1K Pulls"
    const pullsMatch = ctx.match(/([\d.]+[KMkMbBgG])\s+Pulls/i);
    const pulls = pullsMatch ? pullsMatch[1].toUpperCase() : '';

    // Tags flags: vision, tools, thinking, cloud, audio
    const tagFlags = ['vision', 'tools', 'thinking', 'cloud', 'audio', 'embedding'];
    const presentTags = tagFlags.filter((t) =>
      new RegExp(`\\b${t}\\b`, 'i').test(ctx)
    );

    models.push({
      name,
      tag: `${name}:cloud`,
      description,
      pulls,
      tags: presentTags,
    });
  }

  return models;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

function formatPulls(n: number | string): string {
  if (typeof n === 'string') return n;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractTagFlags(item: Record<string, unknown>): string[] {
  const flags = ['vision', 'tools', 'thinking', 'cloud', 'audio'];
  const str = JSON.stringify(item).toLowerCase();
  return flags.filter((f) => str.includes(f));
}

// ── Fallback list (cập nhật từ web_fetch 2026-08-09) ──────────────────────────
// Dùng khi Ollama website không thể fetch hoặc parse

const FALLBACK_MODELS: OllamaCloudModel[] = [
  { name: 'nemotron-3-super',  tag: 'nemotron-3-super:cloud',  description: 'NVIDIA Nemotron 3 Super — 120B MoE, 12B active params. Multi-agent tasks.', pulls: '2.9M',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'gpt-oss',           tag: 'gpt-oss:cloud',           description: "OpenAI's open-weight models for reasoning & agentic tasks.", pulls: '11.5M',  tags: ['tools', 'thinking', 'cloud'] },
  { name: 'gemma4',            tag: 'gemma4:cloud',            description: "Google Gemma 4 — frontier-level performance, reasoning & multimodal.", pulls: '21.2M',  tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'qwen3.5',           tag: 'qwen3.5:cloud',           description: 'Qwen 3.5 — multimodal family (0.8B–122B). Vision + tools.', pulls: '17.2M',  tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'deepseek-v4-flash', tag: 'deepseek-v4-flash:cloud', description: 'DeepSeek-V4-Flash — 284B MoE, 13B active. 1M context window.', pulls: '341K',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'deepseek-v4-pro',   tag: 'deepseek-v4-pro:cloud',   description: 'DeepSeek-V4-Pro — frontier MoE, large context, 3 reasoning modes.', pulls: '316K',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'glm-5.1',           tag: 'glm-5.1:cloud',           description: "Z.ai GLM-5.1 — next-gen flagship, strong coding & SWE-Bench.", pulls: '2.3M',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'glm-5.2',           tag: 'glm-5.2:cloud',           description: "Z.ai GLM-5.2 — flagship model for long-horizon tasks.", pulls: '301K',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'minimax-m2.7',      tag: 'minimax-m2.7:cloud',      description: 'MiniMax M2-series — coding, agentic workflows, professional productivity.', pulls: '2.3M',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'minimax-m3',        tag: 'minimax-m3:cloud',        description: 'MiniMax M3 — 1M context, native multimodality, coding & agentic.', pulls: '380K',   tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'kimi-k3',           tag: 'kimi-k3:cloud',           description: "Moonshot Kimi K3 — open-weight multimodal agentic, most capable.", pulls: '29K',    tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'kimi-k2.6',         tag: 'kimi-k2.6:cloud',         description: 'Moonshot Kimi K2.6 — multimodal agentic, coding & autonomous execution.', pulls: '423K',   tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'kimi-k2.7-code',    tag: 'kimi-k2.7-code:cloud',    description: 'Moonshot Kimi K2.7 Code — coding-focused, built on K2.6.', pulls: '210K',   tags: ['vision', 'tools', 'thinking', 'cloud'] },
  { name: 'nemotron-3-ultra',  tag: 'nemotron-3-ultra:cloud',  description: 'NVIDIA Nemotron 3 Ultra — high-throughput reasoning & long agent workflows.', pulls: '42K',    tags: ['tools', 'thinking', 'cloud'] },
  { name: 'nemotron-3-nano',   tag: 'nemotron-3-nano:cloud',   description: 'Nemotron-3-Nano — efficient open agentic model (4B–30B).', pulls: '675K',   tags: ['tools', 'thinking', 'cloud'] },
  { name: 'mistral-large-3',   tag: 'mistral-large-3:cloud',   description: 'Mistral Large 3 — multimodal MoE for production & enterprise.', pulls: '88K',    tags: ['vision', 'tools', 'cloud'] },
];
