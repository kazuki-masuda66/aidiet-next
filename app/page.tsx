'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, MealLog, ChatMessage, CoachProfile } from '@/types';
import { INITIAL_USER_STATE, DEFAULT_COACH, calculateTDEE } from '@/constants';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import ChatInterface from '@/components/ChatInterface';
import Auth from '@/components/Auth'; // New Auth Component
import { LayoutDashboard, MessageCircle, User, Wand2, UserX, Key, Lock, AlertTriangle, Pencil, X, Save, LogOut } from 'lucide-react';
import { createNewCoach } from '@/lib/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { getUserProfile, getMeals, getChatLogs, migrateData, upsertUserProfile, addMeal as addMealToDb, updateMealInDb, deleteMealFromDb, addChatLog } from '@/lib/db';
import { Session } from '@supabase/supabase-js';

// Add global declaration for aistudio
declare global {
    interface Window {
        aistudio?: {
            hasSelectedApiKey: () => Promise<boolean>;
            openSelectKey: () => Promise<void>;
        };
    }
}

// Tabs
enum Tab {
    DASHBOARD = 'dashboard',
    CHAT = 'chat',
    PROFILE = 'profile'
}

type RegenerationStep = 'idle' | 'confirm' | 'select_type' | 'searching' | 'negotiating' | 'completed';

