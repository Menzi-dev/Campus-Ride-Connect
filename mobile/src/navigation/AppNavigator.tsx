import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import TestConnectionScreen from '../screens/TestConnectionScreen';

type RootStackParamList = {
	TestConnection: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
	return (
		<NavigationContainer>
			<Stack.Navigator id="root">
				<Stack.Screen name="TestConnection" component={TestConnectionScreen} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}
