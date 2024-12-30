import React, { useState } from "react";
import axios from "axios";
import rightArrow from "/right-arrow.png" 

const API_KEY = "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"; // API key for Hugging Face

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
    <div className="bg-gradient-to-r from-blue-100 to-purple-100 min-h-screen flex items-center justify-center relative p-8">
      {/* Left and Right Decorative Bars */}
      <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-lg shadow-lg"></div>
      <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-b from-purple-500 to-blue-500 rounded-l-lg shadow-lg"></div>

      {/* Main Chatbot Container */}
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl relative z-10">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-4">
          ChikaBot
        </h1>
        <p className="text-gray-600 text-center mb-6">
        This is a chat-only bot. Type your message to get started.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg shadow-inner h-80 overflow-y-auto">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              } mb-3`}
            >
              <span
                className={`px-4 py-2 rounded-lg shadow-md ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.text}
              </span>
            </div>
          ))}
          {isTyping && (
            <div className="text-center text-gray-600 mb-3">
              <span className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-md">
                Chatbot is typing...
              </span>
            </div>
          )}
          {errorMessage && (
            <div className="text-center text-red-600 mb-3">
              <span className="inline-block px-4 py-2 bg-red-200 text-red-800 rounded-lg shadow-md">
                {errorMessage}
              </span>
            </div>
          )}
        </div>
        <div className="flex mt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your message..."
          />
          <button
            onClick={handleSend}
            className="bg-blue-500 text-white px-6 py-3 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 flex items-center justify-center"
          >
            <img
              src={rightArrow}
              alt="Send"
              className="h-5 w-5" 
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
