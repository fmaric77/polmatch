"use client";
import { useState, useCallback, useEffect } from "react";
import "./styles.css";

interface Message {
  id: number;
  sender: "bot" | "user";
  content: string;
  choices?: string[] | null;
}

const questions = [
  { question: "What is your sex?", choices: ["Male", "Female"] },
  { question: "How old are you?", choices: null },
  { question: "Which age group do you belong to?", choices: ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"] },
  { question: "Are you available in any specific continent or region?", choices: null },
  { question: "What is your country of origin?", choices: null },
  { question: "Where are you currently available?", choices: null },
  { question: "What type of environment do you prefer?", choices: ["Urban", "Suburban", "Rural"] },
  { question: "Is distance a problem for you?", choices: ["Yes", "No"] },
  { question: "What languages do you speak?", choices: null },
  { question: "What is your favorite quote?", choices: null }
];

interface ChatbotProps {
  latestBotMessage: Message | null;
  userInput: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSend: () => void;
  handleChoice: (choice: string) => void;
}

const Chatbot: React.FC<ChatbotProps> = ({
  latestBotMessage,
  userInput,
  handleInputChange,
  handleSend,
  handleChoice
}) => (
  <div className="transition-all duration-1000 opacity-100 flex flex-col items-center justify-center flex-grow">
    <div className="flex items-start">
      <img
        src="/images/polstrat-dark.png"
        alt="Chatbot"
        className="w-24 h-24 mb-4 transition-all duration-1000 transform slide-left"
      />
      <div className="ml-4 w-full max-w-2xl mt-4">
        {latestBotMessage && (
          <div className="py-4 text-left">
            <p
              key={latestBotMessage.id}
              className="mt-2 text-white rollout progressive-text"
            >
              {latestBotMessage.content}
            </p>
          </div>
        )}
      </div>
    </div>
    <div className="w-full max-w-2xl mt-4">
      {latestBotMessage && latestBotMessage.choices ? (
        <div className="flex flex-col">
          {latestBotMessage.choices?.map((choice: string, index: number) => (
            <button
              key={index}
              onClick={() => handleChoice(choice)}
              className="w-full p-2 mt-2 bg-white text-black"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <>
          <input
            type="text"
            value={userInput}
            onChange={handleInputChange}
            className="w-full p-2 bg-black text-white border-b border-white focus:outline-none"
            placeholder="Type your message here..."
            aria-label="User message input"
          />
          <button onClick={handleSend} className="w-full p-2 mt-2 bg-white text-black">
            Send
          </button>
        </>
      )}
    </div>
  </div>
);

export default function Page() {
  const [showIntro, setShowIntro] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
      // Start with the first question
      const firstQuestion = questions[0];
      const botResponse: Message = {
        id: 1,
        sender: "bot",
        content: firstQuestion.question,
        choices: firstQuestion.choices,
      };
      setMessages([botResponse]);
      setCurrentQuestionIndex(1);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  }, []);

  const askNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length) {
      const nextQuestion = questions[currentQuestionIndex];
      const botResponse: Message = {
        id: messages.length + 2,
        sender: "bot",
        content: nextQuestion.question,
        choices: nextQuestion.choices,
      };
      setMessages((prevMessages) => [...prevMessages, botResponse]);
      setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentQuestionIndex, messages.length]);

  const handleSend = useCallback(() => {
    if (userInput.trim() !== "") {
      const newMessage: Message = {
        id: messages.length + 1,
        sender: "user",
        content: userInput,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setUserInput("");
      setTimeout(askNextQuestion, 1000);
    }
  }, [userInput, messages.length, askNextQuestion]);

  const handleChoice = useCallback(
    (choice: string) => {
      const newMessage: Message = {
        id: messages.length + 1,
        sender: "user",
        content: choice,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setTimeout(askNextQuestion, 1000);
    },
    [messages.length, askNextQuestion]
  );

  const latestBotMessage = messages
    .filter((message) => message.sender === "bot")
    .slice(-1)[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      {showIntro ? (
        <div className="flex flex-col items-center justify-center">
          <img
            src="/images/polstrat-dark.png"
            alt="Chatbot"
            className="w-24 h-24 mb-4"
          />
          <div className="progressive-text">
            <p className="mt-2 text-white">
              Hello! I am the Polmatch Gatekeeper. Before we finish setting up your profile, I have a few questions for you.
            </p>
          </div>
        </div>
      ) : (
        <Chatbot
          latestBotMessage={latestBotMessage}
          userInput={userInput}
          handleInputChange={handleInputChange}
          handleSend={handleSend}
          handleChoice={handleChoice}
        />
      )}
    </div>
  );
}