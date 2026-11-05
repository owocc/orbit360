import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface LoaderProps {
  progress: number;
  error?: string | null;
}

export const Loader: React.FC<LoaderProps> = ({ progress, error }) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Text style={styles.title}>{error ? `加载失败: ${error}` : "LOADING FRAMES"}</Text>
        <View style={styles.track}>
          <View
            style={[
              styles.bar,
              { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` },
              error ? styles.barError : undefined,
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10, 11, 14, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  content: {
    width: 240,
    alignItems: "center",
  },
  title: {
    fontSize: 11,
    color: "#8B909A",
    letterSpacing: 1.2,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  track: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: "#6EE7B7",
  },
  barError: {
    backgroundColor: "#EF4444",
  },
});
