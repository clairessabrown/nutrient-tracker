import React, {useEffect, useState} from 'react';
import {View, Text, Button, StyleSheet, FlatList, Share, Alert} from 'react-native';
import mealsStore, {MealRecord} from '../lib/store';

type Props = {
  onClose: () => void;
};

const Export: React.FC<Props> = ({onClose}) => {
  const [meals, setMeals] = useState<MealRecord[]>(mealsStore.getMeals());

  useEffect(() => {
    const unsub = mealsStore.subscribe(() => setMeals(mealsStore.getMeals()));
    return unsub;
  }, []);

  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const last365Days = meals.filter(m => m.timestamp > oneYearAgo);

  type DayGroup = {
    date: string;
    calories: number;
    protein: number;
    fiber: number;
    sugar: number;
    fat: number;
    weight: number | null;
  };

  // Group meals by date and compute totals + last weight for each day
  const groupedDays: DayGroup[] = (() => {
    const map = last365Days.reduce((acc, m) => {
      const dateKey = new Date(m.timestamp).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [] as MealRecord[];
      acc[dateKey].push(m);
      return acc;
    }, {} as Record<string, MealRecord[]>);

    const groups = Object.entries(map).map(([date, rows]) => {
      const totals = rows.reduce(
        (s, r) => ({
          calories: s.calories + r.calories,
          protein: s.protein + r.protein,
          fiber: s.fiber + r.fiber,
          sugar: s.sugar + r.sugar,
          fat: s.fat + r.fat,
        }),
        {calories: 0, protein: 0, fiber: 0, sugar: 0, fat: 0},
      );
      // last recorded weight for that day
      const lastWeight = rows.length ? rows[rows.length - 1].weight : null;
      return {
        date,
        calories: totals.calories,
        protein: totals.protein,
        fiber: totals.fiber,
        sugar: totals.sugar,
        fat: totals.fat,
        weight: lastWeight ?? null,
      } as DayGroup;
    });

    // sort by date descending (most recent first)
    groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return groups;
  })();

  const buildTxt = (rows: MealRecord[]) => {
    const grouped = rows.reduce((acc, m) => {
      const date = new Date(m.timestamp).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(m);
      return acc;
    }, {} as Record<string, MealRecord[]>);

    let txt = 'date,meal_number,calories,protein,fiber,sugar,fat,weight\n';
    Object.entries(grouped).forEach(([date, meals]) => {
      meals.forEach((m, idx) => {
        txt += `${date},${idx + 1},${m.calories},${m.protein},${m.fiber},${m.sugar},${m.fat},${m.weight}\n`;
      });
    });
    return txt;
  };

  const onExport = async () => {
    if (last365Days.length === 0) {
      Alert.alert('Nothing to export', 'There are no meals to export.');
      return;
    }
    const txt = buildTxt(last365Days);
    try {
      await Share.share({
        title: 'Nutrition_Log.txt',
        message: txt,
      });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const renderItem = ({item, index}: {item: DayGroup; index: number}) => (
    <View style={styles.row} key={item.date}>
      <Text style={styles.rowText}>
        {index + 1}. <Text style={styles.date}>{item.date}</Text>: {item.calories} kcal • {item.protein} g protein • {item.fiber} g fiber • {item.sugar} g sugar • {item.fat} g fat{item.weight != null ? ` • ${item.weight} lbs` : ''}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Export (Last 365 Days)</Text>
      <FlatList
        data={groupedDays}
        keyExtractor={g => g.date}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No meals recorded yet.</Text>}
      />

      <View style={styles.actions}>
        <Button title="Export" onPress={onExport} />
        {/* <Button title="Close" onPress={onClose} />  */}{/* Close button removed for cleaner UI */}  
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, backgroundColor: '#7caecaff'},
  title: {fontSize: 24, fontWeight: '600', marginBottom: 12, marginTop:60, color: '#082c32ff'},
  row: {paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee'},
  rowText: {fontSize: 14},
  empty: {textAlign: 'center', marginTop: 20, color: '#666'},
  actions: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12,},
  date: {fontWeight: '700'},
});

export default Export;
