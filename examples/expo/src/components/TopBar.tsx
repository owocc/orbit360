import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface TopBarProps {
  title: string;
  hint: string;
  hintVisible: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ title, hint, hintVisible }) => {
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.hint, { opacity: hintVisible ? 1 : 0 }]}>{hint}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    backgroundColor: "rgba(5, 6, 8, 0.72)",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F2F3F5",
    letterSpacing: -0.2,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: "#8B909A",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
