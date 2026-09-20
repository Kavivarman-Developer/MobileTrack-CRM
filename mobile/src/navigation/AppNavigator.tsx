import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, typography } from "../constants/theme";
import { useAppSelector } from "../hooks/redux";
import { AppDrawerContent } from "./AppDrawerContent";
import OrganizationDetailScreen from "../screens/Admin/OrganizationDetailScreen";
import OrganizationsScreen from "../screens/Admin/OrganizationsScreen";
import LoginScreen from "../screens/Auth/LoginScreen";
import BillingScreen from "../screens/Billing/BillingScreen";
import CustomersScreen from "../screens/Customers/CustomersScreen";
import DashboardScreen from "../screens/Dashboard/DashboardScreen";
import LowStockScreen from "../screens/Dashboard/LowStockScreen";
import BarcodeGeneratorScreen from "../screens/Inventory/BarcodeGeneratorScreen";
import InventoryScreen from "../screens/Inventory/InventoryScreen";
import InventoryAdjustmentsScreen from "../screens/Inventory/InventoryAdjustmentsScreen";
import ProductDetailScreen from "../screens/Inventory/ProductDetailScreen";
import ExpensesScreen from "../screens/Expenses/ExpensesScreen";
import OrdersScreen from "../screens/Orders/OrdersScreen";
import PurchasesScreen from "../screens/Purchases/PurchasesScreen";
import ReportsScreen from "../screens/Reports/ReportsScreen";
import QuickSaleScreen from "../screens/Sales/QuickSaleScreen";
import SalesScreen from "../screens/Sales/SalesScreen";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import GroceryStoreScreen from "../screens/Store/GroceryStoreScreen";
import VendorsScreen from "../screens/Vendors/VendorsScreen";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function Tabs({ route }: any) {
  const initialRouteName = route?.params?.initialTab || "Dashboard";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const tabBarHeight = 60 + Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarStyle: isDesktop
          ? { display: "none" }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: tabBarHeight,
              minHeight: tabBarHeight,
              paddingBottom: Math.max(insets.bottom, 10),
              paddingTop: 6,
              elevation: 8,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: "Home", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "home" : "home-outline"} size={22} /> }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: "Orders", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "receipt" : "receipt-outline"} size={22} /> }} />
      <Tab.Screen name="Sales" component={SalesScreen} options={{ tabBarLabel: "Sales", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "bag" : "bag-outline"} size={22} /> }} />
      <Tab.Screen name="Vendors" component={VendorsScreen} options={{ tabBarLabel: "Vendors", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "people" : "people-outline"} size={22} /> }} />
      <Tab.Screen name="Purchases" component={PurchasesScreen} options={{ tabBarLabel: "Purchases", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "cart" : "cart-outline"} size={22} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "Settings", tabBarIcon: ({ color, focused }) => <Ionicons color={color} name={focused ? "settings" : "settings-outline"} size={22} /> }} />
    </Tab.Navigator>
  );
}

function DrawerShell() {
  const user = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === "superadmin";
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;

  const drawerWidth = isDesktop ? 250 : Math.min(Math.round(width * 0.76), 260);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <AppDrawerContent {...props} />}
      initialRouteName="Home"
      screenOptions={{
        drawerType: isDesktop ? "permanent" : "front",
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: "#FFFFFF",
          borderRightWidth: isDesktop ? 1 : 0,
          borderRightColor: "#E2E8F0",
        },
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerActiveBackgroundColor: colors.primaryLight,
        drawerInactiveBackgroundColor: "transparent",
        drawerItemStyle: { borderRadius: 8, height: 38, justifyContent: "center", marginHorizontal: 8, marginVertical: 1, paddingHorizontal: 6 },
        drawerLabelStyle: { fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600", marginLeft: -12 },
      }}
    >
      {isSuperAdmin && <Drawer.Screen name="Admin" component={OrganizationsScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="shield-checkmark-outline" size={18} /> }} />}
      <Drawer.Screen name="Home" component={Tabs} options={{ headerShown: false, drawerIcon: ({ color }) => <Ionicons color={color} name="home-outline" size={18} /> }} />
      <Drawer.Screen name="Items" component={InventoryScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="cube-outline" size={18} /> }} />
      <Drawer.Screen name="Inventory Adjustments" component={InventoryAdjustmentsScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="options-outline" size={18} /> }} />
      <Drawer.Screen name="Barcode Generator" component={BarcodeGeneratorScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="barcode-outline" size={18} /> }} />
      <Drawer.Screen name="Sales" component={SalesScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="bag-outline" size={18} /> }} />
      <Drawer.Screen name="Billing" component={BillingScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="card-outline" size={18} /> }} />
      <Drawer.Screen name="Customers" component={CustomersScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="people-outline" size={18} /> }} />
      <Drawer.Screen name="Purchases" component={PurchasesScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="cart-outline" size={18} /> }} />
      <Drawer.Screen name="Vendors" component={VendorsScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="business-outline" size={18} /> }} />
      <Drawer.Screen name="Expenses" component={ExpensesScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="wallet-outline" size={18} /> }} />
      <Drawer.Screen name="Orders" component={OrdersScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="receipt-outline" size={18} /> }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="bar-chart-outline" size={18} /> }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerIcon: ({ color }) => <Ionicons color={color} name="settings-outline" size={18} /> }} />
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
          <Stack.Screen name="LowStock" component={LowStockScreen} />
          <Stack.Screen name="BarcodeGenerator" component={BarcodeGeneratorScreen} />
          <Stack.Screen name="QuickSale" component={QuickSaleScreen} />
          <Stack.Screen name="Billing" component={BillingScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="Vendors" component={VendorsScreen} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="Purchases" component={PurchasesScreen} />
          <Stack.Screen name="InventoryAdjustments" component={InventoryAdjustmentsScreen} />
          <Stack.Screen name="AdminOrganizations" component={OrganizationsScreen} />
          <Stack.Screen name="OrganizationDetail" component={OrganizationDetailScreen} />
        </>
      ) : <Stack.Screen name="Login" component={LoginScreen} />}
      <Stack.Screen name="GroceryStore" component={GroceryStoreScreen} />
    </Stack.Navigator>
  );
}
