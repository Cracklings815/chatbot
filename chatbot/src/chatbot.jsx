import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Calendar, Mic, MicOff, Camera, Menu, Hash, X, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { formatRelative } from 'date-fns';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { createWorker } from 'tesseract.js';
import { db } from "./firebase";

const EnhancedMealPlanner = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mealPlans, setMealPlans] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [topics, setTopics] = useState({});
  const [currentTopic, setCurrentTopic] = useState(null);
  const [isNewTopicInputVisible, setIsNewTopicInputVisible] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showMealModal, setShowMealModal] = useState(false);
  const [selectedDayMeals, setSelectedDayMeals] = useState(null);
  const [planDuration, setPlanDuration] = useState('day'); 
  
  const messageEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize Gemini AI
  const genAI = new GoogleGenerativeAI("AIzaSyDBYiHd3rcaqmtoEoRciui0zEz0wK4Um88");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        
        setInput(transcript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setErrorMessage('Error with speech recognition. Please try again.');
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Enter key press
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, [input]);

  // Toggle listening function
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setErrorMessage('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      window.recognition.stop();
      setIsListening(false);
    } else {
      window.recognition.start();
      setIsListening(true);
      setErrorMessage(null);
    }
  };

  // Create new topic
  const createNewTopic = async () => {
    if (!newTopicInput.trim()) return;

    try {
      const newTopic = {
        name: newTopicInput.trim(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "topics"), newTopic);
      setTopics(prev => ({
        ...prev,
        [docRef.id]: newTopic
      }));

      setNewTopicInput("");
      setIsNewTopicInputVisible(false);
    } catch (error) {
      console.error("Error creating topic:", error);
      setErrorMessage("Failed to create new topic");
    }
  };

  const handleGenerate = async (prompt) => {
    const userMessage = {
      sender: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await generateMealPlan(prompt);
      const botMessage = {
        sender: 'bot',
        content: response,
        timestamp: new Date().toISOString()
      };

      await saveMessage(userMessage);
      await saveMessage(botMessage);

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      setErrorMessage('Failed to generate response. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  // Format meal plan from AI response
  const formatMealPlan = (response) => {
    const meals = {
        breakfast: { description: '', nutrients: '' },
        lunch: { description: '', nutrients: '' },
        dinner: { description: '', nutrients: '' }
    };

    try {
        const days = response.split("**Day");
        days.forEach(day => {
            const lines = day.split('\n').filter(line => line.trim() !== '');
            let currentMeal = null;

            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('* **Breakfast')) {
                    currentMeal = 'breakfast';
                    meals.breakfast.description = line.split(':')[1].split('(')[0].trim();
                    const nutrientInfo = line.match(/\(([^)]+)\)/);
                    if (nutrientInfo) {
                        meals.breakfast.nutrients = nutrientInfo[1];
                    }
                } else if (line.startsWith('* **Lunch')) {
                    currentMeal = 'lunch';
                    meals.lunch.description = line.split(':')[1].split('(')[0].trim();
                    const nutrientInfo = line.match(/\(([^)]+)\)/);
                    if (nutrientInfo) {
                        meals.lunch.nutrients = nutrientInfo[1];
                    }
                } else if (line.startsWith('* **Dinner')) {
                    currentMeal = 'dinner';
                    meals.dinner.description = line.split(':')[1].split('(')[0].trim();
                    const nutrientInfo = line.match(/\(([^)]+)\)/);
                    if (nutrientInfo) {
                        meals.dinner.nutrients = nutrientInfo[1];
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error parsing meal plan:', error);
    }

    console.log("Formatted meals:", meals);
    return meals;
};
  

  // Save message to Firebase
  const saveMessage = async (message) => {
    try {
      const messageData = {
        ...message,
        topicId: currentTopic,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "messages"), messageData);
    } catch (error) {
      console.error("Error saving message:", error);
      setErrorMessage("Failed to save message");
    }
  };

  // Handle image upload
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMessage(null);

    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const imageUrl = URL.createObjectURL(file);
      const { data: { text } } = await worker.recognize(imageUrl);
      
      await worker.terminate();

      const prompt = `I have a food-related image with the following text: "${text}". 
                     Can you identify any meals or recipes mentioned and create a structured meal plan from it?
                     If possible, include nutritional estimates.`;

      const response = await model.generateContent(prompt);
      const mealPlanResponse = response.response.text();
      
      const imageMessage = {
        sender: "user",
        type: "image",
        content: imageUrl,
        timestamp: new Date().toISOString()
      };

      const botMessage = {
        sender: "bot",
        content: mealPlanResponse,
        timestamp: new Date().toISOString()
      };

      await saveMessage(imageMessage);
      await saveMessage(botMessage);
      
      setMessages(prev => [...prev, imageMessage, botMessage]);
      
      const structuredMeals = formatMealPlan(mealPlanResponse);
      saveMealPlanToCalendar(structuredMeals);

    } catch (error) {
      console.error("Error processing image:", error);
      setErrorMessage("Error processing image. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const generateDates = (startDate, duration) => {
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < duration; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Generate meal plan
  // In your generateMealPlan function, modify it to handle different durations:
  const generateMealPlan = async (prompt) => {
    try {
      const duration = prompt.toLowerCase().includes('week') ? 7 : 1;
      const dates = generateDates(selectedDate, duration);
      
      let enhancedPrompt = prompt;
      if (duration > 1) {
        enhancedPrompt = `Create a ${duration}-day meal plan, clearly separated by days. For each day, include:\n` +
          `- Breakfast with calories and nutrients\n` +
          `- Lunch with calories and nutrients\n` +
          `- Dinner with calories and nutrients\n` +
          `Based on this request: ${prompt}`;
      }
      
      const result = await model.generateContent(enhancedPrompt);
      const response = result.response.text();
      
      // Save the meal plans for all generated dates
      await formatAndSaveMealPlans(response, dates);
      
      return response;
    } catch (error) {
      console.error('Error generating meal plan:', error);
      throw error;
    }
  };

  // Save meal plan to calendar
  const saveMealPlanToCalendar = (structuredMeals) => {
    const mealPlanData = {
      date: selectedDate.toISOString(),
      meals: structuredMeals,
      completed: {
        breakfast: false,
        lunch: false,
        dinner: false
      }
    };

    setMealPlans(prev => ({
      ...prev,
      [selectedDate.toISOString()]: mealPlanData
    }));
  };

  const formatAndSaveMealPlans = async (response, dates) => {
    // Split the response into days if it's a multi-day plan
    const dayPlans = response.split(/Day \d+:/g)
      .filter(day => day.trim())
      .map(day => day.trim());
    
    const newMealPlans = {};
    
    for (let i = 0; i < Math.min(dayPlans.length, dates.length); i++) {
      const dayPlan = dayPlans[i];
      const date = dates[i];
      const dateString = date.toISOString();
      
      const structuredMeals = formatMealPlan(dayPlan);
      
      newMealPlans[dateString] = {
        date: dateString,
        meals: structuredMeals,
        completed: {
          breakfast: false,
          lunch: false,
          dinner: false
        }
      };
      
      // Save to Firebase with error handling
      try {
        const mealPlanRef = doc(db, "mealPlans", dateString);
        await setDoc(mealPlanRef, newMealPlans[dateString]);
      } catch (error) {
        console.error("Error saving meal plan to Firebase:", error);
        // Optionally set an error message for the user
        setErrorMessage("Failed to save meal plan to database");
      }
    }
    
    // Update local state with all new meal plans
    setMealPlans(prev => ({
      ...prev,
      ...newMealPlans
    }));
    console.log("Updated meal plans:", newMealPlans); 
    return newMealPlans;
  };

  // Handle sending messages
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      sender: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await generateMealPlan(input);
      const botMessage = {
        sender: 'bot',
        content: response,
        timestamp: new Date().toISOString()
      };

      await saveMessage(userMessage);
      await saveMessage(botMessage);

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      setErrorMessage('Failed to generate response. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  // Simple Modal Component for displaying meal details
  const MealDetailModal = ({ isOpen, onClose, meals, date }) => {
    if (!isOpen || !meals) return null;

    const dateString = date.toISOString();
    const [completionStatus, setCompletionStatus] = useState(
      mealPlans[dateString]?.completed || {
        breakfast: false,
        lunch: false,
        dinner: false
      }
    );

    const handleCompletion = async (mealType) => {
      const newStatus = {
        ...completionStatus,
        [mealType]: !completionStatus[mealType]
      };
      
      setCompletionStatus(newStatus);
      
      // Update local state
      setMealPlans(prev => ({
        ...prev,
        [dateString]: {
          ...prev[dateString],
          completed: newStatus
        }
      }));

      // Update in Firebase
      try {
        const mealPlanRef = doc(db, "mealPlans", dateString);
        await updateDoc(mealPlanRef, {
          completed: newStatus
        });
      } catch (error) {
        console.error("Error updating meal completion status:", error);
      }
    };

    const MealSection = ({ title, meal, mealType }) => {
      if (!meal?.description) return null;
      
      return (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={completionStatus[mealType]}
                  onChange={() => handleCompletion(mealType)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Completed
              </label>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-800 mb-2">{meal.description}</p>
            {meal.calories && (
              <p className="text-sm text-gray-600">Calories: {meal.calories} cal</p>
            )}
            {meal.nutrients && (
              <p className="text-sm text-gray-600">Nutrients: {meal.nutrients}</p>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Meal Plan for {date.toLocaleDateString('default', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>
            </div>

            <div className="mt-4">
              <MealSection title="Breakfast" meal={meals.breakfast} />
              <MealSection title="Lunch" meal={meals.lunch} />
              <MealSection title="Dinner" meal={meals.dinner} />
        
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sidebar Component
  const Sidebar = () => {
    if (!historyVisible) return null;

    return (
      <div className="fixed inset-0 z-30 flex">
        <div 
          className="absolute inset-0 bg-black/20" 
          onClick={() => setHistoryVisible(false)}
        />

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

            <button
              onClick={() => setIsNewTopicInputVisible(true)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 group"
            >
              <Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
              New Topic
            </button>

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
                    }
                  }}
                /><button
                onClick={createNewTopic}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          )}
        </div>

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

// Calendar View Component
const CalendarView = () => {
  const daysInWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Add padding days from previous month
    for (let i = 0; i < firstDay.getDay(); i++) {
      const prevDate = new Date(year, month, -i);
      days.unshift(prevDate);
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    // Add padding days for next month to complete grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getMealPlanSummary = (date) => {
    const dateString = date.toISOString();
    const plan = mealPlans[dateString];
    
    if (!plan?.meals) return null;

    return Object.entries(plan.meals)
      .filter(([_, meal]) => meal.description)
      .map(([type]) => type.charAt(0).toUpperCase() + type.slice(1));
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    const dateString = date.toISOString();
    const dayMeals = mealPlans[dateString]?.meals;
    
    if (dayMeals) {
      setSelectedDayMeals(dayMeals);
      setShowMealModal(true);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setSelectedDate(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Today
            </button>
            <button 
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setSelectedDate(newDate);
              }}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {daysInWeek.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {getDaysInMonth(selectedDate).map((date, idx) => {
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
            const mealSummary = getMealPlanSummary(date);

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(date)}
                className={`
                  p-2 min-h-[80px] rounded-lg cursor-pointer transition-all
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}
                  ${!isCurrentMonth ? 'opacity-40' : ''}
                `}
              >
                <div className={`
                  text-right text-sm mb-1
                  ${isToday ? 'font-bold text-blue-600' : ''}
                `}>
                  {date.getDate()}
                </div>
                {mealSummary && (
                  <div className="flex flex-wrap gap-1">
                    {mealSummary.map((meal, i) => (
                      <span
                        key={i}
                        className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-800"
                      >
                        {meal}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

// Message Bubble Component
const MessageBubble = ({ message }) => (
  <div className={`flex ${message.sender === 'bot' ? 'justify-start' : 'justify-end'} mb-4`}>
    <div className={`
      max-w-[70%] rounded-2xl p-4
      ${message.sender === 'bot' 
        ? 'bg-white border border-gray-200 text-gray-800' 
        : 'bg-blue-500 text-white'}
    `}>
      {message.type === 'image' ? (
        <img src={message.content} alt="Meal" className="rounded-lg max-w-full" />
      ) : (
        <p>{message.content}</p>
      )}
      <div className={`
        text-xs mt-2
        ${message.sender === 'bot' ? 'text-gray-500' : 'text-blue-100'}
      `}>
        {formatRelative(new Date(message.timestamp), new Date())}
      </div>
    </div>
  </div>
);

return (
  <div className="flex h-screen bg-gray-100">
    <Sidebar />
    
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b bg-white flex items-center gap-4">
        <button
          onClick={() => setHistoryVisible(true)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Mealy</h1>
        {errorMessage && (
          <div className="text-red-500 text-sm ml-auto">{errorMessage}</div>
        )}
      </div>

      <div className="flex-1 flex gap-6 p-6">
        {/* Chat section */}
        <div className="flex flex-col w-3/5">
          <div 
            ref={chatContainerRef}
            className="bg-white rounded-xl shadow-lg p-4 flex-1 mb-4 overflow-y-auto max-h-[calc(100vh-280px)]"
          >
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-3 text-gray-500">
                  <Bot className="w-5 h-5" />
                  <div className="animate-pulse">Thinking...</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Ask about meal planning..."
              rows={3}
            />
            <div className="flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                disabled={isProcessingImage}
                className="p-3 rounded-xl bg-green-500 text-white hover:opacity-90 disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl ${
                  isListening ? 'bg-red-500' : 'bg-blue-500'
                } text-white hover:opacity-90`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar section */}
        <div className="w-2/5">
          <CalendarView />
        </div>
      </div>

      <MealDetailModal
        isOpen={showMealModal}
        onClose={() => setShowMealModal(false)}
        meals={selectedDayMeals}
        date={selectedDate}
      />
    </div>
  </div>
);
};

export default EnhancedMealPlanner;
