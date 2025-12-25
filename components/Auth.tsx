import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Mail, Lock, Loader2, ArrowRight, Github, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthProps {
    onAuthSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Minimal delay for UX to show the beautiful loading state
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                alert('確認メールを送信しました。メール内のリンクからログインを完了してください。');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onAuthSuccess();
            }
        } catch (err: any) {
            setError(err.message || '認証エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-800">
            {/* Dynamic Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-violet-200/40 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        x: [0, -50, 0],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute top-[40%] -right-[10%] w-[60vw] h-[60vw] bg-pink-200/40 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] bg-blue-200/30 rounded-full blur-[100px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[400px] z-10 px-6 sm:px-0"
            >
                <div className="mb-10 text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                        className="w-20 h-20 mx-auto bg-gradient-to-tr from-violet-500 to-pink-500 rounded-[24px] flex items-center justify-center shadow-2xl shadow-violet-500/30 text-white mb-6 transform rotate-3"
                    >
                        <Sparkles size={36} strokeWidth={1.5} />
                    </motion.div>

                    <div className="space-y-2">
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-pink-600"
                        >
                            AI Diet
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-[15px] text-slate-500 font-medium leading-relaxed"
                        >
                            {isSignUp ? '理想の自分への第一歩' : 'おかえりなさい、今日の調子は？'}
                        </motion.p>
                    </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                        className="group relative"
                    >
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors duration-300">
                            <Mail size={20} strokeWidth={2} />
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-white/60 hover:bg-white/80 focus:bg-white/90 backdrop-blur-xl h-14 pl-12 pr-4 rounded-2xl border border-white/50 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all duration-300 placeholder:text-slate-400/70 text-[15px] font-medium text-slate-700 shadow-sm hover:shadow-md focus:shadow-lg"
                            placeholder="メールアドレス"
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="group relative"
                    >
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors duration-300">
                            <Lock size={20} strokeWidth={2} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full bg-white/60 hover:bg-white/80 focus:bg-white/90 backdrop-blur-xl h-14 pl-12 pr-4 rounded-2xl border border-white/50 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all duration-300 placeholder:text-slate-400/70 text-[15px] font-medium text-slate-700 shadow-sm hover:shadow-md focus:shadow-lg"
                            placeholder="パスワード"
                        />
                    </motion.div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-3 bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-500 text-[13px] font-bold rounded-xl flex items-center gap-2.5 shadow-sm">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0 animate-pulse" />
                                    {error}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(124, 58, 237, 0.4)" }}
                        whileTap={{ scale: 0.97 }}
                        disabled={loading}
                        type="submit"
                        className="w-full h-14 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-2xl font-bold text-[15px] shadow-xl shadow-violet-500/30 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden relative border border-white/20"
                    >
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    <Loader2 className="animate-spin" size={20} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    {isSignUp ? 'アカウントを作成' : 'ログイン'}
                                    <ArrowRight size={18} strokeWidth={2.5} className="text-white/70" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>
                </form>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-10 pt-6 border-t border-slate-200/50 text-center"
                >
                    <p className="text-[12px] text-slate-400 font-medium mb-4">
                        {isSignUp ? '既にアカウントをお持ちですか？' : 'はじめてご利用ですか？'}
                    </p>
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        className="text-violet-600 hover:text-violet-700 text-[14px] font-bold transition-colors flex items-center justify-center gap-1.5 mx-auto group bg-white/50 px-4 py-2 rounded-full hover:bg-white/80"
                    >
                        {isSignUp ? 'ログイン画面へ' : '新しく始める'}
                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </motion.div>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-slate-400 font-medium"
                >
                    Protected by Supabase. Secure & Private.
                </motion.p>
            </motion.div>
        </div>
    );
};

export default Auth;
