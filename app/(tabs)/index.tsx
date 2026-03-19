import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, Button, StyleSheet, Alert, ScrollView} from 'react-native';
import mealsStore from '../lib/store';

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
	const [meals, setMeals] = useState<Meal[]>(mealsStore.getMeals());
	const [editingMealId, setEditingMealId] = useState<string | null>(null);

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
		marginBottom: 8,
	},
});

export default NutritionLoggerScreen;
