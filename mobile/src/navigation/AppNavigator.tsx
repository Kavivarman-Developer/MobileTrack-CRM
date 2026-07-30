import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useAppSelector } from "../hooks/redux";
import LoginScreen from "../screens/Auth/LoginScreen";
import CustomersScreen from "../screens/Customers/CustomersScreen";
import DashboardScreen from "../screens/Dashboard/DashboardScreen";
import InventoryScreen from "../screens/Inventory/InventoryScreen";
import ProductDetailScreen from "../screens/Inventory/ProductDetailScreen";
import ExpensesScreen from "../screens/Expenses/ExpensesScreen";
import ReportsScreen from "../screens/Reports/ReportsScreen";
import QuickSaleScreen from "../screens/Sales/QuickSaleScreen";
import SalesScreen from "../screens/Sales/SalesScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: { minHeight: 62, paddingBottom: 7, paddingTop: 6 },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="grid-outline" size={size} /> }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarLabel: "Inventory", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="cube-outline" size={size} /> }} />
      <Tab.Screen name="Sales" component={SalesScreen} options={{ tabBarLabel: "Sales", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="cart-outline" size={size} /> }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarLabel: "Customers", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="people-outline" size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "Settings", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="settings-outline" size={size} /> }} />
    </Tab.Navigator>
  );
}

function DrawerShell() {
  return (
    <Drawer.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <Drawer.Screen name="Retail Manager" component={Tabs} />
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  const user = useAppSelector((state) => state.auth.user);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="App" component={DrawerShell} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="QuickSale" component={QuickSaleScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
        </>
      ) : <Stack.Screen name="Login" component={LoginScreen} />}
    </Stack.Navigator>
  );
}
