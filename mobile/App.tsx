import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import TestConnectionScreen from './src/screens/TestConnectionScreen';

type RootStackParamList = {
  TestConnection: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
    return (
        <NavigationContainer>
            <Stack.Navigator id="root">
                <Stack.Screen 
                    name="TestConnection" 
                    component={TestConnectionScreen} 
                    options={{ title: 'Backend Test' } as StackNavigationOptions}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}