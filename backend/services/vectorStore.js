import { PineconeClient } from '@pinecone-database/pinecone'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

let pinecone = null
let openai = null
const INDEX_NAME = process.env.PINECONE_INDEX || 'mindmate-lectures'

export async function initVectorStore() {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY
  const PINECONE_ENV = process.env.PINECONE_ENVIRONMENT // e.g., us-west1-gcp
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY

  if (!PINECONE_API_KEY || !PINECONE_ENV || !OPENAI_API_KEY) {
    console.log('Vector store not fully configured (PINECONE_API_KEY, PINECONE_ENV, OPENAI_API_KEY required). Skipping initialization.')
    return false
  }

  pinecone = new PineconeClient()
  await pinecone.init({ apiKey: PINECONE_API_KEY, environment: PINECONE_ENV })
  openai = new OpenAI({ apiKey: OPENAI_API_KEY })

  // ensure index exists (best-effort)
  try {
    const existing = await pinecone.listIndexes()
    if (!existing.includes(INDEX_NAME)) {
      await pinecone.createIndex({ createRequest: { name: INDEX_NAME, dimension: 1536 } })
      console.log('Created Pinecone index:', INDEX_NAME)
    }
  } catch (err) {
    console.warn('Error ensuring pinecone index exists:', err.message || err)
  }

  return true
}

async function embedText(text) {
  if (!openai) throw new Error('OpenAI client not initialized')
  // Use OpenAI embeddings (text-embedding-3-small or text-embedding-3-large)
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  const resp = await openai.embeddings.create({ model, input: text })
  return resp.data[0].embedding
}

export async function indexDirectoryTextFiles(dir, namespace = '') {
  if (!pinecone) throw new Error('Pinecone not initialized')
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.txt'))
  const toUpsert = []
  for (const file of files) {
    const full = path.join(dir, file)
    const content = fs.readFileSync(full, 'utf8')
    const embedding = await embedText(content)
    toUpsert.push({ id: file, values: embedding, metadata: { filename: file, text: content } })
  }

  if (toUpsert.length === 0) return { upserted: 0 }

  const index = pinecone.Index(INDEX_NAME)
  // chunk upserts if very large - here it's small
  await index.upsert({ upsertRequest: { vectors: toUpsert, namespace } })
  return { upserted: toUpsert.length }
}

export async function queryTopK(question, topK = 3, namespace = '') {
  if (!pinecone) throw new Error('Pinecone not initialized')
  const qEmbedding = await embedText(question)
  const index = pinecone.Index(INDEX_NAME)
  const queryRequest = {
    vector: qEmbedding,
    topK,
    includeMetadata: true,
    namespace,
  }
  const resp = await index.query({ queryRequest })
  const results = (resp.matches || []).map(m => ({ id: m.id, score: m.score, metadata: m.metadata }))
  return results
}
