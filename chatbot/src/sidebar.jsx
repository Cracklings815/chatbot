import React from 'react';
import { Hash, Plus, ChevronRight, X } from 'lucide-react';

const Sidebar = ({ 
  historyVisible, 
  setHistoryVisible, 
  topics, 
  currentTopic, 
  setCurrentTopic,
  isNewTopicInputVisible,
  setIsNewTopicInputVisible,
  newTopicInput,
  setNewTopicInput,
  createNewTopic
}) => {
  if (!historyVisible) return null;

  return (
    <div className="fixed inset-0 z-30 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20" 
        onClick={() => setHistoryVisible(false)}
      />

      {/* Sidebar Panel */}
      <div className="relative w-80 max-w-[calc(100%-3rem)] bg-white shadow-xl animate-in slide-in-from-left">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
            <button 
              onClick={() => setHistoryVisible(false)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Topic Button */}
          <button
            onClick={() => setIsNewTopicInputVisible(true)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
            New Topic
          </button>

          {/* New Topic Input */}
          {isNewTopicInputVisible && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                placeholder="Enter topic name..."
                className="flex-1 px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createNewTopic();
                    setIsNewTopicInputVisible(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  createNewTopic();
                  setIsNewTopicInputVisible(false);
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Topics List */}
        <div className="p-2">
          <button
            onClick={() => setCurrentTopic(null)}
            className={`w-full px-4 py-2 text-left text-sm rounded-lg flex items-center gap-2 group ${
              !currentTopic 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Hash className="w-4 h-4" />
            General
            <ChevronRight className={`w-4 h-4 ml-auto ${!currentTopic ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          </button>

          {Object.entries(topics).map(([topicId, topic]) => (
            <button
              key={topicId}
              onClick={() => setCurrentTopic(topicId)}
              className={`w-full px-4 py-2 text-left text-sm rounded-lg flex items-center gap-2 group ${
                currentTopic === topicId 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Hash className="w-4 h-4" />
              {topic.name}
              <ChevronRight className={`w-4 h-4 ml-auto ${currentTopic === topicId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;