import React, { useState } from 'react'
import { FiBook, FiPlay, FiSearch, FiHelpCircle, FiX } from 'react-icons/fi'

function QuickStartGuide({ onClose, onQuestionSelect }) {
  const quickQuestions = [
    {
      category: 'Course Recommendations',
      icon: FiBook,
      questions: [
        'Suggest me the best course for Java programming',
        'What web development courses do you have?',
        'Show me beginner-friendly AI/ML courses',
        'Which courses are best for data science?'
      ]
    },
    {
      category: 'Lecture Help',
      icon: FiPlay,
      questions: [
        'What is this lecture about?',
        'Explain the key concepts from this lecture',
        'Summarize the important points covered'
      ]
    },
    {
      category: 'Platform Guide',
      icon: FiSearch,
      questions: [
        'How many courses are available on MindMate?',
        'What categories of courses do you offer?',
        'How do I enroll in a course?',
        'Tell me about the platform features'
      ]
    }
  ]

  return (
    <div className="absolute inset-0 bg-white z-10 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Quick Start Guide</h3>
            <p className="text-sm text-gray-600">Try asking these popular questions</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {quickQuestions.map((category, categoryIndex) => {
            const IconComponent = category.icon
            return (
              <div key={categoryIndex} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-800">{category.category}</h4>
                </div>
                
                <div className="space-y-2 ml-10">
                  {category.questions.map((question, qIndex) => (
                    <button
                      key={qIndex}
                      onClick={() => onQuestionSelect(question)}
                      className="block w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors duration-200 text-sm text-gray-700 hover:text-blue-700"
                    >
                      "{question}"
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
          <div className="flex items-start space-x-3">
            <FiHelpCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="font-semibold text-blue-900 mb-2">Pro Tips</h5>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Ask specific questions about lecture content for detailed answers</li>
                <li>• Use keywords like "explain", "summarize", or "define" for better results</li>
                <li>• Questions about courses will search our course catalog</li>
                <li>• I can help with platform navigation and features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickStartGuide