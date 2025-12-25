import { supabase } from './supabaseClient';
import { UserProfile, MealLog, ChatMessage } from '@/types';
import { DEFAULT_COACH } from '@/constants';

// --- User Profile ---

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error fetching profile:', error);
        return null;
    }

    // Transform DB snake_case to CamelCase
    return {
        id: data.id,
        name: data.display_name,
        age: data.age,
        gender: data.gender,
        height: data.height,
        weight: data.weight,
        goal: data.goal,
        activityLevel: data.activity_level,
        tdee: data.tdee,
        onboardingComplete: true, // If profile exists, onboarding is passed
        coach: data.coach_config || DEFAULT_COACH,
        email: undefined // Managed by auth
    };
}

export async function upsertUserProfile(userId: string, profile: UserProfile) {
    const dbPayload = {
        id: userId,
        display_name: profile.name,
        age: profile.age,
        gender: profile.gender,
        height: profile.height,
        weight: profile.weight,
        goal: profile.goal,
        activity_level: profile.activityLevel,
        tdee: profile.tdee,
        coach_config: profile.coach,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('profiles')
        .upsert(dbPayload);

    if (error) throw error;
}

// --- Meals ---

export async function getMeals(userId: string): Promise<MealLog[]> {
    const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('consumed_at', { ascending: true });

    if (error) {
        console.error('Error fetching meals:', error);
        return [];
    }

    return data.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        timestamp: new Date(m.consumed_at).getTime(),
        name: m.name,
        calories: m.calories,
        protein: m.protein,
        fat: m.fat,
        carbs: m.carbs,
        imageUrl: m.image_path, // Note: Assuming image_path stores the full URL or we process it later
        imagePath: m.image_path
    }));
}

export async function addMeal(userId: string, meal: MealLog) {
    // Use upsert if id is preserved, or insert
    const { data, error } = await supabase
        .from('meals')
        .insert({
            user_id: userId,
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            fat: meal.fat,
            carbs: meal.carbs,
            image_path: meal.imageUrl || null,
            consumed_at: new Date(meal.timestamp).toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateMealInDb(meal: MealLog) {
    const { error } = await supabase
        .from('meals')
        .update({
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            fat: meal.fat,
            carbs: meal.carbs,
            image_path: meal.imageUrl || null,
            consumed_at: new Date(meal.timestamp).toISOString()
        })
        .eq('id', meal.id);

    if (error) throw error;
}

export async function deleteMealFromDb(mealId: string) {
    const { error } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId);

    if (error) throw error;
}

// --- Chat Logs ---

export async function getChatLogs(userId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching chat logs:', error);
        return [];
    }

    return data.map((log: any) => ({
        id: log.id,
        role: log.role === 'assistant' ? 'model' : log.role, // Map back to 'model' for frontend
        text: log.content,
        timestamp: new Date(log.created_at).getTime(),
        coachName: log.metadata?.coachName,
        coachAvatarUrl: log.metadata?.coachAvatarUrl
    }));
}

export async function addChatLog(userId: string, message: ChatMessage) {
    const { error } = await supabase
        .from('chat_logs')
        .insert({
            user_id: userId,
            role: message.role === 'model' ? 'assistant' : 'user',
            content: message.text,
            metadata: {
                coachName: message.coachName,
                coachAvatarUrl: message.coachAvatarUrl,
                isLogConfirmation: message.isLogConfirmation
            }
        });

    if (error) throw error;
}

// --- Migration ---

export async function migrateData(userId: string, user: UserProfile, meals: MealLog[], messages: ChatMessage[]) {
    // 1. Profile
    await upsertUserProfile(userId, user);

    // 2. Meals
    if (meals.length > 0) {
        const mealRows = meals.map(m => ({
            user_id: userId,
            name: m.name,
            calories: m.calories,
            protein: m.protein,
            fat: m.fat,
            carbs: m.carbs,
            image_path: m.imageUrl || null,
            consumed_at: new Date(m.timestamp).toISOString()
        }));
        await supabase.from('meals').insert(mealRows);
    }

    // 3. Chat Logs
    if (messages.length > 0) {
        const chatRows = messages.map(m => ({
            user_id: userId,
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.text,
            metadata: {
                coachName: m.coachName,
                coachAvatarUrl: m.coachAvatarUrl
            },
            created_at: new Date(m.timestamp).toISOString()
        }));
        await supabase.from('chat_logs').insert(chatRows);
    }
}
