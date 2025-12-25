
export interface CoachProfile {
  name: string;
  personality: string;
  background: string;
  tone: string;
  avatarUrl: string;
  greeting?: string;
}

export interface UserProfile {
  id?: string; // Supabase UUID
  name: string; // mapped to display_name in DB
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number; // cm
  weight: number; // kg
  goal: 'weight_loss' | 'muscle_gain' | 'maintenance';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active';
  tdee: number; // Total Daily Energy Expenditure
  onboardingComplete: boolean;
  lumiAvatarUrl?: string; // Deprecated, use coach.avatarUrl
  coach?: CoachProfile; // Stored in coach_config JSONB
  email?: string; // from auth
}

export interface MealLog {
  id: string; // UUID from DB
  user_id?: string;
  timestamp: number; // calculated from consumed_at or created_at
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  imageUrl?: string; // mapped from image_path (signed url)
  imagePath?: string; // raw path in storage
  confirmationMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string; // mapped to content
  timestamp: number; // mapped to created_at
  isLogConfirmation?: boolean;
  mealData?: MealLog;
  coachName?: string;
  coachAvatarUrl?: string;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
}
