import React, { useState, useEffect } from "react";
import { Send, Bot, Loader2, Image, Mic, MicOff, Menu } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Tesseract from 'tesseract.js';
import { db } from "./firebase";
import Sidebar from './sidebar';
import MessageBubble from './msgbubble';
// import TopicHeader from './TopicHeader';
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [topics, setTopics] = useState({});
  const [currentTopic, setCurrentTopic] = useState(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [isNewTopicInputVisible, setIsNewTopicInputVisible] = useState(false);
  const [topicCollections, setTopicCollections] = useState({});

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI("YOUR-API-KEY");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // Topic Detection
  const detectTopic = async (text) => {
    try {
      const prompt = `Analyze this message and return ONLY a single-word topic that best categorizes it. For example, if it's about technology, just return "Technology". If it's about health, return "Health". Keep it simple and return just one word: "${text}"`;
      const result = await model.generateContent(prompt);
      const detectedTopic = result.response.text().trim();
      return detectedTopic;
    } catch (error) {
      console.error('Topic detection error:', error);
      return 'General';
    }
  };

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

  // File to Base64
  const fileToGenerativePart = async (file) => {
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

  // Handle Image Upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMessage(null);

    try {
      const imageUrl = URL.createObjectURL(file);
      const userImageMessage = {
        sender: "user",
        type: "image",
        imageUrl: imageUrl,
        topic: currentTopic,
        timestamp: new Date().toISOString()
      };

      await saveMessage(userImageMessage);
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
        }`,
        topic: currentTopic,
        timestamp: new Date().toISOString()
      };

      await saveMessage(botMessage);
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Image Processing Error:', error);
      setErrorMessage("Failed to process the image. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Handle Send Message
  const handleSend = async () => {
    if (!input.trim()) return;

    setIsTyping(true);
    setErrorMessage(null);

    try {
      // Detect topic first
      const detectedTopic = await detectTopic(input);
      const topicId = detectedTopic.toLowerCase().replace(/\s+/g, '-');

      // Check if topic exists, if not create it
      if (!topics[topicId]) {
        const newTopic = {
          id: topicId,
          name: detectedTopic,
          messages: [],
          timestamp: new Date().toISOString()
        };

        const topicsRef = collection(db, "topics");
        await addDoc(topicsRef, newTopic);

        setTopics(prev => ({
          ...prev,
          [topicId]: newTopic
        }));
      }

      // Set current topic
      setCurrentTopic(topicId);

      // Create and save user message
      const userMessage = {
        sender: "user",
        text: input,
        topic: topicId,
        timestamp: new Date().toISOString()
      };

      await saveMessage(userMessage);
      setMessages(prev => [...prev, userMessage]);
      setInput("");

      // Get bot response
      const result = await model.generateContent(input);
      const botMessage = {
        sender: "bot",
        text: result.response.text(),
        topic: topicId,
        timestamp: new Date().toISOString()
      };

      await saveMessage(botMessage);
      setMessages(prev => [...prev, botMessage]);

      // Update topic collections
      const topicCollectionsRef = collection(db, "topicCollections");
      await addDoc(topicCollectionsRef, {
        topic: detectedTopic,
        timestamp: new Date().toISOString(),
        messageCount: 1
      });

    } catch (error) {
      console.error("Error:", error);
      setErrorMessage("Sorry, something went wrong! Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  // Save Message to Firestore
  const saveMessage = async (message) => {
    const messagesRef = collection(db, "chatHistory");
    try {
      await addDoc(messagesRef, {
        ...message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Fetch Data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      const topicsRef = collection(db, "topics");
      const messagesRef = collection(db, "chatHistory");
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      // Subscribe to topics
      const unsubscribeTopics = onSnapshot(topicsRef, (snapshot) => {
        const topicsData = {};
        snapshot.docs.forEach(doc => {
          const topic = doc.data();
          topicsData[topic.id] = {
            name: topic.name,
            messages: []
          };
        });
        setTopics(topicsData);
      });

      // Subscribe to messages
      const unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => doc.data());
        setMessages(messagesData);

        // Group messages by topic
        const newTopics = { ...topics };
        messagesData.forEach(message => {
          if (message.topic && newTopics[message.topic]) {
            newTopics[message.topic].messages.push(message);
          }
        });
        setTopics(newTopics);
      });

      // Subscribe to topic collections
      const topicCollectionsRef = collection(db, "topicCollections");
      const collectionsQuery = query(topicCollectionsRef, orderBy("timestamp", "desc"));
      const unsubscribeCollections = onSnapshot(collectionsQuery, (snapshot) => {
        const collections = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!collections[data.topic]) {
            collections[data.topic] = {
              messageCount: 0,
              timestamp: data.timestamp
            };
          }
          collections[data.topic].messageCount += data.messageCount;
        });
        setTopicCollections(collections);
      });

      return () => {
        unsubscribeTopics();
        unsubscribeMessages();
        unsubscribeCollections();
      };
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <Sidebar
        historyVisible={historyVisible}
        setHistoryVisible={setHistoryVisible}
        topics={topics}
        currentTopic={currentTopic}
        setCurrentTopic={setCurrentTopic}
        isNewTopicInputVisible={isNewTopicInputVisible}
        setIsNewTopicInputVisible={setIsNewTopicInputVisible}
        newTopicInput={newTopicInput}
        setNewTopicInput={setNewTopicInput}
        topicCollections={topicCollections}
      />

      {/* Toggle Button */}
      <button
        onClick={() => setHistoryVisible(true)}
        className="fixed top-4 left-4 p-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow z-20 group"
      >
        <Menu className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
      </button>

      {/* Main Chat Interface */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        {/* <TopicHeader currentTopic={currentTopic} topics={topics} /> */}

        <div className="h-[600px] overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
          {currentTopic ?
            topics[currentTopic]?.messages.map((msg, index) => (
              <MessageBubble key={index} msg={msg} />
            )) :
            messages.map((msg, index) => (
              <MessageBubble key={index} msg={msg} />
            ))
          }
          {isTyping && (
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="text-red-500 text-sm text-center mb-4">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <div className="flex gap-2">
              <label className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors">
                <Image className="w-5 h-5" />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleImageUpload}
                  accept="image/*"
                  disabled={isProcessingImage}
                />
              </label>

              <button
                onClick={() => {
                  setIsListening(true);
                  recognition?.start();
                }}
                disabled={isListening}
                className={`
                  p-2.5 rounded-xl transition-colors
                  ${isListening
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
                `}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Message ${currentTopic ? topics[currentTopic].name : 'General'}...`}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={1}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() && !isProcessingImage}
              className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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