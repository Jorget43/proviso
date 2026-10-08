// Asks before something hard to undo. Native: the system alert. The web
// build has its own confirm.web.ts.

import { Alert } from 'react-native'

export function confirmAction(title: string, message: string, action: string, onConfirm: () => void): void {
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: onConfirm }])
}
