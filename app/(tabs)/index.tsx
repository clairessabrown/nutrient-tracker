import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, ActivityIndicator} from 'react-native';
import mealsStore from '../lib/store';
import * as ImagePicker from 'expo-image-picker';
import {Ionicons} from '@expo/vector-icons';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

interface Meal {
	id: string;
	timestamp: number;
	calories: number;
	protein: number;
	fiber: number;
	sugar: number;
	fat: number;
	weight: number;
}

// Nutrition logger screen: logs multiple meals and totals for the day
const NutritionLoggerScreen: React.FC = () => {
	const [calories, setCalories] = useState<string>('');
	const [protein, setProtein] = useState<string>('');
	const [fiber, setFiber] = useState<string>('');
	const [sugar, setSugar] = useState<string>('');
	const [fat, setFat] = useState<string>('');
	const [weight, setWeight] = useState<string>('');
	const [lastWeightDate, setLastWeightDate] = useState<string>(new Date().toDateString());
	const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
	const [meals, setMeals] = useState<Meal[]>(mealsStore.getMeals());
	const [editingMealId, setEditingMealId] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);

	const todayStr = new Date().toDateString();
	const todaysMeals = meals.filter(m => new Date(m.timestamp).toDateString() === todayStr);

	const totals = todaysMeals.reduce(
		(acc, meal) => ({
			calories: acc.calories + meal.calories,
			protein: acc.protein + meal.protein,
			fiber: acc.fiber + meal.fiber,
			sugar: acc.sugar + meal.sugar,
			fat: acc.fat + meal.fat,
		}),
		{calories: 0, protein: 0, fiber: 0, sugar: 0, fat: 0}
	);

	useEffect(() => {
		// Log live changes (optional) so developer can see typed values
		console.log('[NutritionLogger] input changed', {calories, protein, fiber});
	}, [calories, protein, fiber]);

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date().toLocaleTimeString());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	// Human-readable date for the header
	const dateString = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	// Check if date has changed and clear weight if needed
	const today = new Date().toDateString();
	if (today !== lastWeightDate) {
		setLastWeightDate(today);
		setWeight('');
	}

	const extractMacros = async (base64: string) => {
		if (!OPENAI_API_KEY) {
			Alert.alert('API Key Missing', 'Add your OpenAI API key to the .env file as EXPO_PUBLIC_OPENAI_API_KEY.');
			return;
		}
		setIsScanning(true);
		try {
			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: 'gpt-4o',
					messages: [
						{
							role: 'user',
							content: [
								{
									type: 'text',
									text: 'Look at this nutrition label. Extract the per-serving values and return ONLY a JSON object with these keys: calories (number), protein (number, grams), fiber (number, grams), sugar (number, grams — use added sugar if available), fat (number, grams). No extra text, just the JSON.',
								},
								{
									type: 'image_url',
									image_url: {url: `data:image/jpeg;base64,${base64}`},
								},
							],
						},
					],
					max_tokens: 200,
				}),
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error?.message || 'API error');
			}
			const text = data.choices[0].message.content.trim();
			const json = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
			const macros = JSON.parse(json);
			if (macros.calories !== undefined) setCalories(String(Math.round(macros.calories)));
			if (macros.protein !== undefined) setProtein(String(Math.round(macros.protein)));
			if (macros.fiber !== undefined) setFiber(String(Math.round(macros.fiber)));
			if (macros.sugar !== undefined) setSugar(String(Math.round(macros.sugar)));
			if (macros.fat !== undefined) setFat(String(Math.round(macros.fat)));
		} catch (err: any) {
			Alert.alert('Scan Failed', err.message || 'Could not read nutrition label.');
		} finally {
			setIsScanning(false);
		}
	};

	const onScanLabel = () => {
		Alert.alert('Scan Nutrition Label', 'Choose source:', [
			{
				text: 'Take Photo',
				onPress: async () => {
					const {status} = await ImagePicker.requestCameraPermissionsAsync();
					if (status !== 'granted') {
						Alert.alert('Permission needed', 'Camera access is required to take a photo.');
						return;
					}
					const result = await ImagePicker.launchCameraAsync({base64: true, quality: 0.8});
					if (!result.canceled && result.assets[0].base64) {
						await extractMacros(result.assets[0].base64);
					}
				},
			},
			{
				text: 'Choose from Library',
				onPress: async () => {
					const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
					if (status !== 'granted') {
						Alert.alert('Permission needed', 'Photo library access is required.');
						return;
					}
					const result = await ImagePicker.launchImageLibraryAsync({base64: true, quality: 0.8});
					if (!result.canceled && result.assets[0].base64) {
						await extractMacros(result.assets[0].base64);
					}
				},
			},
			{text: 'Cancel', style: 'cancel'},
		]);
	};

	const onSave = () => {
		// Calories are required; other fields are optional and default to 0
		const cal = parseInt(calories, 10);
		if (Number.isNaN(cal)) {
			Alert.alert('Invalid input', 'Please enter a numeric value for calories.');
			return;
		}

		const prot = protein.trim() === '' ? 0 : parseInt(protein, 10);
		const fib = fiber.trim() === '' ? 0 : parseInt(fiber, 10);
		const sug = sugar.trim() === '' ? 0 : parseInt(sugar, 10);
		const f = fat.trim() === '' ? 0 : parseInt(fat, 10);
		const weightBlank = weight.trim() === '';

		// normalize optional numeric fields to 0 if NaN
		const protVal = Number.isNaN(prot as any) ? 0 : prot;
		const fibVal = Number.isNaN(fib as any) ? 0 : fib;
		const sugVal = Number.isNaN(sug as any) ? 0 : sug;
		const fatVal = Number.isNaN(f as any) ? 0 : f;

		// Determine weight: inherit last weight recorded today if input is blank
		let weightVal = 0;
		if (!weightBlank) {
			const parsed = parseFloat(weight);
			weightVal = Number.isNaN(parsed) ? 0 : parsed;
		} else {
			const todayKey = new Date().toDateString();
			// find last meal for today, excluding current editing meal if any
			const last = [...meals].reverse().find(m => {
				if (new Date(m.timestamp).toDateString() !== todayKey) return false;
				if (editingMealId && m.id === editingMealId) return false;
				return true;
			});
			if (last && typeof last.weight === 'number' && !Number.isNaN(last.weight)) {
				weightVal = last.weight;
			} else {
				weightVal = 0;
			}
		}

		if (editingMealId) {
			// Update existing meal
			mealsStore.updateMeal(editingMealId, {
				calories: cal,
				protein: protVal,
				fiber: fibVal,
				sugar: sugVal,
				fat: fatVal,
				weight: weightVal,
			});
			setEditingMealId(null);
			Alert.alert('Meal Updated');
		} else {
			// Add new meal
			const newMeal: Meal = {
				id: Date.now().toString(),
				timestamp: Date.now(),
				calories: cal,
				protein: protVal,
				fiber: fibVal,
				sugar: sugVal,
				fat: fatVal,
				weight: weightVal,
			};

			// Log the meal and add to store
			console.log('[NutritionLogger] meal added', newMeal);
			mealsStore.addMeal(newMeal);
			Alert.alert('Meal Added', `Calories: ${cal}\nProtein: ${protVal} g\nFiber: ${fibVal} g\nSugar: ${sugVal} g\nFat: ${fatVal} g\nWeight: ${weightVal} lbs`);
		}

		setCalories('');
		setProtein('');
		setFiber('');
		setSugar('');
		setFat('');
		// keep weight unless it's a new day
	};

	const onDeleteMeal = (id: string) => {
		mealsStore.deleteMeal(id);
	};

	const onEditMeal = (meal: Meal) => {
		setEditingMealId(meal.id);
		setCalories(meal.calories.toString());
		setProtein(meal.protein.toString());
		setFiber(meal.fiber.toString());
		setSugar(meal.sugar.toString());
		setFat(meal.fat.toString());
		setWeight(meal.weight.toString());
	};

	const onCancelEdit = () => {
		setEditingMealId(null);
		setCalories('');
		setProtein('');
		setFiber('');
		setSugar('');
		setFat('');
	};

	useEffect(() => {
		const unsub = mealsStore.subscribe(() => setMeals(mealsStore.getMeals()));
		return unsub;
	}, []);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Nutrition Logger</Text>
			<Text style={styles.date}>{dateString}</Text>
			<Text style={styles.time}>{currentTime}</Text>

			<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
				{/* Inputs */}
				<View style={styles.field}>
					<Text style={styles.label}>Calories</Text>
					<TextInput
						style={styles.input}
						placeholder="e.g. 1700"
						keyboardType="numeric"
						value={calories}
						onChangeText={setCalories}
						accessibilityLabel="calories-input"
					/>
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>Protein (g)</Text>
					<TextInput
						style={styles.input}
						placeholder="e.g. 109"
						keyboardType="numeric"
						value={protein}
						onChangeText={setProtein}
						accessibilityLabel="protein-input"
					/>
				</View>

			<View style={styles.field}>
				<Text style={styles.label}>Fiber (g)</Text>
				<TextInput
					style={styles.input}
					placeholder="e.g. 25"
					keyboardType="numeric"
					value={fiber}
					onChangeText={setFiber}
					accessibilityLabel="fiber-input"
				/>
			</View>

			<View style={styles.field}>
				<Text style={styles.label}>Added Sugar (g)</Text>
				<TextInput
					style={styles.input}
					placeholder="e.g. 10"
					keyboardType="numeric"
					value={sugar}
					onChangeText={setSugar}
					accessibilityLabel="sugar-input"
				/>
			</View>

			<View style={styles.field}>
				<Text style={styles.label}>Fat (g)</Text>
				<TextInput
					style={styles.input}
					placeholder="e.g. 15"
					keyboardType="numeric"
					value={fat}
					onChangeText={setFat}
					accessibilityLabel="fat-input"
				/>
			</View>

			<View style={styles.field}>
				<Text style={styles.label}>Weight (lbs)</Text>
				<TextInput
					style={styles.input}
					placeholder="e.g. 160"
					keyboardType="decimal-pad"
					value={weight}
					onChangeText={setWeight}
					accessibilityLabel="weight-input"
				/>
			</View>

			<TouchableOpacity style={styles.scanButton} onPress={onScanLabel} disabled={isScanning}>
				{isScanning ? (
					<ActivityIndicator color="#e8f5e9" size="small" />
				) : (
					<Ionicons name="camera" size={22} color="#e8f5e9" />
				)}
				<Text style={styles.scanText}>{isScanning ? 'Scanning...' : 'Scan Label'}</Text>
			</TouchableOpacity>

			<View style={styles.button}>
				<Button
					title={editingMealId ? "Update Meal" : "Add Meal"}
					onPress={onSave}
					color="#f5efe8ff"
				/>
			</View>

			{editingMealId && (
				<View style={styles.button}>
					<Button title="Cancel Edit" onPress={onCancelEdit} color="#ff6b6b" />
				</View>
			)}

				{/* History is accessible via the Export tab */}

				{/* Totals */}
			{todaysMeals.length > 0 && (
				<View style={styles.totalsSection}>
					<Text style={styles.totalsTitle}>Daily Totals</Text>
					<Text style={styles.totalsText}>Calories: {totals.calories} kcal</Text>
					<Text style={styles.totalsText}>Protein: {totals.protein} g</Text>
					<Text style={styles.totalsText}>Fiber: {totals.fiber} g</Text>
					<Text style={styles.totalsText}>Sugar: {totals.sugar} g</Text>
					<Text style={styles.totalsText}>Fat: {totals.fat} g</Text>
				</View>
			)}

			{/* Meals list */}
			<View style={styles.mealsSection}>
				<Text style={styles.mealsTitle}>Meals ({todaysMeals.length})</Text>
				{todaysMeals.map((meal, index) => (
					<View key={meal.id as any} style={styles.mealItem}>
						<View style={{flex: 1}}>
							<Text style={styles.mealNumber}>Meal {index + 1}</Text>
							<Text style={styles.mealText}>Calories: {meal.calories} kcal</Text>
							<Text style={styles.mealText}>Protein: {meal.protein} g</Text>
							<Text style={styles.mealText}>Fiber: {meal.fiber} g</Text>
							<Text style={styles.mealText}>Sugar: {meal.sugar} g</Text>
							<Text style={styles.mealText}>Fat: {meal.fat} g</Text>
							<Text style={styles.mealText}>Weight: {meal.weight} lbs</Text>
						</View>
						<View style={styles.mealActions}>
							<Button title="Edit" onPress={() => onEditMeal(meal)} color="#500707ff" />
							<Button title="Delete" onPress={() => onDeleteMeal(meal.id)} color="#ffffff" />
						</View>
					</View>
				))}
			</View>
		</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#0b524dff',
	},
	title: {
		fontSize: 22,
		fontWeight: '600',
		marginBottom: 16,
		marginTop: 40,
		textAlign: 'center',
		color: '#e8f5e9',
	},
	inputSection: {
		flex: 1,
		marginBottom: 12,
	},
	content: {
		flex: 1,
	},
	contentContainer: {
		paddingBottom: 40,
	},
	field: {
		marginBottom: 12,
	},
	label: {
		marginBottom: 6,
		fontSize: 14,
		color: '#e8f5e9',
	},
	input: {
		borderWidth: 1,
		borderColor: '#042321ff',
		padding: 10,
		borderRadius: 6,
		fontSize: 16,
	},
	scanButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#0a3d39',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 20,
		marginBottom: 10,
		gap: 8,
	},
	scanText: {
		color: '#e8f5e9',
		fontSize: 15,
		fontWeight: '500',
	},
	button: {
		marginTop: -10,
		marginBottom: 12,
		color: '#e8f5e9',
	},
	totalsSection: {
		backgroundColor: '#e8f5e9',
		borderRadius: 6,
		padding: 12,
		marginBottom: 12,
	},
	totalsTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8,
		color: '#2e7d32',
	},
	totalsText: {
		fontSize: 14,
		marginBottom: 4,
		color: '#1b5e20',
	},
	mealsSection: {
		flex: 1,
		marginBottom: 12,
	},
	mealsTitle: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8,
		color: '#1f2d20ff',
	},
	mealItem: {
		backgroundColor: '#ed5252ff',
		borderRadius: 6,
		padding: 12,
		marginBottom: 8,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	mealActions: {
		flexDirection: 'row',
		gap: 8,
	},
	mealNumber: {
		fontSize: 14,
		fontWeight: '600',
		marginBottom: 4,
	},
	mealText: {
		fontSize: 12,
		marginBottom: 2,
	},
	saved: {
		marginTop: 16,
		padding: 8,
		backgroundColor: '#f4f4f4',
		borderRadius: 6,
	},
	date: {
		fontSize: 14,
		color: '#e8f5e9',
		textAlign: 'center',
		marginBottom: 4,
	},
	time: {
		fontSize: 13,
		color: '#e8f5e9',
		textAlign: 'center',
		marginBottom: 12,
	},
});

export default NutritionLoggerScreen;
