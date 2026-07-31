import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useAppSelector } from "../hooks/redux";
import OrganizationDetailScreen from "../screens/Admin/OrganizationDetailScreen";
import OrganizationsScreen from "../screens/Admin/OrganizationsScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import CustomersScreen from "../screens/Customers/CustomersScreen";
import DashboardScreen from "../screens/Dashboard/DashboardScreen";
import InventoryScreen from "../screens/Inventory/InventoryScreen";
import InventoryAdjustmentsScreen from "../screens/Inventory/InventoryAdjustmentsScreen";
import ProductDetailScreen from "../screens/Inventory/ProductDetailScreen";
import ExpensesScreen from "../screens/Expenses/ExpensesScreen";
import PurchasesScreen from "../screens/Purchases/PurchasesScreen";
import ReportsScreen from "../screens/Reports/ReportsScreen";
import QuickSaleScreen from "../screens/Sales/QuickSaleScreen";
import SalesScreen from "../screens/Sales/SalesScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import VendorsScreen from "../screens/Vendors/VendorsScreen";

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
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: "Home", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} /> }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ tabBarLabel: "Items", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="cube-outline" size={size} /> }} />
      <Tab.Screen name="Sales" component={SalesScreen} options={{ tabBarLabel: "Sales", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="bag-outline" size={size} /> }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ tabBarLabel: "Customers", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="people-outline" size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "Settings", tabBarIcon: ({ color, size }) => <Ionicons color={color} name="settings-outline" size={size} /> }} />
    </Tab.Navigator>
  );
}

function DrawerShell() {
  const user = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === "superadmin";
  return (
    <Drawer.Navigator screenOptions={{ headerTintColor: colors.primary, drawerActiveTintColor: colors.primary }}>
      {isSuperAdmin && <Drawer.Screen name="Admin" component={OrganizationsScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="shield-checkmark-outline" size={size} /> }} />}
      <Drawer.Screen name="Home" component={Tabs} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="home-outline" size={size} /> }} />
      <Drawer.Screen name="Items" component={InventoryScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="cube-outline" size={size} /> }} />
      <Drawer.Screen name="Inventory Adjustments" component={InventoryAdjustmentsScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="options-outline" size={size} /> }} />
      <Drawer.Screen name="Sales" component={SalesScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="bag-outline" size={size} /> }} />
      <Drawer.Screen name="Purchases" component={PurchasesScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="cart-outline" size={size} /> }} />
      <Drawer.Screen name="Vendors" component={VendorsScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="hand-left-outline" size={size} /> }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="bar-chart-outline" size={size} /> }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerIcon: ({ color, size }) => <Ionicons color={color} name="settings-outline" size={size} /> }} />
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
          <Stack.Screen name="Vendors" component={VendorsScreen} />
          <Stack.Screen name="Purchases" component={PurchasesScreen} />
          <Stack.Screen name="InventoryAdjustments" component={InventoryAdjustmentsScreen} />
          <Stack.Screen name="AdminOrganizations" component={OrganizationsScreen} />
          <Stack.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
        </>
      ) : <Stack.Screen name="Login" component={LoginScreen} />}
    </Stack.Navigator>
  );
}
