import { Platform, ToastAndroid, Alert } from 'react-native';

const showToastAndroid = (message: string) => {
  ToastAndroid.show(message, ToastAndroid.SHORT);
};

const Notifier = {
  success: (message: string) => {
    if (Platform.OS === 'android') return showToastAndroid(message);
    Alert.alert('Success', message);
  },
  error: (message: string) => {
    if (Platform.OS === 'android') return showToastAndroid(message);
    Alert.alert('Error', message);
  },
  info: (message: string) => {
    if (Platform.OS === 'android') return showToastAndroid(message);
    Alert.alert('Info', message);
  },
};

export default Notifier;
