Lecture Q&A endpoint (simple RAG over local transcripts)

Overview

This file documents the new endpoint that allows asking questions about lecture transcripts stored as .txt files. It implements a lightweight RAG flow by selecting the most relevant transcript files (naive token match) and sending them as context to Google GenAI to generate an answer.

Endpoint

POST /api/ai/ask-lecture

Request JSON body

{
  "question": "What is supervised learning?",
  "topK": 3              // optional, defaults to 3 - number of top files to consider
}

Response JSON

{
  "answer": "...generated answer...",
  "sources": ["lecture1.txt","lecture2.txt"]
}

Configuration

- LECTURE_TEXT_DIR: optional environment variable. If set, points to a directory containing .txt lecture transcripts. If not set, the server will use ../RAG/data relative to the backend working directory.
- The server uses the existing Google GenAI client and requires the same environment configuration used elsewhere in the project (see .env entries already used).
- The server uses the existing Google GenAI client and requires the same environment configuration used elsewhere in the project (see .env entries already used).

Optional: Vector-based retrieval (recommended)

If you want robust semantic retrieval (paraphrase-tolerant), enable the Pinecone + OpenAI embeddings flow:

- Required env vars:
  - PINECONE_API_KEY
  - PINECONE_ENVIRONMENT (Pinecone environment, e.g. us-west1-gcp)
  - OPENAI_API_KEY
  - (optional) PINECONE_INDEX (defaults to mindmate-lectures)

- Install backend packages (from the `backend` folder):

  npm install @pinecone-database/pinecone openai

- After installing, you can index your transcripts by calling the POST /api/ai/index-lectures endpoint (no auth). The server will upsert all .txt files from the configured `LECTURE_TEXT_DIR` into the Pinecone index.

- Once indexed, the existing `/api/ai/ask-lecture` endpoint will prefer vector retrieval automatically.

How it works (short)

1. The handler reads all .txt files from the configured directory.
2. It computes a naive relevance score by counting occurrences of question tokens in each file.
3. It builds a context by concatenating the content of the top K files and sends it to Google GenAI (gemini-2.5-flash) with a short system prompt.
4. Returns the model's answer and the filenames that were used as sources.

Notes and next steps

- This is intentionally simple and works without running embeddings or Pinecone. For more robust retrieval, convert transcripts to embeddings, store in Pinecone, and query the vector DB; see the RAG notebook for reference.
- If you want exact timestamped answers from video, you should store transcripts with timing metadata and return the timestamped snippet as source.

Example (PowerShell curl)

$body = @{question = 'What is ICEM?'} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:5000/api/ai/ask-lecture -Method POST -Body $body -ContentType 'application/json'


If you want, I can now:
- Add a small frontend call example (React) to wire into the existing frontend.
- Upgrade the retrieval to use embeddings + Pinecone (needs env/setup and new dependencies).

