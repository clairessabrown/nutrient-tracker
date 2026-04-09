import React, {useEffect, useState} from 'react';
import {View, Text, Button, StyleSheet, FlatList, Share, Alert, Modal, TextInput, TouchableOpacity} from 'react-native';
import mealsStore, {MealRecord} from '../lib/store';

type Props = {
  onClose: () => void;
};

const Export: React.FC<Props> = ({onClose}) => {
  const [meals, setMeals] = useState<MealRecord[]>(mealsStore.getMeals());
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');

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

  const parseImportText = (raw: string): MealRecord[] => {
    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length === 0) return [];

    // Drop header row if present
    const dataLines = /date\s*,\s*meal_number/i.test(lines[0]) ? lines.slice(1) : lines;

    const parsed: MealRecord[] = [];
    dataLines.forEach((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 8) return;
      const [dateStr, mealNumStr, calStr, proStr, fibStr, sugStr, fatStr, wStr] = parts;
      const baseDate = new Date(dateStr);
      if (isNaN(baseDate.getTime())) return;
      const mealNum = parseInt(mealNumStr, 10) || 1;
      // Reconstruct an approximate timestamp: add meal number as hour offset
      // so multiple meals on the same day keep insertion order.
      baseDate.setHours(8 + (mealNum - 1), 0, 0, 0);
      const toNum = (s: string) => {
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };
      const record: MealRecord = {
        id: `import-${baseDate.getTime()}-${mealNum}-${i}`,
        timestamp: baseDate.getTime(),
        calories: toNum(calStr),
        protein: toNum(proStr),
        fiber: toNum(fibStr),
        sugar: toNum(sugStr),
        fat: toNum(fatStr),
        weight: toNum(wStr),
      };
      parsed.push(record);
    });
    return parsed;
  };

  const onImport = () => {
    setImportText('');
    setImportVisible(true);
  };

  const onConfirmImport = async () => {
    const records = parseImportText(importText);
    if (records.length === 0) {
      Alert.alert('Import failed', 'No valid rows found. Paste the exported text including the header row.');
      return;
    }
    try {
      await mealsStore.importMeals(records, 'merge');
      setImportVisible(false);
      setImportText('');
      Alert.alert('Import complete', `Imported ${records.length} meal${records.length === 1 ? '' : 's'}.`);
    } catch (e) {
      Alert.alert('Import failed', String(e));
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
      <Text style={styles.title}>Import/Export (Last 365 Days)</Text>
      <FlatList
        data={groupedDays}
        keyExtractor={g => g.date}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No meals recorded yet.</Text>}
      />

      <View style={styles.actions}>
        <Button title="Export" onPress={onExport} />
        <TouchableOpacity onPress={onImport} style={styles.importBtn}>
          <Text style={styles.importBtnText}>Import</Text>
        </TouchableOpacity>
        {/* <Button title="Close" onPress={onClose} />  */}{/* Close button removed for cleaner UI */}
      </View>

      <Modal
        visible={importVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Data</Text>
            <Text style={styles.modalHint}>
              Paste the previously exported text below (including the header row).
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder={'date,meal_number,calories,protein,fiber,sugar,fat,weight\n...'}
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" onPress={() => setImportVisible(false)} />
              <Button title="Import" onPress={onConfirmImport} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, backgroundColor: '#7caecaff'},
  title: {fontSize: 24, fontWeight: '600', marginBottom: 12, marginTop:60, color: '#082c32ff'},
  row: {paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee'},
  rowText: {fontSize: 14},
  empty: {textAlign: 'center', marginTop: 20, color: '#666'},
  actions: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12,},
  date: {fontWeight: '700'},
  importBtn: {paddingHorizontal: 12, paddingVertical: 6},
  importBtnText: {color: '#ff8a8a', fontSize: 16, fontWeight: '600'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20},
  modalContent: {backgroundColor: '#fff', borderRadius: 8, padding: 16},
  modalTitle: {fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#082c32ff'},
  modalHint: {fontSize: 13, color: '#555', marginBottom: 8},
  modalInput: {borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, minHeight: 160, textAlignVertical: 'top', color: '#000'},
  modalActions: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12},
});

export default Export;
