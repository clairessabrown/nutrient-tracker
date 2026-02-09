import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import mealsStore, {MealRecord} from '../lib/store';

const formatDateKey = (ts: number) => new Date(ts).toDateString();
const formatDateLabel = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});

type DayTotals = {
  dateKey: string; // toDateString()
  label: string; // human label with weekday
  calories: number;
  protein: number;
  fiber: number;
  sugar: number;
  fat: number;
  weight?: number; // last weight recorded that day
};

const WeekLog: React.FC = () => {
  const [meals, setMeals] = useState<MealRecord[]>(mealsStore.getMeals());

  useEffect(() => {
    const unsub = mealsStore.subscribe(() => setMeals(mealsStore.getMeals()));
    return unsub;
  }, []);

  // Build last 7 days keys (including today)
  const today = new Date();
  const last7Dates = Array.from({length: 7}).map((_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - i);
    return d;
  });

  // Group meals by dateKey
  const grouped: Record<string, MealRecord[]> = {};
  meals.forEach(m => {
    const k = formatDateKey(m.timestamp);
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(m);
  });

  const rows: DayTotals[] = last7Dates.map(d => {
    const key = d.toDateString();
    const list = grouped[key] || [];
    const totals = list.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        fiber: acc.fiber + m.fiber,
        sugar: acc.sugar + m.sugar,
        fat: acc.fat + m.fat,
      }),
      {calories: 0, protein: 0, fiber: 0, sugar: 0, fat: 0}
    );
    // pick last weight for that day if present
    const lastWeight = list.length ? list[list.length - 1].weight : undefined;
    return {
      dateKey: key,
      label: formatDateLabel(d.getTime()),
      calories: totals.calories,
      protein: totals.protein,
      fiber: totals.fiber,
      sugar: totals.sugar,
      fat: totals.fat,
      weight: lastWeight,
    };
  });

  const renderItem = ({item}: {item: DayTotals}) => (
    <View style={styles.row}>
      <Text style={styles.date}>{item.label}</Text>
      <View style={styles.totalsRow}>
        <Text style={styles.cell}>Cal: {item.calories}</Text>
        <Text style={styles.cell}>Protein: {item.protein}g</Text>
        <Text style={styles.cell}>Fiber: {item.fiber}g</Text>
        <Text style={styles.cell}>Sug: {item.sugar}g</Text>
        <Text style={styles.cell}>Fat: {item.fat}g</Text>
        <Text style={styles.cell}>Weight: {item.weight ?? '-'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Week Log (Last 7 Days)</Text>
      <FlatList
        data={rows}
        keyExtractor={r => r.dateKey}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No data for the past 7 days.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, backgroundColor: '#2b3294ff'},
  title: {fontSize: 20, fontWeight: '600', marginBottom: 12, marginTop: 60, color: '#ffffff'},
  row: {paddingVertical: 25, borderBottomWidth: 1, borderColor: '#eee'},
  date: {fontWeight: '600', marginBottom: 6, color: '#9aece8ff'},
  totalsRow: {flexDirection: 'row', flexWrap: 'wrap'},
  cell: {marginRight: 12, fontSize: 13, color: '#fff'},
  empty: {textAlign: 'center', marginTop: 20, color: '#666'},
});

export default WeekLog;
