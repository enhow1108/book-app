import { Alert } from 'react-native';

export function showMessage(title: string, message: string) {
  Alert.alert(title, message);
}

/** Asks before a destructive action; `onConfirm` runs only if the person confirms. */
export function confirmDestructive(title: string, message: string, actionText: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: '取消', style: 'cancel' },
    { text: actionText, style: 'destructive', onPress: onConfirm },
  ]);
}
