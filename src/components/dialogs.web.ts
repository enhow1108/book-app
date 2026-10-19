// react-native-web's Alert.alert does nothing, so use the browser's own dialogs.

export function showMessage(title: string, message: string) {
  window.alert(`${title}\n\n${message}`);
}

/** Asks before a destructive action; `onConfirm` runs only if the person confirms. */
export function confirmDestructive(title: string, message: string, _actionText: string, onConfirm: () => void) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