const Home: React.FC = () => {
    // Session State
    const [session, setSession] = useState<Session | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // State
    const [user, setUser] = useState<UserProfile>(INITIAL_USER_STATE);
    const [meals, setMeals] = useState<MealLog[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // API Key State
    const [hasApiKey, setHasApiKey] = useState(false);

    // Date State for Dashboard
    const [currentDate, setCurrentDate] = useState(new Date());

    // Coach Regeneration State
    const [regenerationStep, setRegenerationStep] = useState<RegenerationStep>('idle');
    const [nextCoachType, setNextCoachType] = useState<string>('');
    const [nextCoach, setNextCoach] = useState<CoachProfile | null>(null);

    // Profile Editing State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    // Logout Modal State
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // 1. Auth & Data Init
    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) initializeData(session.user.id);
            setAuthLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) initializeData(session.user.id);
            else {
                // Reset state on logout
                setUser(INITIAL_USER_STATE);
                setMeals([]);
                setMessages([]);
                setIsInitialized(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Data Initialization Logic
    const initializeData = async (userId: string) => {
        try {
            // Check if user has profile in DB
            const profile = await getUserProfile(userId);

            if (profile) {
                // Load from DB
                setUser(profile);
                const dbMeals = await getMeals(userId);
                setMeals(dbMeals);
                const dbChat = await getChatLogs(userId);
                if (dbChat.length > 0) {
                    setMessages(dbChat);
                } else {
                    // Default welcome if no chat
                    setMessages([{
                        id: 'init',
                        role: 'model',
                        text: 'こんにちは！食事の写真を送るか、テキストで教えてね。',
                        timestamp: Date.now(),
                        coachName: DEFAULT_COACH.name,
                        coachAvatarUrl: DEFAULT_COACH.avatarUrl
                    }]);
                }
            } else {
                // No profile in DB. Check localStorage for migration
                const savedUser = localStorage.getItem('lumina_user');
                const savedMeals = localStorage.getItem('lumina_meals');
                const savedMessages = localStorage.getItem('lumina_messages');

                if (savedUser) {
                    // Start Migration
                    try {
                        const parsedUser = JSON.parse(savedUser);
                        const parsedMeals = savedMeals ? JSON.parse(savedMeals) : [];
                        const parsedMessages = savedMessages ? JSON.parse(savedMessages) : [];

                        // Fix format compatibility
                        if (!parsedUser.coach && parsedUser.lumiAvatarUrl) {
                            parsedUser.coach = { ...DEFAULT_COACH, avatarUrl: parsedUser.lumiAvatarUrl };
                        }

                        // Perform Migration
                        await migrateData(userId, parsedUser, parsedMeals, parsedMessages);

                        // Reload data from DB to be sure
                        const newProfile = await getUserProfile(userId);
                        setUser(newProfile || parsedUser); // Fallback to parsed if instant read fails (lag)
                        setMeals(await getMeals(userId));
                        setMessages(await getChatLogs(userId));

                        // Optional: Clear localStorage after successful migration
                        localStorage.removeItem('lumina_user');
                        localStorage.removeItem('lumina_meals');
                        localStorage.removeItem('lumina_messages');
                        console.log("Migration successful");

                    } catch (e) {
                        console.error("Migration failed:", e);
                        // Fallback to fresh user if migration fails
                    }
                } else {
                    // New User (No localStorage)
                    // Nothing to load, user will be prompted with Onboarding
                }
            }
        } catch (e) {
            console.error("Initialization error:", e);
        } finally {
            setIsInitialized(true);
        }
    };

    // Check API Key
    useEffect(() => {
        const checkApiKey = async () => {
            if (window.aistudio) {
                const selected = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(selected);
            } else {
                setHasApiKey(!!process.env.NEXT_PUBLIC_GEMINI_API_KEY);
            }
        };
        checkApiKey();
    }, []);


    // Handlers
    const handleApiKeySelect = async () => {
        if (window.aistudio) {
            try {
                await window.aistudio.openSelectKey();
                setHasApiKey(true);
            } catch (e: any) {
                console.error("API Key Selection Error:", e);
                if (e.message?.includes("Requested entity was not found")) {
                    alert("エラーが発生しました。もう一度お試しください。");
                }
            }
        } else {
            alert("API Key Selector is not available in this environment.");
        }
    };

    const handleOnboardingComplete = async (profile: UserProfile) => {
        if (!session?.user?.id) return;

        // Optimistic UI Update
        setUser(profile);
        const coachName = profile.coach?.name || "コーチ";
        const coachAvatar = profile.coach?.avatarUrl || profile.lumiAvatarUrl;
        const greeting = profile.coach?.greeting || `${profile.name}さん！担当の${coachName}だ。これからよろしく頼むぞ！`;

        const welcomeMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'model',
            text: greeting,
            timestamp: Date.now(),
            coachName: coachName,
            coachAvatarUrl: coachAvatar
        };

        setMessages([welcomeMessage]);

        // DB Sync
        try {
            await upsertUserProfile(session.user.id, profile);
            await addChatLog(session.user.id, welcomeMessage);
        } catch (e) {
            console.error("Failed to save onboarding:", e);
        }
    };

    const addMeal = async (meal: MealLog) => {
        if (!session?.user?.id) return;

        // DB Sync first (or Optimistic)
        // Here we wait for DB to get the reliable ID if we wanted, 
        // but for responsiveness we can do optimistic if we generate ID on client.
        // Supabase generates ID usually. Let's use the response from DB
        try {
            const addedMeal = await addMealToDb(session.user.id, meal);
            // If success, update state
            if (addedMeal) {
                // Adapt DB response to State format
                const newMealState: MealLog = {
                    ...meal, // Keep local props like confirmationMessage 
                    id: addedMeal.id, // Use DB UUID
                    imagePath: addedMeal.image_path
                };
                setMeals(prev => [...prev, newMealState]);
            } else {
                // Fallback if return is null (shouldn't happen with .select())
                setMeals(prev => [...prev, meal]);
            }
        } catch (e) {
            console.error("Failed to add meal:", e);
            // Still add to local state to not block user? Or show error?
            // For now, allow local add but warn
            setMeals(prev => [...prev, meal]);
        }
    };

    const updateMeal = async (updatedMeal: MealLog) => {
        setMeals(prev => prev.map(m => m.id === updatedMeal.id ? updatedMeal : m));
        // DB Sync
        try {
            await updateMealInDb(updatedMeal);
        } catch (e) {
            console.error("Failed to update meal:", e);
        }
    };

    const deleteMeal = async (mealId: string) => {
        setMeals(prev => prev.filter(m => m.id !== mealId));
        try {
            await deleteMealFromDb(mealId);
        } catch (e) {
            console.error("Failed to delete meal:", e);
        }
    };

    // Wrapper for chat interface to save messages
    const updateMessages = async (newMessagesOrFn: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        // Resolve new state
        let newMessages: ChatMessage[];
        if (typeof newMessagesOrFn === 'function') {
            newMessages = newMessagesOrFn(messages);
        } else {
            newMessages = newMessagesOrFn;
        }

        setMessages(newMessages);

        // Identify new messages to save
        // This is tricky with setMessages logic. 
        // A better approach is to have an `onAddMessage` prop in ChatInterface, but for now:
        const added = newMessages.filter(nm => !messages.find(om => om.id === nm.id));

        if (session?.user?.id) {
            for (const m of added) {
                addChatLog(session.user.id, m).catch(console.error);
            }
        }
    };


    const getMealsForDate = (date: Date) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return meals.filter(m => m.timestamp >= startOfDay.getTime() && m.timestamp <= endOfDay.getTime());
    };

    const handlePrevDate = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 1);
        setCurrentDate(newDate);
    };

    const handleNextDate = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 1);
        setCurrentDate(newDate);
    };

    // --- Profile Editing Logic ---
    const openProfileEdit = () => {
        setEditingUser({ ...user });
        setIsEditingProfile(true);
    };

    const handleEditChange = (field: keyof UserProfile, value: any) => {
        if (editingUser) {
            setEditingUser({ ...editingUser, [field]: value });
        }
    };

    const saveProfile = async () => {
        if (!editingUser || !session?.user?.id) return;

        const tdee = calculateTDEE(editingUser);
        const updated = { ...editingUser, tdee };
        setUser(updated);
        setIsEditingProfile(false);
        setEditingUser(null);

        // DB Sync
        try {
            await upsertUserProfile(session.user.id, updated);
        } catch (e) {
            console.error("Failed to update profile", e);
        }
    };

    // --- Coach Regeneration Logic ---

    const startCoachRegeneration = () => {
        setRegenerationStep('confirm');
    };

    const proceedToTypeSelection = () => {
        setNextCoachType(''); // Reset selection
        setRegenerationStep('select_type');
    };

    const executeRegeneration = async () => {
        setRegenerationStep('searching');
        const minWait = new Promise(resolve => setTimeout(resolve, 4000));

        try {
            setTimeout(() => {
                if (regenerationStep !== 'completed') setRegenerationStep('negotiating');
            }, 2500);

            const typeArg = nextCoachType === 'random' ? undefined : nextCoachType;
            const [newCoach] = await Promise.all([
                createNewCoach(typeArg),
                minWait
            ]);

            setNextCoach(newCoach);
            setRegenerationStep('completed');
        } catch (e) {
            console.error(e);
            alert('コーチの生成に失敗しました。もう一度お試しください。');
            setRegenerationStep('idle');
        }
    };

    const completeRegeneration = async () => {
        if (!nextCoach || !session?.user?.id) return;

        const updatedUser = { ...user, coach: nextCoach };
        setUser(updatedUser);

        const greeting = nextCoach.greeting || `はじめまして！新しく担当になった「${nextCoach.name}」だ。前のコーチから引き継ぎは受けている。これからよろしく頼む！`;
        const newMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'model',
            text: greeting,
            timestamp: Date.now(),
            coachName: nextCoach.name,
            coachAvatarUrl: nextCoach.avatarUrl
        };

        setMessages(prev => [...prev, newMsg]);

        setRegenerationStep('idle');
        setNextCoach(null);

        // DB Sync
        try {
            await upsertUserProfile(session.user.id, updatedUser);
            await addChatLog(session.user.id, newMsg);
        } catch (e) {
            console.error("Failed to sync coach change:", e);
        }
    };

    // --------------------------------

    // 0. Loading State
    if (authLoading) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
            </div>
        );
    }

    // 1. Auth Check
    if (!session) {
        return <Auth onAuthSuccess={() => { }} />;
    }

    if (!isInitialized) return null; // Wait for data load

    // 2. Check for API Key
    if (!hasApiKey) {
        // (API Key UI preserved)
        return (
            <div className="h-[100dvh] flex flex-col justify-center items-center p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-500/30 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/30 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-md w-full text-center space-y-8 relative z-10">
                    <div className="w-20 h-20 mx-auto bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
                        <Key className="w-10 h-10 text-violet-300" />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-200 to-pink-200">
                            APIキーが必要です
                        </h1>
                        <p className="text-slate-300 leading-relaxed">
                            このアプリは、最新のGemini 3モデルを使用しています。<br />
                            セキュリティのため、以下のボタンから<br />ご自身のAPIキーを接続してください。
                        </p>
                    </div>

                    <button
                        onClick={handleApiKeySelect}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-violet-900/50 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 border border-white/10"
                    >
                        <Lock size={20} />
                        最高峰のAI機能をアンロック
                    </button>

                    <p className="text-xs text-slate-500 mt-6">
                        ※ Google AI StudioのAPIキー選択画面が開きます。<br />
                        ※ 選択されたキーはアプリ内でのみ使用されます。
                    </p>
                </div>
            </div>
        );
    }

    // 3. Onboarding
    if (!user.onboardingComplete) {
        return <Onboarding onComplete={handleOnboardingComplete} />;
    }

    const currentCoach = user.coach || DEFAULT_COACH;
    const avatarUrl = currentCoach.avatarUrl || user.lumiAvatarUrl;

    return (
        <div className="h-[100dvh] bg-slate-50 text-slate-800 font-sans selection:bg-violet-200 overflow-hidden relative">
            <main className="max-w-md mx-auto h-full relative bg-white/40 shadow-2xl border-x border-white/50 flex flex-col backdrop-blur-3xl z-10">

                {/* Animated Background Ambient Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                    <motion.div
                        animate={{
                            x: [0, 30, -20, 0],
                            y: [0, -50, 20, 0],
                            scale: [1, 1.1, 0.9, 1]
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 15,
                            ease: "easeInOut"
                        }}
                        className="absolute top-[-10%] left-[-10%] w-[80%] h-[60%] bg-violet-200/50 rounded-full blur-[100px]"
                    />
                    <motion.div
                        animate={{
                            x: [0, -40, 30, 0],
                            y: [0, 40, -30, 0],
                            scale: [1, 0.9, 1.1, 1]
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 20,
                            ease: "easeInOut",
                            delay: 2
                        }}
                        className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[70%] bg-pink-200/40 rounded-full blur-[100px]"
                    />
                    <motion.div
                        animate={{
                            opacity: [0.3, 0.6, 0.3],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 8,
                            ease: "easeInOut"
                        }}
                        className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[80px]"
                    />
                </div>

                {/* Content Area with Transitions */}
                <div className={`relative z-10 flex-1 ${activeTab === Tab.CHAT ? 'overflow-hidden' : 'overflow-y-auto pb-32'}`}>
                    <AnimatePresence mode="wait">
                        {activeTab === Tab.DASHBOARD && (
                            <motion.div
                                key="dashboard"
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="h-full"
                            >
                                <Dashboard
                                    user={user}
                                    meals={getMealsForDate(currentDate)}
                                    currentDate={currentDate}
                                    onPrevDate={handlePrevDate}
                                    onNextDate={handleNextDate}
                                    onUpdateMeal={updateMeal}
                                    onDeleteMeal={deleteMeal}
                                />
                            </motion.div>
                        )}

                        {activeTab === Tab.CHAT && (
                            <motion.div
                                key="chat"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="h-full"
                            >
                                <ChatInterface
                                    user={user}
                                    onAddMeal={addMeal}
                                    messages={messages}
                                    setMessages={updateMessages}
                                    allMeals={meals}
                                />
                            </motion.div>
                        )}

                        {activeTab === Tab.PROFILE && (
                            <motion.div
                                key="profile"
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="p-6 pt-12 text-center space-y-8"
                            >
                                {/* AI Coach Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <p className="text-xs font-bold text-violet-500 uppercase tracking-widest">現在の専属AIコーチ</p>
                                    </div>

                                    <div className="relative inline-block group">
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            className="w-40 h-40 mx-auto rounded-full bg-gradient-to-tr from-violet-400 to-pink-400 p-1 shadow-xl shadow-violet-200 overflow-hidden relative"
                                        >
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="Coach" className="w-full h-full object-cover rounded-full bg-white" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white">
                                                    {currentCoach.name[0]}
                                                </div>
                                            )}
                                        </motion.div>
                                    </div>

                                    {/* Coach Profile Card */}
                                    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-4 shadow-sm text-left relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-pink-400"></div>
                                        <h3 className="font-bold text-xl text-slate-800 mb-1 flex items-center gap-2">
                                            {currentCoach.name}
                                            <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-normal">AI Coach</span>
                                        </h3>
                                        <div className="space-y-2 text-sm text-slate-600 mt-3">
                                            <p><span className="font-bold text-slate-400 text-xs uppercase mr-2">性格</span>{currentCoach.personality}</p>
                                            <p><span className="font-bold text-slate-400 text-xs uppercase mr-2">経歴</span>{currentCoach.background}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={startCoachRegeneration}
                                        className="w-full max-w-xs mx-auto py-2.5 px-4 bg-white/80 border border-red-100 text-red-400 font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500 transition-colors text-sm active:scale-95"
                                    >
                                        <UserX size={16} />
                                        このコーチを解雇して入れ替える
                                    </button>
                                </div>

                                {/* User Info Section */}
                                <div className="space-y-4 pt-6 border-t border-slate-200/50">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ユーザー情報</p>
                                        <button
                                            onClick={openProfileEdit}
                                            className="text-violet-600 hover:bg-violet-50 p-2 rounded-full transition-colors active:scale-95"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
                                    <p className="text-slate-500">目標: {user.goal === 'weight_loss' ? '減量' : user.goal === 'muscle_gain' ? '筋肉増量' : '維持'}</p>

                                    <div className="glass-panel p-5 rounded-xl text-left space-y-4 shadow-sm mx-2">
                                        <div className="flex justify-between border-b border-slate-100 pb-2">
                                            <span className="text-slate-500">メール</span>
                                            <span className="font-medium truncate max-w-[180px] text-right">{session?.user?.email || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-2">
                                            <span className="text-slate-500">身長</span>
                                            <span className="font-medium">{user.height} cm</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-2">
                                            <span className="text-slate-500">体重</span>
                                            <span className="font-medium">{user.weight} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">基礎代謝 (目安)</span>
                                            <span className="font-medium">{user.tdee} kcal</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowLogoutConfirm(true)}
                                        className="mt-4 text-slate-400 text-sm hover:text-red-500 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <LogOut size={16} />
                                        ログアウト
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Apple-style Fluid Bottom Navigation */}
                <nav className="absolute bottom-2 left-4 right-4 h-16 glass-panel rounded-2xl flex justify-around items-center px-2 z-50 shadow-2xl border border-white/60">
                    {[
                        { id: Tab.DASHBOARD, label: 'ホーム', icon: LayoutDashboard },
                        { id: Tab.CHAT, label: 'チャット', icon: MessageCircle },
                        { id: Tab.PROFILE, label: 'マイページ', icon: User },
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className="relative flex-1 h-full flex flex-col items-center justify-center gap-1 z-10"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-2 bg-violet-100 rounded-xl -z-10"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <tab.icon
                                    size={24}
                                    className={`transition-colors duration-200 ${isActive ? 'text-violet-600' : 'text-slate-400'}`}
                                    fill={isActive && tab.id === Tab.CHAT ? "currentColor" : "none"}
                                />
                                <span className={`text-[10px] font-bold transition-colors duration-200 ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        )
                    })}
                </nav>

                {/* Edit Profile Modal */}
                <AnimatePresence>
                    {isEditingProfile && editingUser && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto border border-white/50"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-lg text-slate-800">プロフィール編集</h3>
                                    <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">名前</label>
                                        <input
                                            type="text"
                                            value={editingUser.name}
                                            onChange={(e) => handleEditChange('name', e.target.value)}
                                            className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400">年齢</label>
                                            <input
                                                type="number"
                                                value={editingUser.age}
                                                onChange={(e) => handleEditChange('age', Number(e.target.value))}
                                                className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400">性別</label>
                                            <select
                                                value={editingUser.gender}
                                                onChange={(e) => handleEditChange('gender', e.target.value)}
                                                className="w-full glass-input p-3 rounded-xl font-bold text-slate-700 bg-white"
                                            >
                                                <option value="male">男性</option>
                                                <option value="female">女性</option>
                                                <option value="other">その他</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400">身長 (cm)</label>
                                            <input
                                                type="number"
                                                value={editingUser.height}
                                                onChange={(e) => handleEditChange('height', Number(e.target.value))}
                                                className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-400">体重 (kg)</label>
                                            <input
                                                type="number"
                                                value={editingUser.weight}
                                                onChange={(e) => handleEditChange('weight', Number(e.target.value))}
                                                className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">活動レベル</label>
                                        <select
                                            value={editingUser.activityLevel}
                                            onChange={(e) => handleEditChange('activityLevel', e.target.value)}
                                            className="w-full glass-input p-3 rounded-xl font-bold text-slate-700 bg-white"
                                        >
                                            <option value="sedentary">ほぼ座りっぱなし</option>
                                            <option value="light">少し動く (通勤・家事)</option>
                                            <option value="moderate">よく動く (立ち仕事・運動)</option>
                                            <option value="active">かなり動く (肉体労働)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">目標</label>
                                        <select
                                            value={editingUser.goal}
                                            onChange={(e) => handleEditChange('goal', e.target.value)}
                                            className="w-full glass-input p-3 rounded-xl font-bold text-slate-700 bg-white"
                                        >
                                            <option value="weight_loss">減量したい</option>
                                            <option value="muscle_gain">筋肉をつけたい</option>
                                            <option value="maintenance">今の体型を維持</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={saveProfile}
                                    className="w-full mt-8 py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg shadow-violet-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                >
                                    <Save size={20} />
                                    保存して再計算
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Logout Confirmation Modal */}
                <AnimatePresence>
                    {showLogoutConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setShowLogoutConfirm(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center space-y-4 border border-white/50"
                            >
                                <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-2 ring-8 ring-slate-50">
                                    <LogOut className="text-slate-500 w-8 h-8 ml-1" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">ログアウトしますか？</h3>
                                    <p className="text-slate-500 text-sm mt-1">またお会いできるのを楽しみにしています。</p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowLogoutConfirm(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await supabase.auth.signOut();
                                            setShowLogoutConfirm(false);
                                        }}
                                        className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-700 transition-colors"
                                    >
                                        ログアウト
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Coach Regeneration Overlay */}
                <AnimatePresence>
                    {regenerationStep !== 'idle' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center overflow-y-auto"
                        >
                            {/* Step 1: Confirm */}
                            {regenerationStep === 'confirm' && (
                                <motion.div
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8 max-w-sm"
                                >
                                    <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                                        <AlertTriangle className="text-red-500 w-10 h-10" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">本当に解雇しますか？</h2>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            現在のコーチ「{currentCoach.name}」との契約を終了します。<br />
                                            今までの会話履歴は残りますが、性格やアドバイスは完全にリセットされます。
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setRegenerationStep('idle')}
                                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            onClick={proceedToTypeSelection}
                                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/50 transition-colors"
                                        >
                                            手続きへ進む
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 2: Select Type */}
                            {regenerationStep === 'select_type' && (
                                <motion.div
                                    initial={{ scale: 0.9, x: 20, opacity: 0 }}
                                    animate={{ scale: 1, x: 0, opacity: 1 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="w-full max-w-sm"
                                >
                                    <h2 className="text-2xl font-bold mb-6">次のコーチを指名</h2>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => { setNextCoachType('sparta'); executeRegeneration(); }}
                                            className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 flex items-center justify-between group transition-all"
                                        >
                                            <span className="font-bold">🔥 超スパルタコーチ</span>
                                            <span className="text-slate-500 group-hover:text-white transition-colors">→</span>
                                        </button>
                                        <button
                                            onClick={() => { setNextCoachType('gentle'); executeRegeneration(); }}
                                            className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 flex items-center justify-between group transition-all"
                                        >
                                            <span className="font-bold">💖 超優しいお姉さん</span>
                                            <span className="text-slate-500 group-hover:text-white transition-colors">→</span>
                                        </button>
                                        <button
                                            onClick={() => { setNextCoachType('intellectual'); executeRegeneration(); }}
                                            className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 flex items-center justify-between group transition-all"
                                        >
                                            <span className="font-bold">🤓 理論派データ分析官</span>
                                            <span className="text-slate-500 group-hover:text-white transition-colors">→</span>
                                        </button>
                                        <button
                                            onClick={() => { setNextCoachType('random'); executeRegeneration(); }}
                                            className="w-full p-4 bg-gradient-to-r from-violet-600 to-pink-600 rounded-xl font-bold shadow-lg shadow-violet-900/40 hover:scale-[1.02] transition-transform"
                                        >
                                            🎲 おまかせで採用する
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setRegenerationStep('idle')}
                                        className="mt-6 text-slate-400 hover:text-white text-sm"
                                    >
                                        キャンセル
                                    </button>
                                </motion.div>
                            )}

                            {/* Step 3: Searching / Negotiating */}
                            {(regenerationStep === 'searching' || regenerationStep === 'negotiating') && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-6"
                                >
                                    <div className="relative w-24 h-24 mx-auto">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="w-full h-full rounded-full border-4 border-violet-500 border-t-transparent"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Wand2 className="text-violet-300 w-10 h-10 animate-pulse" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold mb-2">
                                            {regenerationStep === 'searching' ? '理想のコーチを探しています...' : '契約条件を交渉中...'}
                                        </h2>
                                        <p className="text-slate-400 text-sm">
                                            世界中のコーチデータベースから検索中
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 4: Completed */}
                            {regenerationStep === 'completed' && nextCoach && (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="max-w-sm w-full bg-slate-800/80 p-8 rounded-3xl border border-white/10 backdrop-blur-xl"
                                >
                                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 p-1 mb-6 shadow-xl shadow-violet-500/30">
                                        <img src={nextCoach.avatarUrl} alt="New Coach" className="w-full h-full object-cover rounded-full bg-slate-900" />
                                    </div>

                                    <h2 className="text-2xl font-bold mb-1">{nextCoach.name}</h2>
                                    <p className="text-violet-300 text-sm font-bold uppercase tracking-widest mb-6">NEW COACH</p>

                                    <div className="text-left space-y-3 bg-slate-900/50 p-4 rounded-xl mb-6">
                                        <p className="text-sm"><span className="text-slate-500 block text-xs mb-1">性格</span>{nextCoach.personality}</p>
                                        <p className="text-sm"><span className="text-slate-500 block text-xs mb-1">特徴</span>{nextCoach.background}</p>
                                    </div>

                                    <button
                                        onClick={completeRegeneration}
                                        className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-white/10"
                                    >
                                        契約成立！挨拶をする
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default Home;
