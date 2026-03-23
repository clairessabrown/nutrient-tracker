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
let loaded = false;
let loadPromise: Promise<void> | null = null;

const STORAGE_KEY = 'nutrition_meals';

const notify = () => listeners.forEach(l => l());

const saveMeals = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  } catch (e) {
    console.error('Failed to save meals', e);
  }
};

const loadMeals = async () => {
  if (loaded) return;
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      meals = JSON.parse(data);
    }
    loaded = true;
    notify();
  } catch (e) {
    console.error('Failed to load meals', e);
  }
};

const ensureLoaded = async () => {
  if (!loaded) {
    if (!loadPromise) loadPromise = loadMeals();
    await loadPromise;
  }
};

export const getMeals = () => meals.slice();

export const addMeal = async (meal: MealRecord) => {
  await ensureLoaded();
  meals.push(meal);
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  meals = meals.filter(m => m.timestamp > oneYearAgo);
  saveMeals();
  notify();
};

export const deleteMeal = async (id: string) => {
  await ensureLoaded();
  const idx = meals.findIndex(m => m.id === id);
  if (idx >= 0) {
    meals.splice(idx, 1);
    saveMeals();
    notify();
  }
};

export const updateMeal = async (id: string, updated: Partial<MealRecord>) => {
  await ensureLoaded();
  const idx = meals.findIndex(m => m.id === id);
  if (idx >= 0) {
    meals[idx] = {...meals[idx], ...updated};
    saveMeals();
    notify();
  }
};

export const clearMeals = () => {
  meals.length = 0;
  saveMeals();
  notify();
};

export const subscribe = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
};

// Load persisted meals on startup
loadPromise = loadMeals();

export default {getMeals, addMeal, deleteMeal, updateMeal, clearMeals, subscribe, loadMeals};
