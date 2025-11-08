import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Course from "../models/courseModel.js";
import fs from "fs";
import path from "path";
// Temporarily commented for testing
// import { initVectorStore, indexDirectoryTextFiles, queryTopK } from "../services/vectorStore.js";
dotenv.config();


export const searchWithAi = async (req,res) => {

    try {
         const { input } = req.body;
     
    if (!input) {
      return res.status(400).json({ message: "Search query is required" });
    }
 // case-insensitive
    const ai = new GoogleGenAI({});
const prompt=`You are an intelligent assistant for an LMS platform. A user will type any query about what they want to learn. Your task is to understand the intent and return one **most relevant keyword** from the following list of course categories and levels:

- App Development  
- AI/ML  
- AI Tools  
- Data Science  
- Data Analytics  
- Ethical Hacking  
- UI UX Designing  
- Web Development  
- Others  
- Beginner  
- Intermediate  
- Advanced  

Only reply with one single keyword from the list above that best matches the query. Do not explain anything. No extra text.

Query: ${input}
`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents:prompt,
  });
  const keyword=response.text



    const courses = await Course.find({
      isPublished: true,
     $or: [
    { title: { $regex: input, $options: 'i' } },
    { subTitle: { $regex: input, $options: 'i' } },
    { description: { $regex: input, $options: 'i' } },
    { category: { $regex: input, $options: 'i' } },
    { level: { $regex: input, $options: 'i' } }
  ]
    });

    if(courses.length>0){
    return res.status(200).json(courses);
    }else{
       const courses = await Course.find({
      isPublished: true,
     $or: [
    { title: { $regex: keyword, $options: 'i' } },
    { subTitle: { $regex: keyword, $options: 'i' } },
    { description: { $regex: keyword, $options: 'i' } },
    { category: { $regex: keyword, $options: 'i' } },
    { level: { $regex: keyword, $options: 'i' } }
  ]
    });
       return res.status(200).json(courses);
    }


    } catch (error) {
        console.log(error)
    }
}

