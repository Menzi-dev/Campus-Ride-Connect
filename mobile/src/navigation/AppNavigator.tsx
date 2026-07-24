import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import FaceVerificationScreen from '../screens/FaceVerificationScreen';
import HomeScreen from '../screens/HomeScreen';
import TripHistoryScreen from '../screens/TripHistoryScreen';
import ScheduleScreen from '../screens/ScheduleRideScreen';
import ProfileScreen from '../screens/ProfileScreen';

type RootStackParamList = {
	Landing: undefined;
	Login: undefined;
	CreateAccount: undefined;
	FaceVerification: { fullName?: string; email?: string } | undefined;
	Home: undefined;
	TripHistory: undefined;
	Schedule: undefined;
	Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
	return (
		<NavigationContainer>
			<Stack.Navigator
				id="root"
				initialRouteName="Landing"
				screenOptions={{ headerShown: false }}
			>
				<Stack.Screen name="Landing" component={LandingScreen} />
				<Stack.Screen name="Login" component={LoginScreen} />
				<Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
				<Stack.Screen name="FaceVerification" component={FaceVerificationScreen} options={{ headerShown: false, gestureEnabled: false }} />
				<Stack.Screen name="Home" component={HomeScreen} />
				<Stack.Screen name="TripHistory" component={TripHistoryScreen} />
				<Stack.Screen name="Schedule" component={ScheduleScreen} />
				<Stack.Screen name="Profile" component={ProfileScreen} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}