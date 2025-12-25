'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, CoachProfile } from '@/types';
import { calculateTDEE } from '@/constants';
import { createNewCoach } from '@/lib/geminiService';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Wand2, Star, Zap, Heart, BookOpen, Smile } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

type StepType = 'intro' | 'name' | 'basic_info' | 'activity' | 'goal' | 'coach_selection' | 'generating' | 'meet_coach';

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<StepType>('intro');
  const [coachType, setCoachType] = useState<string>('');
  const [generatedCoach, setGeneratedCoach] = useState<CoachProfile | null>(null);
  const [generatedProfile, setGeneratedProfile] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    age: 25,
    gender: 'female',
    height: 160,
    weight: 55,
    activityLevel: 'sedentary',
    goal: 'weight_loss'
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on step change
  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [step]);

  const handleChange = (key: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step === 'intro') setStep('name');
    else if (step === 'name' && formData.name) setStep('basic_info');
    else if (step === 'basic_info') setStep('activity');
    else if (step === 'activity') setStep('goal');
    else if (step === 'goal') setStep('coach_selection');
    else if (step === 'coach_selection') startGeneration();
    else if (step === 'meet_coach' && generatedProfile) {
      onComplete(generatedProfile);
    }
  };

  const startGeneration = async () => {
    setStep('generating');

    // Generate Coach Persona & Avatar with selected type
    const coach = await createNewCoach(coachType);
    setGeneratedCoach(coach);

    const profile: UserProfile = {
      ...(formData as UserProfile),
      onboardingComplete: true,
      tdee: 0,
      coach: coach,
      lumiAvatarUrl: coach.avatarUrl
    };
    profile.tdee = calculateTDEE(profile);
    setGeneratedProfile(profile);

    // Move to Meet Coach screen instead of completing immediately
    setStep('meet_coach');
  };

  // Variants for animation
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4 } }
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <motion.div key="intro" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="text-center space-y-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-violet-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-violet-200">
              <Sparkles className="text-white w-12 h-12 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-4 leading-tight">AIダイエットコーチへ<br />ようこそ</h1>
              <p className="text-slate-500 text-lg">あなたにぴったりのAIコーチと一緒に、<br />理想の自分を目指しましょう。</p>
            </div>
            <button onClick={handleNext} className="w-full py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-xl shadow-violet-200 hover:scale-[1.02] transition-transform">
              はじめる
            </button>
          </motion.div>
        );

      case 'name':
        return (
          <motion.div key="name" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 leading-relaxed">まずはあなたのことを<br />教えてください。<br />お名前は？</h2>
            <input
              ref={inputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && formData.name && handleNext()}
              placeholder="ニックネームを入力"
              className="w-full glass-input p-5 rounded-2xl text-xl shadow-lg"
            />
            <button
              onClick={handleNext}
              disabled={!formData.name}
              className="w-full py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              次へ <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'basic_info':
        return (
          <motion.div key="basic_info" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">{formData.name}さんですね。<br />最適なプランを作るために、<br />少しデータを入力してください。</h2>

            <div className="glass-panel p-6 rounded-2xl space-y-6 shadow-lg">
              <div className="space-y-2">
                <label className="text-sm text-slate-500 font-medium ml-1">年齢</label>
                <input type="number" value={formData.age} onChange={(e) => handleChange('age', Number(e.target.value))} className="w-full glass-input p-3 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-500 font-medium ml-1">身長 (cm)</label>
                  <input type="number" value={formData.height} onChange={(e) => handleChange('height', Number(e.target.value))} className="w-full glass-input p-3 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-500 font-medium ml-1">体重 (kg)</label>
                  <input type="number" value={formData.weight} onChange={(e) => handleChange('weight', Number(e.target.value))} className="w-full glass-input p-3 rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-500 font-medium ml-1">性別</label>
                <div className="flex gap-2">
                  {['female', 'male', 'other'].map((g) => (
                    <button
                      key={g}
                      onClick={() => handleChange('gender', g)}
                      className={`flex-1 p-3 rounded-xl border transition-all font-medium text-sm ${formData.gender === g
                          ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                          : 'bg-white text-slate-500 border-slate-200'
                        }`}
                    >
                      {g === 'female' ? '女性' : g === 'male' ? '男性' : 'その他'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleNext} className="w-full py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2">
              次へ <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'activity':
        return (
          <motion.div key="activity" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">普段の活動量は<br />どのくらいですか？</h2>
            <div className="space-y-3">
              {[
                { id: 'sedentary', label: 'ほぼ座りっぱなし', desc: 'デスクワーク中心' },
                { id: 'light', label: '少し動く', desc: '通勤や家事、散歩程度' },
                { id: 'moderate', label: 'よく動く', desc: '立ち仕事や定期的な運動' },
                { id: 'active', label: 'かなり動く', desc: '肉体労働やハードな運動' }
              ].map((act) => (
                <button
                  key={act.id}
                  onClick={() => handleChange('activityLevel', act.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center ${formData.activityLevel === act.id
                      ? 'bg-violet-50 border-violet-500 shadow-lg ring-1 ring-violet-500'
                      : 'glass-panel border-transparent hover:bg-white'
                    }`}
                >
                  <div>
                    <div className={`font-bold ${formData.activityLevel === act.id ? 'text-violet-700' : 'text-slate-700'}`}>{act.label}</div>
                    <div className={`text-xs ${formData.activityLevel === act.id ? 'text-violet-500' : 'text-slate-400'}`}>{act.desc}</div>
                  </div>
                  {formData.activityLevel === act.id && <Check size={20} className="text-violet-600" />}
                </button>
              ))}
            </div>
            <button onClick={handleNext} className="w-full py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2">
              次へ <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'goal':
        return (
          <motion.div key="goal" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">今回の目標を<br />教えてください。</h2>
            <div className="space-y-3">
              {[
                { id: 'weight_loss', label: '減量したい', icon: '🥗' },
                { id: 'muscle_gain', label: '筋肉をつけたい', icon: '💪' },
                { id: 'maintenance', label: '今の体型を維持', icon: '✨' }
              ].map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => handleChange('goal', goal.id)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all flex items-center gap-4 ${formData.goal === goal.id
                      ? 'bg-gradient-to-r from-violet-50 to-pink-50 border-violet-400 shadow-lg ring-1 ring-violet-400'
                      : 'glass-panel border-transparent hover:bg-white'
                    }`}
                >
                  <span className="text-3xl filter drop-shadow-sm">{goal.icon}</span>
                  <span className={`font-bold text-lg ${formData.goal === goal.id ? 'text-slate-800' : 'text-slate-600'}`}>{goal.label}</span>
                </button>
              ))}
            </div>
            <button onClick={handleNext} className="w-full py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4">
              次へ <ArrowRight size={20} />
            </button>
          </motion.div>
        );

      case 'coach_selection':
        return (
          <motion.div key="coach_selection" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">最後に、どんなコーチと<br />頑張りたいですか？</h2>
            <p className="text-slate-500 text-sm">あなたの好みに合わせて、AIがオリジナルのコーチを生成します。</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'スパルタ熱血', label: 'スパルタ熱血', desc: '甘えは許さん！', icon: Zap, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
                { id: '優しく癒やし', label: '優しく癒やし', desc: '無理しないでね', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
                { id: '知的でクール', label: '知的でクール', desc: 'データ重視です', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
                { id: '楽しくポジティブ', label: '楽しく陽気', desc: '笑顔でいこう！', icon: Smile, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setCoachType(type.id)}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 h-32 relative overflow-hidden ${coachType === type.id
                      ? `ring-2 ring-violet-500 shadow-lg ${type.bg}`
                      : 'bg-white border-slate-200 hover:border-violet-200 hover:shadow-md'
                    }`}
                >
                  <div className={`p-2 rounded-full w-fit ${coachType === type.id ? 'bg-white' : type.bg}`}>
                    <type.icon size={20} className={type.color} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{type.label}</div>
                    <div className="text-xs text-slate-500">{type.desc}</div>
                  </div>
                  {coachType === type.id && (
                    <div className="absolute top-2 right-2 text-violet-600">
                      <Check size={20} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={!coachType}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-pink-200 mt-4 disabled:opacity-50 disabled:shadow-none"
            >
              コーチを召喚する <Sparkles size={20} />
            </button>
          </motion.div>
        );

      case 'generating':
        return (
          <motion.div key="generating" variants={containerVariants} initial="hidden" animate="visible" className="text-center space-y-8 py-10">
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-500 to-pink-500 rounded-full animate-pulse blur-xl opacity-50"></div>
              <div className="relative bg-white/30 backdrop-blur-md w-full h-full rounded-full flex items-center justify-center border border-white/50 overflow-hidden">
                <Wand2 className="w-16 h-16 text-white animate-spin-slow" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">あなただけのコーチを<br />生成中...</h2>
              <p className="text-slate-500">性格、見た目、声をチューニングしています。<br />もう少々お待ちください。</p>
            </div>
            <div className="w-64 h-2 bg-slate-200 rounded-full mx-auto overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 10, ease: "linear" }}
              />
            </div>
          </motion.div>
        );

      case 'meet_coach':
        return (
          <motion.div key="meet_coach" className="text-center space-y-6 pt-6">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
              className="relative w-48 h-48 mx-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300 to-orange-400 rounded-full blur-[50px] opacity-60 animate-pulse"></div>
              <div className="relative w-full h-full rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
                {generatedCoach?.avatarUrl ? (
                  <img src={generatedCoach.avatarUrl} alt="Generated Coach" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">✨</div>
                )}
              </div>

              {/* Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-2 -right-2 bg-violet-600 text-white px-4 py-1 rounded-full font-bold shadow-lg border-2 border-white text-sm"
              >
                NEW COACH
              </motion.div>
            </motion.div>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <p className="text-sm font-bold text-violet-500 uppercase tracking-widest mb-2">PARTNER MATCHED!</p>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">
                  {generatedCoach?.name}
                </h2>
                <div className="flex justify-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">{coachType.split('（')[0]}</span>
                </div>
                <p className="text-slate-600 leading-relaxed max-w-xs mx-auto bg-white/50 p-4 rounded-xl border border-slate-100 italic">
                  「{generatedCoach?.tone.split('。')[0]}」
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="pt-4"
              >
                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-violet-300 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  契約を結んでスタート <Star fill="currentColor" size={20} />
                </button>
              </motion.div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center p-6 bg-gradient-to-br from-slate-50 via-violet-50 to-pink-50 overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-200/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-200/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;