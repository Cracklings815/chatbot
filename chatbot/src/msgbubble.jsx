import React from 'react';
import { Bot, User } from 'lucide-react';

const MessageBubble = ({ msg }) => {
  const isBot = msg.sender === 'bot';

  return (
    <div className={`flex items-start gap-3 mb-6 ${isBot ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isBot 
          ? 'bg-gradient-to-br from-gray-500 to-gray-600' 
          : 'bg-gradient-to-br from-blue-500 to-blue-600'
      }`}>
        {isBot ? (
          <Bot className="w-5 h-5 text-white" />
        ) : (
          <User className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`max-w-[80%] ${isBot ? 'mr-12' : 'ml-12'}`}>
        {msg.type === 'image' ? (
          <div className="mb-2">
            <img 
              src={msg.imageUrl} 
              alt="Uploaded content"
              className="max-w-full rounded-xl border border-gray-200 shadow-sm"
            />
          </div>
        ) : (
          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
            isBot 
              ? 'bg-white border border-gray-200' 
              : 'bg-blue-500 text-white'
          }`}>
            {msg.text.split('\n').map((line, i) => (
              <p key={i} className={i !== 0 ? 'mt-2' : ''}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;