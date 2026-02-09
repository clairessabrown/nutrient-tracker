import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MealsStoreScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.placeholder}>Settings & Data Management</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 16,
    color: '#666',
  },
});

export default MealsStoreScreen;
