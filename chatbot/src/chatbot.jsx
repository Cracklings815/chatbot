  import React, { useState, useEffect } from "react";
  import { Send, Bot, Loader2, AlertCircle, Image, Mic, MicOff, Menu } from "lucide-react";
  import { GoogleGenerativeAI } from "@google/generative-ai";
  import Tesseract from 'tesseract.js';
  import { db } from "./firebase";  
  import { collection, addDoc, onSnapshot } from "firebase/firestore";

  const Chatbot = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI("AIzaSyDSfVp6iTI_-pBxJGhMHY1S9kXjAqubuKw");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Speech Recognition 
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

    // Toggle history visibility
    const toggleHistory = () => {
      setHistoryVisible(!historyVisible);
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

    // Handle image upload
    const handleImageUpload = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setIsProcessingImage(true);
      setErrorMessage(null);

      try {
        const imageUrl = URL.createObjectURL(file);
        const userImageMessage = { sender: "user", type: "image", imageUrl: imageUrl };
        setMessages(prev => [...prev, userImageMessage]);

        const base64Image = await fileToGenerativePart(file);
        const result = await model.generateContent([
          "Describe this image in detail. Include any text, objects, people, colors, and notable elements you can see.",
          base64Image
        ]);

        const description = await result.response.text();
        const ocrResult = await Tesseract.recognize(imageUrl, 'eng');

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
      saveMessage(userMessage);
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsTyping(true);
      setErrorMessage(null);

      try {
        const result = await model.generateContent(input);
        const botMessage = {
          sender: "bot",
          text: result.response.text(),
        };
        saveMessage(botMessage);
        setMessages((prev) => [...prev, botMessage]);
      } catch (error) {
        console.error("Error:", error);
        setErrorMessage("Sorry, something went wrong! Please try again.");
      } finally {
        setIsTyping(false);
      }
    };

    // Save message to Firestore
    const saveMessage = async (message) => {
      const messagesRef = collection(db, "chatHistory");
      try {
        await addDoc(messagesRef, message);
      } catch (error) {
        console.error("Error saving message:", error);
      }
    };

    // Fetch chat history from Firestore
    useEffect(() => {
      const messagesRef = collection(db, "chatHistory");
      const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
        const chatHistory = snapshot.docs.map(doc => doc.data());
        setMessages(chatHistory);
      });

      return () => unsubscribe();
    }, []);

    // Message Bubble component
    const MessageBubble = ({ msg }) => {
      if (msg.type === "image") {
        return (
          <div className={`flex items-end gap-2 mb-4 flex-row-reverse`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-200">
              <div className="w-4 h-4 rounded-full bg-slate-500"></div>
            </div>
            <div className="rounded-2xl overflow-hidden max-w-[80%] border border-gray-200">
              <img src={msg.imageUrl} alt="Uploaded content" className="max-w-full h-auto max-h-[300px] object-contain" />
            </div>
          </div>
        );
      }

      return (
        <div
          className={`flex items-end gap-2 mb-4 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              msg.sender === "user" ? "bg-slate-200" : "bg-gray-200"
            }`}
          >
            {msg.sender === "user" ? (
              <div className="w-4 h-4 rounded-full bg-slate-500"></div>
            ) : (
              <Bot className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <div
            className={`px-4 py-2 rounded-2xl max-w-[80%] ${
              msg.sender === "user"
                ? "bg-slate-700 text-white rounded-tr-none"
                : "bg-gray-200 text-gray-800 rounded-tl-none"
            }`}
          >
            {msg.text}
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-200 via-gray-300 to-slate-300 flex items-center justify-center p-6">
        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform ${
            historyVisible ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300`}
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-bold text-xl">Chat History</h2>
            <button onClick={toggleHistory} className="text-gray-500">
              <Menu />
            </button>
          </div>
          <div className="p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <MessageBubble key={index} msg={msg} />
            ))}
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="w-full max-w-3xl bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-gray-600 to-slate-600 p-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Bot className="h-8 w-8 text-white opacity-90" />
              <h1 className="text-3xl font-bold text-white opacity-90">ChikaBot</h1>
            </div>
            <p className="text-white/80 text-center text-sm">
              Powered by Google Gemini AI with Speech & Image Recognition
            </p>
          </div>

          <div className="h-96 overflow-y-auto p-6 bg-gradient-to-b from-gray-100/50 to-white/50">
            {messages.map((msg, index) => (
              <MessageBubble key={index} msg={msg} />
            ))}
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
          </div>

          <div className="p-4 border-t border-gray-200 bg-white/90">
            <div className="flex gap-2">
              <label className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
                <Image className="w-5 h-5 text-gray-500" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border border-gray-300 p-2 rounded-lg"
              />

              <button
                onClick={handleSend}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
              >
                <Send />
              </button>

              <button
                onClick={() => recognition?.start()}
                disabled={isListening}
                className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
              >
                {isListening ? <MicOff /> : <Mic />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  export default Chatbot;
