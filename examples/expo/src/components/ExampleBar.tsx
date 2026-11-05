import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface CatalogItem {
  id: string;
  title: string;
  orb: string;
}

interface ExampleBarProps {
  items: CatalogItem[];
  currentId: string | null;
  onSelect: (item: CatalogItem) => void;
}

export const ExampleBar: React.FC<ExampleBarProps> = ({ items, currentId, onSelect }) => {
  if (items.length < 2) return null;

  return (
    <View style={styles.container}>
      <View style={styles.scroll}>
        {items.map((item) => {
          const active = item.id === currentId;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => {
                console.log("Pill clicked for item:", item.id);
                onSelect(item);
              }}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {item.title || item.id}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(13, 15, 19, 0.88)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  scroll: {
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginHorizontal: 2,
  },
  pillActive: {
    backgroundColor: "#6EE7B7",
  },
  pillText: {
    fontSize: 12,
    color: "#8B909A",
  },
  pillTextActive: {
    color: "#06281E",
    fontWeight: "600",
  },
});
