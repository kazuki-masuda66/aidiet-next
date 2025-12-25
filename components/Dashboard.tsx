'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, MealLog } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Utensils, Flame, Droplet, ChevronLeft, ChevronRight, Pencil, Trash2, X, Save, Calendar } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

interface DashboardProps {
    user: UserProfile;
    meals: MealLog[];
    currentDate: Date;
    onPrevDate: () => void;
    onNextDate: () => void;
    onUpdateMeal: (meal: MealLog) => void;
    onDeleteMeal: (mealId: string) => void;
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#e2e8f0']; // Violet, Pink, Blue, Slate-200

// Animated Counter Component
const CountUp = ({ value, suffix = '' }: { value: number, suffix?: string }) => {
    const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
    const display = useTransform(spring, (current) => Math.round(current).toString() + suffix);

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return <motion.span>{display}</motion.span>;
};

const Dashboard: React.FC<DashboardProps> = ({ user, meals, currentDate, onPrevDate, onNextDate, onUpdateMeal, onDeleteMeal }) => {
    const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
    const [deletingMealId, setDeletingMealId] = useState<string | null>(null);

    const totalCalories = meals.reduce((acc, meal) => acc + meal.calories, 0);
    const totalProtein = meals.reduce((acc, meal) => acc + meal.protein, 0);
    const totalFat = meals.reduce((acc, meal) => acc + meal.fat, 0);
    const totalCarbs = meals.reduce((acc, meal) => acc + meal.carbs, 0);

    // Allow negative remaining
    const remaining = user.tdee - totalCalories;
    const isOver = remaining < 0;

    const pfcData = [
        { name: 'Protein', value: totalProtein * 4 },
        { name: 'Fat', value: totalFat * 9 },
        { name: 'Carbs', value: totalCarbs * 4 },
    ];

    const chartData = totalCalories > 0 ? pfcData : [{ name: 'Empty', value: 1 }];
    const chartColors = totalCalories > 0 ? COLORS : ['#f1f5f9'];

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingMealId(id);
    };

    const confirmDelete = () => {
        if (deletingMealId) {
            onDeleteMeal(deletingMealId);
            setDeletingMealId(null);
        }
    };

    const handleSaveEdit = () => {
        if (editingMeal) {
            onUpdateMeal(editingMeal);
            setEditingMeal(null);
        }
    };

