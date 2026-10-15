// Client entry point: register the main App component with Expo so it can start on the selected
// platform.
// Where: mobile/index.js imports App.tsx.
// How: registerRootComponent(App) registers the main component with Expo to start the client.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
