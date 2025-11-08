import express from "express"
import { searchWithAi, askLectureQuestion, intelligentAssistant } from "../controllers/aiController.js"

let aiRouter = express.Router()

aiRouter.post("/search",searchWithAi)
aiRouter.post("/ask-lecture", askLectureQuestion)
aiRouter.post("/assistant", intelligentAssistant)

// (Optional) route to index lecture .txt files into Pinecone. Requires env vars and packages installed.
aiRouter.post("/index-lectures", async (req, res) => {
	try {
		const dataDir = process.env.LECTURE_TEXT_DIR || require('path').resolve(process.cwd(), '../RAG/data')
		const { namespace } = req.body || {}
		const { indexDirectoryTextFiles } = await import('../services/vectorStore.js')
		if (!dataDir) return res.status(400).json({ message: 'No data directory configured' })
		const result = await indexDirectoryTextFiles(dataDir, namespace || '')
		return res.status(200).json(result)
	} catch (err) {
		console.error('index-lectures error', err)
		return res.status(500).json({ message: 'Indexing failed', error: err.message || err })
	}
})

export default aiRouter