import React, { useState, useRef, useEffect } from 'react'
import { IoMdChatbubbles, IoMdClose, IoMdSend } from 'react-icons/io'
import { FiMessageSquare, FiUser, FiTrash2, FiMinimize2, FiMaximize2, FiArrowDown, FiHelpCircle, FiMessageCircle } from 'react-icons/fi'
import { BiDotsHorizontalRounded } from 'react-icons/bi'
import axios from 'axios'
import { serverUrl } from '../App'
import QuickStartGuide from './QuickStartGuide'

function ChatSidebar() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  useEffect(() => {
    if (open && !minimized) {
      // load persisted messages when opened
      try {
        const key = 'chat_history_v2'
        const raw = localStorage.getItem(key)
        if (raw) {
          const savedMessages = JSON.parse(raw)
          setMessages(savedMessages)
        }
      } catch (e) {
        // ignore
      }
      // focus input when opened
      setTimeout(() => {
        const el = document.getElementById('chat-input')
        if (el) el.focus()
      }, 100)
    }
  }, [open, minimized])

  // Add keyboard shortcut to close chat with Escape key
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyPress)
      return () => document.removeEventListener('keydown', handleKeyPress)
    }
  }, [open])

  // Handle scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50
      setShowScrollButton(!isNearBottom && messages.length > 3)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages.length])

  useEffect(() => {
    // scroll to bottom on new messages
    if (messagesEndRef.current && !showScrollButton) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    // persist with better error handling
    try {
      localStorage.setItem('chat_history_v2', JSON.stringify(messages))
    } catch (e) {
      console.warn('Failed to persist chat history:', e)
    }
  }, [messages, showScrollButton])

  const handleFallbackSearch = async (text) => {
    try {
      const res2 = await axios.post(serverUrl + '/api/ai/search', { input: text }, { withCredentials: true })
      const data = res2?.data
      let responseText = 'No answer available.'
      
      if (Array.isArray(data)) {
        if (data.length === 0) {
          responseText = "I couldn't find anything related to your question. Try rephrasing or asking about our courses and platform features."
        } else {
          const titles = data.slice(0, 3).map(c => c.title).join(', ')
          responseText = `I found some relevant courses: ${titles}. Would you like to know more about any of these?`
        }
      } else if (res2?.data?.message) {
        responseText = res2.data.message
      }

      const botMsg = {
        from: 'bot',
        text: responseText,
        ts: new Date().toISOString(),
        id: Date.now() + 1,
        type: 'course_search'
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err2) {
      console.error('chat error', err2)
      const errorMsg = {
        from: 'bot',
        text: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        ts: new Date().toISOString(),
        id: Date.now() + 1,
        type: 'error'
      }
      setMessages(prev => [...prev, errorMsg])
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    
    const timestamp = new Date().toISOString()
    const userMsg = { from: 'user', text, ts: timestamp, id: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setIsTyping(true)

    // Add lecture context if available
    let contextualQuestion = text
    let isLectureSpecific = false
    try {
      const courseId = localStorage.getItem('currentLectureCourseId')
      const lectureTitle = localStorage.getItem('currentLectureTitle')
      if (courseId && lectureTitle) {
        contextualQuestion = `[Context: Currently viewing lecture "${lectureTitle}"] ${text}`
        isLectureSpecific = true
      }
    } catch (e) {}

    try {
      let res;
      
      // If user is viewing a lecture and question seems lecture-specific, use lecture endpoint
      if (isLectureSpecific && (
        text.toLowerCase().includes('this') ||
        text.toLowerCase().includes('explain') ||
        text.toLowerCase().includes('what is') ||
        text.toLowerCase().includes('how to') ||
        text.toLowerCase().includes('tell me about')
      )) {
        res = await axios.post(serverUrl + '/api/ai/ask-lecture', { 
          question: contextualQuestion, 
          topK: 3 
        }, { withCredentials: true })
      } else {
        // Use intelligent assistant for general queries (course recommendations, platform questions, etc.)
        res = await axios.post(serverUrl + '/api/ai/assistant', { 
          question: text 
        }, { withCredentials: true })
      }
      
      setIsTyping(false)
      
      if (res?.data?.answer) {
        const botMsg = {
          from: 'bot',
          text: res.data.answer,
          ts: new Date().toISOString(),
          id: Date.now() + 1,
          sources: res.data.sources || [],
          relevantCourses: res.data.relevantCourses || [],
          type: res.data.relevantCourses?.length > 0 ? 'course_recommendation' : 'general'
        }
        setMessages(prev => [...prev, botMsg])
      } else {
        await handleFallbackSearch(text)
      }
    } catch (err) {
      setIsTyping(false)
      console.error('Chat error:', err)
      await handleFallbackSearch(text)
    } finally {
      setLoading(false)
      setIsTyping(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    try {
      localStorage.removeItem('chat_history_v2')
    } catch (e) {}
  }

  const handleQuestionSelect = (question) => {
    setInput(question)
    setShowQuickStart(false)
    setTimeout(() => {
      const el = document.getElementById('chat-input')
      if (el) el.focus()
    }, 100)
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      setShowScrollButton(false)
    }
  }

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return ''
    }
  }

  const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-3 max-w-[80%]">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
        <FiMessageCircle className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-100 rounded-2xl px-4 py-2 ml-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Floating button */}
      <div className="fixed right-6 bottom-6 z-50">
        <button
          onClick={() => setOpen(o => !o)}
          className="group bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-16 h-16 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105"
        >
          {open ? (
            <IoMdClose className="w-8 h-8 transition-transform duration-300 group-hover:rotate-90" />
          ) : (
            <>
              <IoMdChatbubbles className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" />
              {messages.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-semibold">{messages.length > 9 ? '9+' : messages.length}</span>
                </div>
              )}
            </>
          )}
        </button>
      </div>

      {/* Sidebar panel */}
      <div className={`fixed right-0 top-0 h-screen w-full sm:w-[400px] sm:max-w-[400px] bg-white shadow-2xl transform transition-all duration-300 ease-in-out z-50 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <FiMessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">MindMate Assistant</h2>
              <p className="text-xs text-blue-100">Ask about lectures & courses</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              title="Minimize/Maximize"
            >
              {minimized ? <FiMaximize2 className="w-4 h-4" /> : <FiMinimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowQuickStart(!showQuickStart)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              title="Quick start guide"
            >
              <FiHelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={clearChat}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
              title="Clear chat"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors duration-200 ml-2 border-l border-white/20 pl-3"
              title="Close chat"
            >
              <IoMdClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Quick Start Guide Overlay */}
            {showQuickStart && (
              <QuickStartGuide
                onClose={() => setShowQuickStart(false)}
                onQuestionSelect={handleQuestionSelect}
              />
            )}

            {/* Messages area */}
            <div 
              ref={messagesContainerRef}
              className="flex flex-col h-[calc(100vh-200px)] max-h-[calc(100vh-200px)] overflow-y-auto bg-gray-50 p-4 space-y-4 scroll-smooth"
            >
              {messages.length === 0 && !showQuickStart && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <FiMessageSquare className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to MindMate!</h3>
                  <p className="text-sm text-gray-600 max-w-xs mx-auto mb-4">
                    Ask me anything about video lectures, courses, or our platform. I'm here to help!
                  </p>
                  <button
                    onClick={() => setShowQuickStart(true)}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105"
                  >
                    View Quick Start Guide
                  </button>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id || m.ts}
                  className={`flex items-start space-x-2 ${m.from === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow-md ${
                    m.from === 'user' 
                      ? 'bg-gradient-to-br from-green-500 to-teal-600' 
                      : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                  }`}>
                    {m.from === 'user' ? (
                      <FiUser className="w-4 h-4 text-white" />
                    ) : (
                      <FiMessageCircle className="w-4 h-4 text-white" />
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className={`max-w-[75%] ${m.from === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-md ${
                        m.from === 'user'
                          ? 'bg-gradient-to-br from-green-500 to-teal-600 text-white rounded-br-md'
                          : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      
                      {/* Course recommendations */}
                      {m.relevantCourses && m.relevantCourses.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">📚 Relevant Courses:</p>
                          <div className="space-y-2">
                            {m.relevantCourses.map((course, i) => (
                              <div key={i} className="bg-gradient-to-r from-blue-50 to-purple-50 p-2 rounded-lg border border-blue-100">
                                <div className="text-xs font-semibold text-blue-800">{course.title}</div>
                                <div className="text-xs text-blue-600">
                                  {course.category} • {course.level} • {course.lectures} lectures
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Lecture sources */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">📄 Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {m.sources.map((source, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`text-xs text-gray-400 mt-1 ${m.from === 'user' ? 'text-right' : 'text-left'}`}>
                      {formatTime(m.ts)}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute right-6 bottom-24 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <FiArrowDown className="w-4 h-4" />
              </button>
            )}

            {/* Input area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    id="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Type your question..."
                    rows={1}
                    className="w-full p-3 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-3 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
                >
                  <IoMdSend className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</div>
                {loading && (
                  <div className="flex items-center space-x-2 text-xs text-blue-600">
                    <BiDotsHorizontalRounded className="animate-pulse" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default ChatSidebar