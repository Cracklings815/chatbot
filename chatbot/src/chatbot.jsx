import React, { useState, useEffect } from "react";
import { Send, Bot, Loader2, AlertCircle, Image, Mic, MicOff } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Tesseract from 'tesseract.js';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI("AIzaSyDSfVp6iTI_-pBxJGhMHY1S9kXjAqubuKw");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognition);
    }
  }, []);

  // Handle Speech Recognition
  const toggleListening = () => {
    if (!recognition) {
      setErrorMessage("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setErrorMessage(null);
    }
    setIsListening(!isListening);
  };

  // Helper function to convert File to base64
  const fileToGenerativePart = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Enhanced Image Upload handler
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMessage(null);

    try {
      // Create a blob URL for the file
      const imageUrl = URL.createObjectURL(file);
      
      // Convert image to base64 for Gemini
      const base64Image = await fileToGenerativePart(file);
      
      // Get image description from Gemini
      const result = await model.generateContent([
        "Describe this image in detail. Include any text, objects, people, colors, and notable elements you can see.",
        base64Image
      ]);
      
      const description = await result.response.text();
      
      // Perform OCR
      const ocrResult = await Tesseract.recognize(
        imageUrl,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`${m.progress * 100}% complete`);
            }
          }
        }
      );

      // Clean up the blob URL
      URL.revokeObjectURL(imageUrl);

      // Add both the description and any detected text to messages
      const botMessage = {
        sender: "bot",
        text: `Image Description: ${description}\n\n${
          ocrResult.data.text.trim() 
            ? `Detected Text: ${ocrResult.data.text.trim()}`
            : ''
        }`
      };
      
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('Image Processing Error:', error);
      setErrorMessage("Failed to process the image. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Handle sending messages
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages([...messages, userMessage]);
    setInput("");
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const result = await model.generateContent(input);
      const botMessage = {
        sender: "bot",
        text: result.response.text(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error:", error);
      setErrorMessage("Sorry, something went wrong! Please try again.");
    } finally {
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
            Powered by Google Gemini AI with Speech & Image Recognition
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

          {/* Processing Image Indicator */}
          {isProcessingImage && (
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-500 rounded-full">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Processing image...</span>
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
            {/* Image Upload */}
            <label className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Image className="w-5 h-5 text-gray-500" />
            </label>

            {/* Speech Input */}
            <button
              onClick={toggleListening}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              {isListening ? (
                <MicOff className="w-5 h-5 text-red-500" />
              ) : (
                <Mic className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {/* Text Input */}
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

            {/* Send Button */}
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