// Lecture Q&A using local transcript .txt files (simple RAG)
export const askLectureQuestion = async (req, res) => {
  try {
    const { question, topK = 3 } = req.body;

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    // Prefer vector retrieval (Pinecone + embeddings) if configured
    const dataDir = process.env.LECTURE_TEXT_DIR || path.resolve(process.cwd(), '../RAG/data');

        // Temporarily skip vector store for testing
        console.log('Using file-based retrieval (vector store disabled for testing)')    // Fallback: file-based naive retrieval
    if (!fs.existsSync(dataDir)) {
      return res.status(500).json({ message: `Lecture data directory not found: ${dataDir}` });
    }

    const files = fs.readdirSync(dataDir).filter(f => f.toLowerCase().endsWith('.txt'));

    if (files.length === 0) {
      return res.status(500).json({ message: `No .txt lecture files found in ${dataDir}` });
    }

    // naive relevance scoring: count occurrences of question tokens in each file
    const qWords = question.toLowerCase().split(/\W+/).filter(Boolean);
    const scored = [];

    for (const filename of files) {
      const filePath = path.join(dataDir, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      const text = content.toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (!w) continue;
        const re = new RegExp(`\\b${w}\\b`, 'g');
        const m = text.match(re);
        score += m ? m.length : 0;
      }
      scored.push({ filename, score, content });
    }

    scored.sort((a,b) => b.score - a.score);
    let top = scored.slice(0, topK).filter(s => s.score > 0);
    if (top.length === 0) {
      // fallback: take topK files by default
      top = scored.slice(0, topK);
    }

    const context = top.map(s => `Source: ${s.filename}\n${s.content}`).join('\n\n---\n\n');

    // Use existing Google GenAI client pattern from searchWithAi
    const ai = new GoogleGenAI({});

    const system_prompt = (
      "You are a helpful and concise assistant for lecture Q&A. " +
      "Use the provided context (transcripts) to answer the question. " +
      "If the answer is not present in the context, say you don't know and suggest checking the lecture materials. " +
      "Keep answers short (max 3 sentences) and cite source filenames when relevant.\n\n" +
      "Context:\n{context}\n\nQuestion:\n{question}\n\nAnswer:" 
    ).replace('{context}', context).replace('{question}', question);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: system_prompt,
    });

    const answer = response.text || '';

    return res.status(200).json({ answer, sources: top.map(s => s.filename) });

  } catch (error) {
    console.error('askLectureQuestion error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Enhanced intelligent assistant that uses actual website data
export const intelligentAssistant = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    // Get all published courses from database with populated lectures
    const courses = await Course.find({ isPublished: true })
      .populate('lectures')
      .populate('creator', 'name')
      .select('title subTitle description category level price lectures creator enrolledStudents');

    // Create a knowledge base from the actual website data
    const courseData = courses.map(course => ({
      title: course.title,
      subtitle: course.subTitle,
      description: course.description,
      category: course.category,
      level: course.level,
      price: course.price,
      lectures: course.lectures?.length || 0,
      students: course.enrolledStudents?.length || 0,
      creator: course.creator?.name || 'Unknown'
    }));

    // Platform information
    const platformInfo = {
      name: "MindMate",
      description: "A comprehensive Learning Management System (LMS) platform",
      features: [
        "Video-based courses with interactive lectures",
        "AI-powered chat assistant",
        "Progress tracking and certificates",
        "Multiple difficulty levels (Beginner, Intermediate, Advanced)",
        "Course categories: Web Development, App Development, AI/ML, Data Science, UI/UX Design, Ethical Hacking, AI Tools, Data Analytics",
        "Student enrollment and course management",
        "Course reviews and ratings",
        "Creator dashboard for course management"
      ],
      categories: ["Web Development", "App Development", "AI/ML", "AI Tools", "Data Science", "Data Analytics", "Ethical Hacking", "UI UX Designing", "Others"],
      levels: ["Beginner", "Intermediate", "Advanced"]
    };

    // Create comprehensive context
    const context = `
MINDMATE PLATFORM INFORMATION:
${JSON.stringify(platformInfo, null, 2)}

AVAILABLE COURSES ON WEBSITE:
${JSON.stringify(courseData, null, 2)}

TOTAL COURSES: ${courses.length}
CATEGORIES AVAILABLE: ${[...new Set(courses.map(c => c.category))].join(', ')}
LEVELS AVAILABLE: ${[...new Set(courses.map(c => c.level))].filter(Boolean).join(', ')}
`;

    const ai = new GoogleGenAI({});

    const system_prompt = `You are MindMate's intelligent assistant. You have access to the complete course catalog and platform information.

INSTRUCTIONS:
1. Answer questions about courses by referencing the ACTUAL courses available on the website
2. For course recommendations, suggest specific courses from the catalog with details like title, category, level, and number of lectures
3. For platform questions, use the platform information provided
4. Be helpful, specific, and reference actual data
5. If asking about course suggestions, provide course titles, categories, levels, and brief descriptions
6. Always mention relevant details like number of lectures, difficulty level, and creator when recommending courses
7. For general learning questions, relate them to available courses on the platform

AVAILABLE DATA:
${context}

USER QUESTION: ${question}

Provide a helpful, specific answer using the actual course catalog and platform information:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: system_prompt,
    });

    const answer = response.text || 'I apologize, but I could not generate a response at this time.';

    // Extract relevant courses based on the question for additional context
    const questionLower = question.toLowerCase();
    const relevantCourses = courses.filter(course => {
      const searchText = `${course.title} ${course.subTitle} ${course.description} ${course.category} ${course.level}`.toLowerCase();
      return questionLower.split(' ').some(word => 
        word.length > 2 && searchText.includes(word)
      );
    }).slice(0, 3);

    return res.status(200).json({ 
      answer, 
      relevantCourses: relevantCourses.map(c => ({
        id: c._id,
        title: c.title,
        category: c.category,
        level: c.level,
        lectures: c.lectures?.length || 0
      })),
      totalCourses: courses.length,
      availableCategories: [...new Set(courses.map(c => c.category))]
    });

  } catch (error) {
    console.error('intelligentAssistant error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}