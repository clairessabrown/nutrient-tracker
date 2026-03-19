import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = () => void;

export interface MealRecord {
  id: string;
  timestamp: number;
  calories: number;
  protein: number;
  fiber: number;
  sugar: number;
  fat: number;
  weight: number;
}

let meals: MealRecord[] = [];
const listeners: Listener[] = [];

const STORAGE_KEY = 'nutrition_meals';

const saveMeals = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  } catch (e) {
    console.error('Failed to save meals', e);
  }
};

const loadMeals = async () => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      meals = JSON.parse(data);
      listeners.forEach(l => l());
    }
  } catch (e) {
    console.error('Failed to load meals', e);
  }
};

export const getMeals = () => meals.slice();

export const addMeal = (meal: MealRecord) => {
  meals.push(meal);
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  meals = meals.filter(m => m.timestamp > oneYearAgo);
  saveMeals();
  listeners.forEach(l => l());
};

export const deleteMeal = (id: string) => {
  const idx = meals.findIndex(m => m.id === id);
  if (idx >= 0) {
    meals.splice(idx, 1);
    saveMeals();
    listeners.forEach(l => l());
  }
};

export const updateMeal = (id: string, updated: Partial<MealRecord>) => {
  const idx = meals.findIndex(m => m.id === id);
  if (idx >= 0) {
    meals[idx] = {...meals[idx], ...updated};
    saveMeals();
    listeners.forEach(l => l());
  }
};

export const clearMeals = () => {
  meals.length = 0;
  saveMeals();
  listeners.forEach(l => l());
};

export const subscribe = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
};

// Load persisted meals on startup
loadMeals();

export default {getMeals, addMeal, deleteMeal, updateMeal, clearMeals, subscribe, loadMeals};