    return (
        <div className="p-6 space-y-8 pb-36 pt-12">
            {/* Date Navigation */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-2"
            >
                <button onClick={onPrevDate} className="p-3 bg-white/80 hover:bg-white rounded-full text-slate-500 transition-all active:scale-95 shadow-sm hover:shadow-md backdrop-blur-md">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex flex-col items-center">
                    <motion.div
                        key={currentDate.toString()}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2"
                    >
                        <span className="text-xs font-bold text-slate-400 bg-white/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            {currentDate.getFullYear()}
                        </span>
                        {isToday(currentDate) && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse"></span>
                                TODAY
                            </span>
                        )}
                    </motion.div>
                    <motion.span
                        key={currentDate.getTime()}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="font-bold text-slate-800 text-xl mt-1"
                    >
                        {formatDate(currentDate)}
                    </motion.span>
                </div>
                <button onClick={onNextDate} className="p-3 bg-white/80 hover:bg-white rounded-full text-slate-500 transition-all active:scale-95 shadow-sm hover:shadow-md backdrop-blur-md">
                    <ChevronRight size={20} />
                </button>
            </motion.div>

            {/* Main Progress Ring - Apple Activity Ring Style */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center my-4"
            >
                {/* Ambient Glow */}
                <div className={`absolute inset-0 blur-[60px] rounded-full transition-colors duration-1000 opacity-30 ${isOver ? 'bg-red-400' : 'bg-violet-400'}`}></div>

                <div className="relative w-full h-full bg-white/60 backdrop-blur-2xl rounded-full p-6 flex flex-col items-center justify-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/80 ring-1 ring-white/60">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={105}
                                cornerRadius={10}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                                startAngle={90}
                                endAngle={-270}
                                animationBegin={200}
                                animationDuration={1500}
                                animationEasing="ease-out"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>

                    <div className="absolute flex flex-col items-center text-center">
                        <span className={`text-[10px] mb-1 font-bold uppercase tracking-widest transition-colors duration-300 ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                            {isOver ? 'Over Limit' : 'Remaining'}
                        </span>
                        <span className={`text-6xl font-extrabold tracking-tighter tabular-nums leading-none transition-colors duration-300 ${isOver ? 'text-red-500' : 'text-slate-800'}`}>
                            <CountUp value={Math.abs(remaining)} />
                        </span>
                        <div className="mt-3 flex items-center gap-2 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-100 backdrop-blur-sm">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                            <span className="text-xs text-slate-600 font-bold tabular-nums">
                                <CountUp value={Math.round(totalCalories)} suffix={` / ${user.tdee}`} />
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* PFC Cards - Refined Apple Style (Clean & Abstract) */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'タンパク質', val: totalProtein, color: 'text-violet-600', bg: 'bg-violet-50', icon: Utensils, delay: 0.3, glow: 'from-violet-500/5 to-transparent' },
                    { label: '脂質', val: totalFat, color: 'text-pink-600', bg: 'bg-pink-50', icon: Droplet, delay: 0.4, glow: 'from-pink-500/5 to-transparent' },
                    { label: '炭水化物', val: totalCarbs, color: 'text-blue-600', bg: 'bg-blue-50', icon: Flame, delay: 0.5, glow: 'from-blue-500/5 to-transparent' }
                ].map((item, i) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{ delay: item.delay, type: "spring", stiffness: 300, damping: 20 }}
                        className="relative bg-white/70 backdrop-blur-xl p-4 rounded-[1.5rem] flex flex-col justify-between items-center h-36 overflow-hidden group border border-white/60 shadow-sm hover:shadow-xl transition-all duration-300"
                    >
                        {/* Abstract Light Orb (Replaces the big icon) */}
                        <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${item.bg} blur-2xl opacity-60 group-hover:scale-125 transition-transform duration-700 pointer-events-none`} />

                        {/* Subtle Gradient Overlay */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                        <div className="relative z-10 flex flex-col h-full justify-between items-center w-full">
                            <div className={`w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center ${item.color} shadow-sm ring-1 ring-white mb-2`}>
                                <item.icon size={18} strokeWidth={2.5} />
                            </div>

                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5 opacity-80">{item.label}</span>
                                <span className="text-3xl font-bold text-slate-800 tabular-nums tracking-tight leading-none flex items-baseline justify-center">
                                    <CountUp value={Math.round(item.val)} />
                                    <span className="text-xs text-slate-400 font-bold ml-0.5">g</span>
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent Meals List */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-4"
            >
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold text-slate-800 tracking-tight">食事履歴</h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-white/50 px-2.5 py-1 rounded-full border border-white/60">{meals.length} meals</span>
                </div>

                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {meals.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center text-slate-400 py-12 bg-white/40 rounded-3xl border border-dashed border-slate-300/60"
                            >
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                                    <Utensils size={20} />
                                </div>
                                <p className="font-medium text-sm">記録がありません</p>
                                <p className="text-xs mt-1 opacity-70">チャットで食事を教えてね</p>
                            </motion.div>
                        ) : (
                            meals.slice().reverse().map((meal, index) => (
                                <motion.div
                                    key={meal.id}
                                    layout
                                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    transition={{ delay: 0.05 * index }}
                                    className="bg-white/80 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between shadow-sm border border-white/60 group relative overflow-hidden hover:bg-white transition-colors"
                                >
                                    <div className="flex-1 mr-4 relative z-10">
                                        <p className="font-bold text-slate-800 text-[15px] mb-2 line-clamp-1">{meal.name}</p>
                                        <div className="flex gap-2">
                                            <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-violet-100/50">P {meal.protein}</span>
                                            <span className="bg-pink-50 text-pink-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-pink-100/50">F {meal.fat}</span>
                                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-100/50">C {meal.carbs}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 relative z-10">
                                        <span className="font-bold text-slate-800 text-lg tabular-nums tracking-tight">{meal.calories}<span className="text-xs font-normal text-slate-400 ml-1">kcal</span></span>
                                        <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingMeal(meal)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-full transition-colors bg-slate-50 border border-slate-100"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(meal.id, e)}
                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors bg-slate-50 border border-slate-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deletingMealId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setDeletingMealId(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center space-y-4 border border-white/50"
                        >
                            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-2 ring-8 ring-red-50/50">
                                <Trash2 className="text-red-500 w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">記録を削除しますか？</h3>
                                <p className="text-slate-500 text-sm mt-1">この操作は取り消せません。</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setDeletingMealId(null)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
                                >
                                    削除する
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingMeal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-white/50"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-slate-800">記録を編集</h3>
                                <button onClick={() => setEditingMeal(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">料理名</label>
                                    <input
                                        type="text"
                                        value={editingMeal.name}
                                        onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                                        className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400">カロリー (kcal)</label>
                                    <input
                                        type="number"
                                        value={editingMeal.calories}
                                        onChange={(e) => setEditingMeal({ ...editingMeal, calories: Number(e.target.value) })}
                                        className="w-full glass-input p-3 rounded-xl font-bold text-slate-700"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">P (g)</label>
                                        <input
                                            type="number"
                                            value={editingMeal.protein}
                                            onChange={(e) => setEditingMeal({ ...editingMeal, protein: Number(e.target.value) })}
                                            className="w-full glass-input p-2 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">F (g)</label>
                                        <input
                                            type="number"
                                            value={editingMeal.fat}
                                            onChange={(e) => setEditingMeal({ ...editingMeal, fat: Number(e.target.value) })}
                                            className="w-full glass-input p-2 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400">C (g)</label>
                                        <input
                                            type="number"
                                            value={editingMeal.carbs}
                                            onChange={(e) => setEditingMeal({ ...editingMeal, carbs: Number(e.target.value) })}
                                            className="w-full glass-input p-2 rounded-xl text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveEdit}
                                className="w-full mt-8 py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg shadow-violet-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                            >
                                <Save size={20} />
                                保存する
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;