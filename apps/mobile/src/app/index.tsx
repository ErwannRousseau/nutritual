import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Nutritual</Text>
      <Text style={styles.subtitle}>Votre compagnon nutrition.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f8f5",
  },
  title: {
    color: "#1f3d32",
    fontSize: 36,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 12,
    color: "#56665d",
    fontSize: 16,
  },
});
