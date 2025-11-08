// Simple test server
import express from 'express'

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Test server working' })
})

app.post('/api/ai/ask-lecture', (req, res) => {
  const { question } = req.body
  console.log('Received question:', question)
  res.json({ answer: `Test answer for: ${question}`, sources: ['test.txt'] })
})

const port = 3000
app.listen(port, () => {
  console.log(`Test server running on port ${port}`)
}).on('error', (err) => {
  console.error('Server error:', err)
})

// Keep the server running
console.log('Server script loaded')