'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, UserProfile, MealLog } from '@/types';
import { analyzeMeal, chatWithLumi } from '@/lib/geminiService';
import { DEFAULT_COACH } from '@/constants';
import { Send, Image as ImageIcon, Camera, Loader2, Plus, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInterfaceProps {
    user: UserProfile;
    onAddMeal: (meal: MealLog) => void;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    allMeals: MealLog[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ user, onAddMeal, messages, setMessages, allMeals }) => {
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Image Compression & Resizing
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1024; // Reduce max size to prevent localStorage quota exceeded

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress to JPEG with 0.7 quality
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setSelectedImage(compressedBase64);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const handleSend = async () => {
        if ((!inputText.trim() && !selectedImage) || isLoading) return;

        const newUserMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            text: inputText,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            let responseText = '';
            let detectedMeal: MealLog | null = null;

            if (selectedImage) {
                // Correctly extract base64 data and mime type
                const matches = selectedImage.match(/^data:(.+);base64,(.+)$/);
                const mimeType = matches ? matches[1] : 'image/jpeg';
                const base64Data = matches ? matches[2] : selectedImage.split(',')[1];

                const result = await analyzeMeal(
                    { imageBase64: base64Data, mimeType: mimeType },
                    user,
                    newUserMessage.text,
                    messages
                );
                responseText = result.text || '画像を受け取りました！';
                detectedMeal = result.meal;
                if (detectedMeal) {
                    detectedMeal.imageUrl = selectedImage;
                }
            } else {
                const result = await analyzeMeal(newUserMessage.text, user, undefined, messages);
                if (result.meal) {
                    responseText = result.text || '記録しました！';
                    detectedMeal = result.meal;
                } else {
                    const chatResponse = await chatWithLumi(
                        messages.map(m => ({ role: m.role, text: m.text })),
                        newUserMessage.text,
                        user,
                        allMeals
                    );
                    responseText = typeof chatResponse === 'string' ? chatResponse : '……';
                }
            }

            const currentCoachName = user.coach?.name || DEFAULT_COACH.name;
            const currentCoachAvatar = user.coach?.avatarUrl || user.lumiAvatarUrl;

            const modelMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: responseText,
                timestamp: Date.now(),
                isLogConfirmation: !!detectedMeal,
                mealData: detectedMeal || undefined,
                coachName: currentCoachName,
                coachAvatarUrl: currentCoachAvatar
            };

            setMessages(prev => [...prev, modelMessage]);
            setSelectedImage(null);

        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: 'ごめんね、うまく処理できなかったみたい。もう一回試してみて！',
                timestamp: Date.now(),
                coachName: user.coach?.name || DEFAULT_COACH.name,
                coachAvatarUrl: user.coach?.avatarUrl || user.lumiAvatarUrl
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const confirmMeal = (messageId: string, meal: MealLog) => {
        onAddMeal(meal);
        const confirmText = meal.confirmationMessage || "登録しました！";

        setMessages(prev => prev.map(m =>
            m.id === messageId
                ? { ...m, isLogConfirmation: false, text: `${m.text}\n\n✅ ${confirmText}` }
                : m
        ));
    };

    const renderFormattedText = (text: any) => {
        if (text === null || text === undefined) return null;

        let safeText = '';
        if (typeof text === 'string') {
            safeText = text;
        } else if (typeof text === 'object') {
            try {
                safeText = JSON.stringify(text);
            } catch {
                safeText = '...';
            }
        } else {
            safeText = String(text);
        }

        if (!safeText) return null;

        try {
            return safeText.split(/(\*\*.*?\*\*)/g).map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="font-bold text-violet-700">{part.slice(2, -2)}</strong>;
                }
                return part;
            });
        } catch (e) {
            console.error("Text render error:", e);
            return safeText;
        }
    };

    return (
        <div className="flex flex-col h-full relative bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-44">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        if (!msg) return null;
                        const displayAvatarUrl = msg.coachAvatarUrl || (user.coach?.avatarUrl || user.lumiAvatarUrl);

                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 min-w-[32px] rounded-full overflow-hidden bg-gradient-to-tr from-violet-200 to-pink-200 border border-white shadow-sm flex items-center justify-center">
                                        {displayAvatarUrl ? (
                                            <img src={displayAvatarUrl} alt={msg.coachName || "Coach"} className="w-full h-full object-cover" />
                                        ) : (
                                            <Sparkles size={16} className="text-violet-500" />
                                        )}
                                    </div>
                                )}

                                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm relative ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-violet-600 to-violet-500 text-white rounded-br-none'
                                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                                    }`}>
                                    <p className={`whitespace-pre-wrap leading-relaxed text-[15px] ${msg.role === 'user' ? 'text-white' : 'text-slate-800'}`}>
                                        {msg.role === 'model' ? renderFormattedText(msg.text) : (msg.text || '')}
                                    </p>

                                    {msg.isLogConfirmation && msg.mealData && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-200 overflow-hidden"
                                        >
                                            {msg.mealData.imageUrl && (
                                                <img src={msg.mealData.imageUrl} alt="Meal" className="w-full h-32 object-cover rounded-lg mb-3 shadow-sm" />
                                            )}
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-800 text-sm truncate pr-2">{msg.mealData.name}</span>
                                                <span className="font-bold text-violet-600 text-sm whitespace-nowrap">{msg.mealData.calories} kcal</span>
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-500 mb-3 font-medium">
                                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-100">P: {msg.mealData.protein}</span>
                                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-100">F: {msg.mealData.fat}</span>
                                                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-100">C: {msg.mealData.carbs}</span>
                                            </div>
                                            <button
                                                onClick={() => confirmMeal(msg.id, msg.mealData!)}
                                                className="w-full py-2.5 bg-violet-600 text-white text-sm rounded-lg font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-violet-200"
                                            >
                                                <Plus size={16} /> 記録する
                                            </button>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 flex gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 pt-2 pb-28 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent z-10">
                <AnimatePresence>
                    {selectedImage && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mb-3 relative inline-block"
                        >
                            <img src={selectedImage} alt="Preview" className="h-24 rounded-xl border-2 border-white shadow-lg rotate-[-2deg]" />
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 shadow-lg hover:bg-black transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-3 items-end">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3.5 bg-white rounded-full text-slate-500 hover:text-violet-600 transition-colors shadow-sm border border-slate-200 active:scale-95"
                    >
                        <Camera size={22} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        className="hidden"
                    />

                    <div className="flex-1 bg-white rounded-3xl flex items-center p-1.5 pl-4 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-violet-100 focus-within:border-violet-300 transition-all duration-300">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="メッセージを入力..."
                            className="w-full bg-transparent border-none focus:ring-0 outline-none text-slate-800 resize-none max-h-24 py-3 placeholder-slate-400 text-[15px]"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={isLoading || (!inputText && !selectedImage)}
                        className="relative p-3.5 bg-violet-600 rounded-full text-white shadow-lg shadow-violet-200 disabled:opacity-50 disabled:shadow-none transition-all hover:bg-violet-700 active:scale-95 flex items-center justify-center"
                    >
                        <Send size={22} className={`transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`} />
                        {isLoading && <Loader2 size={22} className="absolute animate-spin" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;