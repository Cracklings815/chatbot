import React, { useState } from "react";
import axios from "axios";
import { Send, Bot, Loader2, AlertCircle } from "lucide-react";

const API_KEY = "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";

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages([...messages, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await axios.post(
        "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
        {
          inputs: input,
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const botMessage = {
        sender: "bot",
        text: response.data[0]?.generated_text || "No response received.",
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    } catch (error) {
      console.error("Error:", error);
      setErrorMessage("Sorry, something went wrong!");
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-300 to-slate-300 flex items-center justify-center p-6">
      {/* Floating Decorative Elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gray-400 rounded-full blur-3xl opacity-20"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-400 rounded-full blur-3xl opacity-20"></div>
      
      {/* Main Container */}
      <div className="w-full max-w-3xl bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-600 to-slate-600 p-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bot className="h-8 w-8 text-white opacity-90" />
            <h1 className="text-3xl font-bold text-white opacity-90">ChikaBot</h1>
          </div>
          <p className="text-white/80 text-center text-sm">
            This is a chat-only bot. Type your message to get started.
          </p>
        </div>

        {/* Chat Area */}
        <div className="h-96 overflow-y-auto p-6 bg-gradient-to-b from-gray-100/50 to-white/50">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 mb-4 ${
                msg.sender === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                msg.sender === "user" ? "bg-slate-200" : "bg-gray-200"
              }`}>
                {msg.sender === "user" ? (
                  <div className="w-4 h-4 rounded-full bg-slate-500"></div>
                ) : (
                  <Bot className="w-5 h-5 text-gray-500" />
                )}
              </div>
              
              {/* Message Bubble */}
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                msg.sender === "user" 
                  ? "bg-slate-700 text-white rounded-tr-none" 
                  : "bg-gray-200 text-gray-800 rounded-tl-none"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-5 h-5 text-gray-500" />
              </div>
              <div className="px-4 py-2 rounded-2xl bg-gray-200">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-500 rounded-full">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-white/90">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
              className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
              placeholder="Type your message..."
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 bg-gradient-to-r from-gray-600 to-slate-600 text-white rounded-full hover:opacity-90 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;