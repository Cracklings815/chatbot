import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Calendar, Mic, MicOff, Camera, Menu, Hash, X, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import { formatRelative } from 'date-fns';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, setDoc, getDoc } from "firebase/firestore";
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

  //AI
  const genAI = new GoogleGenerativeAI("AIzaSyCnvM7E4KeUJGeIqjemXKk8kjAtPN934Sk");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  
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

    if (isListening) {
        recognition.stop();
        setIsListening(false);
    } else {
        recognition.start();
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
      const lines = response.split('\n');
      let currentMeal = null;
  
      lines.forEach(line => {
        line = line.trim();
        
        if (line.toLowerCase().includes('breakfast')) {
          currentMeal = 'breakfast';
          const [_, ...description] = line.split(':');
          if (description.length > 0) {
            const [mealDesc, ...nutrients] = description.join(':').split('(');
            meals.breakfast.description = mealDesc.trim();
            if (nutrients.length > 0) {
              meals.breakfast.nutrients = nutrients.join('(').replace(/\)$/, '').trim();
            }
          }
        } else if (line.toLowerCase().includes('lunch')) {
          currentMeal = 'lunch';
          const [_, ...description] = line.split(':');
          if (description.length > 0) {
            const [mealDesc, ...nutrients] = description.join(':').split('(');
            meals.lunch.description = mealDesc.trim();
            if (nutrients.length > 0) {
              meals.lunch.nutrients = nutrients.join('(').replace(/\)$/, '').trim();
            }
          }
        } else if (line.toLowerCase().includes('dinner')) {
          currentMeal = 'dinner';
          const [_, ...description] = line.split(':');
          if (description.length > 0) {
            const [mealDesc, ...nutrients] = description.join(':').split('(');
            meals.dinner.description = mealDesc.trim();
            if (nutrients.length > 0) {
              meals.dinner.nutrients = nutrients.join('(').replace(/\)$/, '').trim();
            }
          }
        } else if (currentMeal && line.length > 0 && !line.startsWith('===')) {
          meals[currentMeal].description += ' ' + line.trim();
        }
      });
  
      // Clean up descriptions
      Object.keys(meals).forEach(meal => {
        meals[meal].description = meals[meal].description
          .replace(/\*/g, '')
          .replace(/#+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      });
  
    } catch (error) {
      console.error('Error parsing meal plan:', error);
    }
  
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
      // Convert file to base64 for Gemini
      const base64Image = await fileToBase64(file);
      const imageUrl = URL.createObjectURL(file);
  
      // Create a focused prompt for food recognition and nutrition
      const imageAnalysisPrompt = `Please analyze this food image and provide:
      1. Identify the type(s) of food visible
      2. Estimate nutritional values where possible (calories, protein, carbs, fats)
      3. List any visible ingredients or components
      Please format as a clear description without day numbers or meal plan structure.`;
      
      const imageData = {
        inlineData: {
          data: base64Image,
          mimeType: file.type
        }
      };
  
      // Generate image analysis using Gemini Pro Vision
      const analysisResult = await model.generateContent([imageAnalysisPrompt, imageData]);
      const foodAnalysis = await analysisResult.response.text();
  
      // Create nutrition-focused prompt based on identified food
      const nutritionPrompt = `Based on the identified food: "${foodAnalysis}"
      Please provide:
      - Key nutrients and their amounts
      - Any relevant dietary information or considerations
      Format as a simple nutritional analysis without meal planning structure.`;
  
      // Generate nutritional information
      const nutritionResult = await model.generateContent(nutritionPrompt);
      const nutritionAnalysis = nutritionResult.response.text();
  
      // Combine analysis results
      const combinedAnalysis = `Food Analysis:\n${foodAnalysis}\n\nNutritional Information:\n${nutritionAnalysis}`;
  
      // Create user image message
      const userImageMessage = {
        sender: "user",
        type: "image",
        imageUrl: imageUrl,
        topic: currentTopic,
        content: imageUrl,
        timestamp: new Date().toISOString()
      };
  
      // Save user image message
      await saveMessage(userImageMessage);
      setMessages(prev => [...prev, userImageMessage]);
  
      // Create bot message with analysis
      const botMessage = {
        sender: "bot",
        text: "Image Analysis Results",
        topic: currentTopic,
        content: combinedAnalysis,
        timestamp: new Date().toISOString()
      };
  
      // Save bot message
      await saveMessage(botMessage);
      setMessages(prev => [...prev, botMessage]);
  
      // Format and structure the meal data
      const foodData = {
        description: foodAnalysis,
        nutrients: nutritionAnalysis
      };
  
      // Save to current date in calendar if needed
      const dateString = selectedDate.toISOString();
      const currentMealPlan = mealPlans[dateString] || {
        date: dateString,
        meals: {
          breakfast: {},
          lunch: {},
          dinner: {}
        },
        completed: {
          breakfast: false,
          lunch: false,
          dinner: false
        }
      };
  
      // Save to Firebase
      try {
        const mealPlanRef = doc(db, "mealPlans", dateString);
        await setDoc(mealPlanRef, {
          ...currentMealPlan,
          imageAnalysis: foodData
        });
      } catch (error) {
        console.error('Error saving food analysis to Firebase:', error);
        setErrorMessage('Failed to save food analysis');
      }
  
    } catch (error) {
      console.error('Image Processing Error:', error);
      setErrorMessage("Failed to process the image. Please try again.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Extract the base64 data from the result
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
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
  // const generateMealPlan = async (prompt) => {
  //   try {
  //     const validKeywords = ['meal', 'diet', 'food', 'breakfast', 'lunch', 'dinner', 'plan', 'calories', 'nutrition'];
  //     const isMealPlanRelated = validKeywords.some((keyword) =>
  //       prompt.toLowerCase().includes(keyword)
  //     );
  
  //     if (!isMealPlanRelated) {
  //       throw new Error("The prompt is not related to meal planning. Please provide a relevant request.");
  //     }
  
  //     const promptLower = prompt.toLowerCase();
  //     let duration = 1; // Default to one day
  
  //     // Check for specific day mentions
  //     if (promptLower.includes('month')) duration = 30;
  //     else if (promptLower.includes('week') || promptLower.includes('7 day')) duration = 7;
  //     else {
  //       for (let i = 6; i >= 1; i--) {
  //         if (promptLower.includes(`${i} day`)) {
  //           duration = i;
  //           break;
  //         }
  //       }
  //     }
  
  //     const dates = generateDates(selectedDate, duration);
  //     const durationText = duration === 30 ? 'monthly' : 
  //                         duration === 7 ? 'weekly' : 
  //                         duration === 1 ? 'daily' : 
  //                         `${duration}-day`;
  
  //     const enhancedPrompt = `Create a detailed ${durationText} meal plan with the following requirements:
  //     ${prompt}\n
  //     Please provide a UNIQUE and DIFFERENT meal plan for each day, following this EXACT format:
      
  //     Day 1:
  //     Breakfast: [unique meal] (calories)
  //     Lunch: [unique meal] (calories)
  //     Dinner: [unique meal] (calories)
      
  //     [Continue same format for all ${duration} days]
      
  //     Important guidelines:
  //     - Each day MUST be clearly labeled as "Day 1", "Day 2", etc.
  //     - Create completely different meals for each day
  //     - Include specific calorie counts for each meal
  //     - Ensure all ${duration} days are distinct and varied
  //     - Consider nutritional balance`;
  
  //     const result = await model.generateContent(enhancedPrompt);
  //     const response = await result.response.text();
  
  //     const dayCount = (response.match(/Day \d+:/g) || []).length;
  //     if (dayCount < duration) {
  //       throw new Error(`AI response incomplete: Only received ${dayCount} days of ${duration} requested. Retrying...`);
  //     }
  
  //     return await formatAndSaveMealPlans(response, dates);
  //   } catch (error) {
  //     console.error('Error generating meal plan:', error);
  //     throw new Error(error.message || 'Failed to generate a meal plan. Please try again.');
  //   }
  // };
  // Modified generateMealPlan function with batch processing
const generateMealPlan = async (prompt) => {
  try {
    const validKeywords = ['meal', 'diet', 'food', 'breakfast', 'lunch', 'dinner', 'plan', 'calories', 'nutrition'];
    const isMealPlanRelated = validKeywords.some((keyword) =>
      prompt.toLowerCase().includes(keyword)
    );

    if (!isMealPlanRelated) {
      throw new Error("The prompt is not related to meal planning. Please provide a relevant request.");
    }

    const promptLower = prompt.toLowerCase();
    let duration = 1; // Default to one day

    // Check for specific day mentions
    const daysMatch = promptLower.match(/(\d+)\s*days?/);
    if (daysMatch) {
      duration = parseInt(daysMatch[1]);
    }
    // Then check for other time periods
    else if (promptLower.includes('month')) {
      duration = 30;
    }
    else if (promptLower.includes('week')) {
      duration = 7;
    }

    // Add validation to ensure reasonable duration
    if (duration > 30) {
      duration = 30; // Cap at 30 days
    }

    const dates = generateDates(selectedDate, duration);
    const batchSize = 7; // Process 7 days at a time
    const allMealPlans = {};

    // Process in batches
    for (let i = 0; i < duration; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, duration - i);
      const batchDates = dates.slice(i, i + currentBatchSize);
      
      const batchPrompt = `Create a detailed meal plan for ${currentBatchSize} days (Days ${i + 1}-${i + currentBatchSize}) with these requirements:
      ${prompt}\n
      Please provide a UNIQUE and DIFFERENT meal plan for each day, following this EXACT format:
      
      Day ${i + 1}:
      Breakfast: [unique meal] (calories)
      Lunch: [unique meal] (calories)
      Dinner: [unique meal] (calories)
      
      [Continue same format for all ${currentBatchSize} days]
      
      Important guidelines:
      - Each day MUST be clearly labeled as "Day X"
      - Create completely different meals for each day
      - Include specific calorie counts for each meal
      - Ensure all days are distinct and varied
      - Consider nutritional balance
      
      Previous meals generated: ${Object.keys(allMealPlans).length} days
      Current batch: Days ${i + 1}-${i + currentBatchSize}`;

      const result = await model.generateContent(batchPrompt);
      const response = await result.response.text();

      // Validate batch response
      const dayCount = (response.match(/Day \d+:/g) || []).length;
      if (dayCount < currentBatchSize) {
        throw new Error(`Batch generation incomplete: Only received ${dayCount} days of ${currentBatchSize} requested. Retrying batch...`);
      }

      // Format and save batch
      const batchMealPlans = await formatAndSaveMealPlans(response, batchDates);
      Object.assign(allMealPlans, batchMealPlans);

      // Add delay between batches to prevent rate limiting
      if (i + batchSize < duration) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Validate final result
    if (Object.keys(allMealPlans).length !== duration) {
      throw new Error(`Failed to generate complete meal plan: Only generated ${Object.keys(allMealPlans).length} of ${duration} days`);
    }

    return allMealPlans;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw new Error(error.message || 'Failed to generate a meal plan. Please try again.');
  }
};

// Helper function to break down responses into days
const parseDayPlans = (response) => {
  const days = [];
  const dayMatches = response.match(/Day \d+:[\s\S]*?(?=Day \d+:|$)/g) || [];
  
  return dayMatches.map(day => day.trim());
};

  const formatAndSaveMealPlans = async (response, dates) => {
    const dayPlans = response
      .split(/Day \d+:/g)
      .filter(day => day.trim())
      .map(day => day.trim());
    
    const newMealPlans = {};
    
    for (let i = 0; i < dates.length; i++) {
      if (!dayPlans[i]) {
        console.error(`Missing meal plan for day ${i + 1}`);
        continue;
      }
  
      const date = dates[i];
      const dateString = date.toISOString();
      const structuredMeals = formatMealPlan(dayPlans[i]);
      
      if (!structuredMeals ||
          !structuredMeals.breakfast?.description ||
          !structuredMeals.lunch?.description ||
          !structuredMeals.dinner?.description) {
        console.error(`Incomplete meal plan for day ${i + 1}`);
        continue;
      }
      
      newMealPlans[dateString] = {
        date: dateString,
        dayNumber: i + 1,
        meals: structuredMeals,
        completed: {
          breakfast: false,
          lunch: false,
          dinner: false
        }
      };
      
      // Save to Firebase with retries
      let retries = 3;
      while (retries > 0) {
        try {
          const mealPlanRef = doc(db, "mealPlans", dateString);
          await setDoc(mealPlanRef, newMealPlans[dateString]);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`Error saving meal plan for day ${i + 1} to Firebase:`, error);
            setErrorMessage(`Failed to save meal plan for ${date.toLocaleDateString()}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    setMealPlans(prev => ({
      ...prev,
      ...newMealPlans
    }));
    
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

    const MealSection = ({ title, meal, mealType }) => {
      if (!meal?.description) return null;
      
      return (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
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
              <MealSection title="Breakfast" meal={meals.breakfast} mealType="breakfast" />
              <MealSection title="Lunch" meal={meals.lunch} mealType="lunch" />
              <MealSection title="Dinner" meal={meals.dinner} mealType="dinner" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sidebar Component
//   const Sidebar = () => {
//     if (!historyVisible) return null;

//     return (
//       <div className="fixed inset-0 z-30 flex">
//         <div 
//           className="absolute inset-0 bg-black/20" 
//           onClick={() => setHistoryVisible(false)}
//         />

//         <div className="relative w-80 max-w-[calc(100%-3rem)] bg-white shadow-xl animate-in slide-in-from-left">
//           <div className="p-4 border-b border-gray-200">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
//               <button 
//                 onClick={() => setHistoryVisible(false)}
//                 className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>

//             <button
//               onClick={() => setIsNewTopicInputVisible(true)}
//               className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 group"
//             >
//               <Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
//               New Topic
//             </button>

//             {isNewTopicInputVisible && (
//               <div className="mt-2 flex gap-2">
//                 <input
//                   type="text"
//                   value={newTopicInput}
//                   onChange={(e) => setNewTopicInput(e.target.value)}
//                   placeholder="Enter topic name..."
//                   className="flex-1 px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   onKeyDown={(e) => {
//                     if (e.key === 'Enter') {
//                       createNewTopic();
//                     }
//                   }}
//                 /><button
//                 onClick={createNewTopic}
//                 className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
//               >
//                 Add
//               </button>
//             </div>
//           )}
//         </div>

//         <div className="p-2">
//           <button
//             onClick={() => setCurrentTopic(null)}
//             className={`w-full px-4 py-2 text-left text-sm rounded-lg flex items-center gap-2 group ${
//               !currentTopic 
//                 ? 'bg-blue-50 text-blue-700' 
//                 : 'text-gray-700 hover:bg-gray-100'
//             }`}
//           >
//             <Hash className="w-4 h-4" />
//             General
//             <ChevronRight className={`w-4 h-4 ml-auto ${!currentTopic ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
//           </button>

//           {Object.entries(topics).map(([topicId, topic]) => (
//             <button
//               key={topicId}
//               onClick={() => setCurrentTopic(topicId)}
//               className={`w-full px-4 py-2 text-left text-sm rounded-lg flex items-center gap-2 group ${
//                 currentTopic === topicId 
//                   ? 'bg-blue-50 text-blue-700' 
//                   : 'text-gray-700 hover:bg-gray-100'
//               }`}
//             >
//               <Hash className="w-4 h-4" />
//               {topic.name}
//               <ChevronRight className={`w-4 h-4 ml-auto ${currentTopic === topicId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
//             </button>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

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
const MessageBubble = ({ message }) => {
  const formatJSONContent = (content) => {
    if (typeof content !== 'object' || content === null) {
      return content;
    }

    return (
      <div className="space-y-4">
        {Object.entries(content).map(([date, dayData]) => (
          <div key={date} className="border-b border-gray-200 pb-4">
            <div className="font-medium text-lg mb-2">
              {formatRelative(new Date(date), new Date())}
            </div>
            
            <div className="space-y-3">
              {Object.entries(dayData.meals).map(([mealType, mealInfo]) => (
                <div key={mealType} className="pl-4 border-l-2 border-blue-200">
                  <div className="font-medium capitalize">{mealType}</div>
                  <div className="text-gray-600">{mealInfo.description}</div>
                  <div className="text-sm text-gray-500">{mealInfo.nutrients}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    // Handle image messages
    if (message.type === 'image') {
      return (
        <div className="max-w-sm">
          <img 
            src={message.imageUrl} 
            alt="Food" 
            className="rounded-lg w-full h-auto object-cover"
          />
        </div>
      );
    }
    
    // Handle text/JSON content
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    return formatJSONContent(message.content);
  };

  return (
    <div className={`flex ${message.sender === 'bot' ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`
        max-w-[70%] rounded-2xl p-4
        ${message.sender === 'bot' 
          ? 'bg-white border border-gray-200 text-gray-800' 
          : 'bg-blue-500 text-white'}
      `}>
        <div className="whitespace-pre-wrap">{renderContent()}</div>
        <div className={`
          text-xs mt-2
          ${message.sender === 'bot' ? 'text-gray-500' : 'text-blue-100'}
        `}>
          {formatRelative(new Date(message.timestamp), new Date())}
        </div>
      </div>
    </div>
  );
};


return (
  <div className="flex h-screen bg-gray-100">
    {/* Sidebar */}
    
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b bg-white flex items-center gap-4">
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
